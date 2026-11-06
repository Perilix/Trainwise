// Séances structurées de vélo et de natation : zones, cibles individualisées (watts depuis
// la FTP, allures depuis la CSS), durées estimées, profil d'intensité et déroulé lisible.
// Les blocs gardent l'intensité en % : c'est la référence de l'athlète qui donne les chiffres.
import type { ApiSportBlock, ApiSportReference, ApiSportStep } from '../core/api-types';
import type { RunBlockView, RunStepView } from './athlete.types';
import { formatDuration, totals, type Segment } from './sessions';

export type EnduranceSport = 'bike' | 'swim';

export type Zone = { key: string; label: string; low: number; high: number };

/** Zones de puissance en % FTP. */
export const BIKE_ZONES: Zone[] = [
  { key: 'recup', label: 'Récupération', low: 45, high: 55 },
  { key: 'endurance', label: 'Endurance', low: 56, high: 75 },
  { key: 'tempo', label: 'Tempo', low: 76, high: 87 },
  { key: 'sweet_spot', label: 'Sweet spot', low: 88, high: 94 },
  { key: 'seuil', label: 'Seuil', low: 95, high: 105 },
  { key: 'pma', label: 'PMA', low: 106, high: 120 },
  { key: 'anaerobie', label: 'Anaérobie', low: 121, high: 150 },
];

/** Zones de natation en % de la vitesse CSS (100 % = allure seuil). */
export const SWIM_ZONES: Zone[] = [
  { key: 'souple', label: 'Souple', low: 75, high: 84 },
  { key: 'endurance', label: 'Endurance', low: 85, high: 91 },
  { key: 'tempo', label: 'Tempo', low: 92, high: 96 },
  { key: 'seuil', label: 'Seuil (CSS)', low: 97, high: 103 },
  { key: 'vitesse', label: 'Vitesse', low: 104, high: 115 },
];

export const zonesFor = (sport: EnduranceSport) => (sport === 'bike' ? BIKE_ZONES : SWIM_ZONES);

/** Légende du profil : cinq paliers de couleur, libellés propres à chaque sport. */
export const INTENSITY_LEGENDS: Record<EnduranceSport, { label: string; range: string }[]> = {
  bike: [
    { label: 'Récup, endurance', range: '< 76 %' },
    { label: 'Tempo', range: '76 – 87 %' },
    { label: 'Sweet spot', range: '88 – 94 %' },
    { label: 'Seuil', range: '95 – 105 %' },
    { label: 'PMA et plus', range: '> 105 %' },
  ],
  swim: [
    { label: 'Souple, endurance', range: '< 92 %' },
    { label: 'Tempo', range: '92 – 96 %' },
    { label: 'Seuil (CSS)', range: '97 – 103 %' },
    { label: 'Vitesse', range: '104 – 109 %' },
    { label: 'Sprint', range: '≥ 110 %' },
  ],
};

export const STROKE_LABELS: Record<string, string> = {
  crawl: 'Crawl',
  dos: 'Dos',
  brasse: 'Brasse',
  papillon: 'Papillon',
  '4n': '4 nages',
  choix: 'Nage au choix',
  educ: 'Éducatifs',
  jambes: 'Jambes',
  bras: 'Bras seuls',
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  pull: 'Pull-buoy',
  plaquettes: 'Plaquettes',
  palmes: 'Palmes',
  tuba: 'Tuba',
  planche: 'Planche',
};

export const POOL_LABELS: Record<string, string> = { '25': '25 m', '50': '50 m', open: 'Eau libre' };

const ROLE_LABELS = { warmup: 'Échauffement', main: 'Corps de séance', cooldown: 'Retour au calme' } as const;

// Sans référence connue, on suppose un athlète moyen : le profil reste indicatif.
const DEFAULT_FTP = 220;
const DEFAULT_CSS = 110; // 1'50 / 100 m

// ---------- Formats ----------

/** Allure de natation en secondes / 100 m → « 1'45 ». */
export const formatSwimPace = (seconds: number) => {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}’${String(total % 60).padStart(2, '0')}`;
};

/** « 1'45 », « 1:45 », « 1’45 », « 105 » → secondes. */
export function parseSwimPace(text: string): number | undefined {
  const value = text.trim().replace(/[″"]/g, '');
  const clock = value.match(/^(\d{1,2})\s*[:'’′]\s*(\d{1,2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const bare = Number(value.replace(',', '.'));
  return Number.isFinite(bare) && bare > 0 ? Math.round(bare) : undefined;
}

export const formatMeters = (meters: number) =>
  meters >= 1000 && meters % 1000 === 0 ? `${meters / 1000} km` : `${Math.round(meters).toLocaleString('fr-FR')} m`;

// ---------- Intensité ----------

const mid = (step: ApiSportStep) => {
  const low = step.intensityLow ?? step.intensityHigh ?? null;
  const high = step.intensityHigh ?? step.intensityLow ?? null;
  return low == null || high == null ? null : (low + high) / 2;
};

/** Intensité de l'étape ramenée en % de la référence (FTP ou CSS), pour les zones et les couleurs. */
export function relativeIntensity(step: ApiSportStep, sport: EnduranceSport, ref?: ApiSportReference | null): number | null {
  const value = mid(step);
  if (value == null) return null;
  switch (step.intensityMode) {
    case 'ftp':
    case 'css':
      return value;
    case 'watts':
      return (value / (ref?.ftp || DEFAULT_FTP)) * 100;
    case 'pace':
      return ((ref?.css || DEFAULT_CSS) / value) * 100;
    case 'hr':
      // % FC max → % FTP approximatif, juste pour colorer le profil.
      return value <= 70 ? 60 : value <= 80 ? 72 : value <= 87 ? 85 : value <= 92 ? 98 : 110;
    case 'rpe':
      return [50, 55, 60, 68, 75, 82, 90, 98, 108, 120][Math.min(9, Math.max(0, Math.round(value) - 1))];
    default:
      return sport === 'bike' ? 65 : 88;
  }
}

/** Palier de couleur 1 à 5. */
export function intensityLevel(relative: number | null, sport: EnduranceSport, role: ApiSportStep['role']) {
  if (relative == null) return role === 'main' ? 3 : 1;
  const steps = sport === 'bike' ? [76, 88, 95, 106] : [92, 97, 104, 110];
  return 1 + steps.filter((threshold) => relative >= threshold).length;
}

// Le profil et les couleurs de l'app raisonnent en « % VMA » (paliers 68 / 78 / 84 / 95) :
// on donne à chaque palier une valeur représentative.
const LEVEL_PCT = [60, 73, 81, 90, 100];
export const levelPct = (level: number) => LEVEL_PCT[Math.min(5, Math.max(1, level)) - 1];

export function zoneOf(relative: number | null, sport: EnduranceSport): Zone | undefined {
  if (relative == null) return undefined;
  const zones = zonesFor(sport);
  return zones.find((zone) => relative <= zone.high) ?? zones[zones.length - 1];
}

const range = (low: number, high: number, format: (value: number) => string, unit: string) =>
  Math.round(low) === Math.round(high) ? `${format(low)} ${unit}` : `${format(low)}-${format(high)} ${unit}`;

/** Cible telle que le coach l'a écrite : « 95-100 % FTP », « 50 → 70 % FTP », « Seuil (CSS) ». */
export function targetLabel(step: ApiSportStep): string | undefined {
  const low = step.intensityLow ?? step.intensityHigh;
  const high = step.intensityHigh ?? step.intensityLow;
  if (low == null || high == null) return undefined;
  const sep = step.ramp ? ' → ' : '-';
  const join = (unit: string, format: (value: number) => string = (value) => String(Math.round(value))) =>
    step.ramp || Math.round(low) !== Math.round(high) ? `${format(low)}${sep}${format(high)} ${unit}` : `${format(low)} ${unit}`;
  switch (step.intensityMode) {
    case 'ftp':
      return join('% FTP');
    case 'watts':
      return join('W');
    case 'hr':
      return join('% FC max');
    case 'rpe':
      return join('/ 10 de ressenti');
    case 'css':
      return join('% CSS');
    case 'pace':
      return join('/100 m', formatSwimPace);
    default:
      return undefined;
  }
}

/** Cible chiffrée pour un athlète : watts depuis sa FTP, allure depuis sa CSS. */
export function resolvedTarget(step: ApiSportStep, ref?: ApiSportReference | null): string | undefined {
  const low = step.intensityLow ?? step.intensityHigh;
  const high = step.intensityHigh ?? step.intensityLow;
  if (low == null || high == null) return undefined;
  const sep = step.ramp ? ' → ' : '-';
  if (step.intensityMode === 'ftp' && ref?.ftp) {
    const a = Math.round((ref.ftp * low) / 100);
    const b = Math.round((ref.ftp * high) / 100);
    return step.ramp || a !== b ? `${a}${sep}${b} W` : `${a} W`;
  }
  if (step.intensityMode === 'css' && ref?.css) {
    // Plus le % est haut, plus on nage vite : l'allure la plus rapide vient en premier.
    const fast = ref.css / (high / 100);
    const slow = ref.css / (low / 100);
    return range(fast, slow, formatSwimPace, '/100 m');
  }
  return undefined;
}

// ---------- Durées et distances ----------

/** Allure estimée en s / 100 m pour une étape de natation. */
function swimPace(step: ApiSportStep, ref?: ApiSportReference | null) {
  const css = ref?.css || DEFAULT_CSS;
  if (step.intensityMode === 'pace' && mid(step)) return mid(step)!;
  const relative = relativeIntensity(step, 'swim', ref) ?? 88;
  // Éducatifs et jambes : plus lents qu'une nage complète.
  const slowdown = step.stroke === 'educ' || step.stroke === 'jambes' ? 1.15 : 1;
  return (css / (relative / 100)) * slowdown;
}

/** Durée d'une répétition de l'étape, récupération non comprise, en secondes. */
export function stepWorkSeconds(step: ApiSportStep, sport: EnduranceSport, ref?: ApiSportReference | null) {
  if (step.duration) return step.duration;
  if (sport === 'swim' && step.distance) return (step.distance / 100) * swimPace(step, ref);
  if (sport === 'bike' && step.distance) return (step.distance / 1000 / 30) * 3600; // 30 km/h
  return 0;
}

/** Récupération après une répétition. Un départ fixe compte ce qui reste jusqu'au départ suivant. */
export function stepRestSeconds(step: ApiSportStep, sport: EnduranceSport, ref?: ApiSportReference | null) {
  if (!step.recoveryMode || !step.recoverySeconds) return 0;
  if (step.recoveryMode === 'sendoff') return Math.max(0, step.recoverySeconds - stepWorkSeconds(step, sport, ref));
  return step.recoverySeconds;
}

const ordered = (blocks: ApiSportBlock[]) => [...blocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/** Déplie les blocs (répétitions et groupes compris) en segments pour le profil d'intensité. */
export function sportSegments(blocks: ApiSportBlock[], sport: EnduranceSport, ref?: ApiSportReference | null): Segment[] {
  const segments: Segment[] = [];
  ordered(blocks).forEach((block, index) => {
    const group = Boolean(block.children?.length);
    const steps = group ? (block.children ?? []) : [block];
    const reps = Math.max(1, block.repetitions ?? 1);
    const kind: Segment['kind'] = block.role === 'warmup' ? 'warmup' : block.role === 'cooldown' ? 'cooldown' : reps > 1 || group ? 'work' : 'steady';

    for (let rep = 0; rep < reps; rep++) {
      const lastRep = rep === reps - 1;
      steps.forEach((step, stepIndex) => {
        const sec = stepWorkSeconds(step, sport, ref);
        const dist = sport === 'swim' ? (step.distance ?? 0) : 0;
        if (step.ramp && sport === 'bike' && step.intensityLow != null && step.intensityHigh != null && sec > 0) {
          // Une rampe se dessine en marches, de la borne basse à la borne haute.
          const stairs = 4;
          for (let stair = 0; stair < stairs; stair++) {
            const value = step.intensityLow + ((step.intensityHigh - step.intensityLow) * stair) / (stairs - 1);
            const relative = relativeIntensity({ ...step, intensityLow: value, intensityHigh: value, ramp: false }, sport, ref);
            segments.push({ kind, sec: sec / stairs, pct: levelPct(intensityLevel(relative, sport, block.role)), dist: 0, block: index });
          }
        } else {
          const relative = relativeIntensity(step, sport, ref);
          segments.push({ kind, sec, pct: levelPct(intensityLevel(relative, sport, step.role ?? block.role)), dist, block: index });
        }
        const rest = stepRestSeconds(step, sport, ref);
        const endOfBlock = lastRep && stepIndex === steps.length - 1 && (reps > 1 || group);
        if (rest > 0 && !endOfBlock) segments.push({ kind: 'rest', sec: rest, pct: 50, dist: 0, block: index });
      });
    }
  });
  return segments.filter((segment) => segment.sec > 0);
}

export type SportTotals = { seconds: number; meters: number };

export function sportTotals(blocks: ApiSportBlock[] | undefined, sport: EnduranceSport, ref?: ApiSportReference | null): SportTotals {
  if (!blocks?.length) return { seconds: 0, meters: 0 };
  const { sec, dist } = totals(sportSegments(blocks, sport, ref));
  return { seconds: Math.round(sec), meters: Math.round(dist) };
}

// ---------- Déroulé lisible ----------

/** « 10 min », « 100 m crawl », « 4 × 50 m » (la répétition est portée par le bloc). */
function volumeLabel(step: ApiSportStep, sport: EnduranceSport) {
  if (sport === 'swim') {
    const stroke = step.stroke ? STROKE_LABELS[step.stroke]?.toLowerCase() : undefined;
    const volume = step.distance ? formatMeters(step.distance) : step.duration ? formatDuration(step.duration) : '';
    return [volume, stroke].filter(Boolean).join(' ');
  }
  return step.duration ? formatDuration(step.duration) : step.distance ? formatMeters(step.distance) : '';
}

export function recoveryText(step: ApiSportStep) {
  if (!step.recoveryMode || !step.recoverySeconds) return step.recoveryDescription?.trim() ? `Récup · ${step.recoveryDescription.trim()}` : undefined;
  const time = step.recoveryMode === 'sendoff' ? formatSwimPace(step.recoverySeconds) : formatDuration(step.recoverySeconds);
  const base =
    step.recoveryMode === 'sendoff'
      ? `Départ toutes les ${time}`
      : step.recoveryMode === 'rest'
        ? `${time} de repos`
        : `Récup ${time}${step.recoveryIntensity ? ` à ${step.recoveryIntensity} % FTP` : ''}`;
  return step.recoveryDescription?.trim() ? `${base} · ${step.recoveryDescription.trim()}` : base;
}

function stepNotes(step: ApiSportStep) {
  return [
    step.cadence?.trim() ? `Cadence ${step.cadence.trim()} tr/min` : null,
    step.position === 'danseuse' ? 'En danseuse' : step.position === 'assis' ? 'Assis' : null,
    step.equipment?.length ? step.equipment.map((item) => EQUIPMENT_LABELS[item] ?? item).join(', ') : null,
    step.description?.trim() || null,
  ].filter(Boolean) as string[];
}

/** Le plus parlant pour l'athlète : la cible chiffrée, sinon la cible écrite par le coach, sinon la zone. */
export function targetText(step: ApiSportStep, sport: EnduranceSport, ref?: ApiSportReference | null) {
  const resolved = resolvedTarget(step, ref);
  const written = targetLabel(step);
  if (resolved) return resolved;
  if (written) return written;
  return zoneOf(relativeIntensity(step, sport, ref), sport)?.label;
}

export function describeSportBlocks(blocks: ApiSportBlock[], sport: EnduranceSport, ref?: ApiSportReference | null): RunBlockView[] {
  const segments = sportSegments(blocks, sport, ref);
  return ordered(blocks).map((block, index) => {
    const group = Boolean(block.children?.length);
    const steps: RunStepView[] = (group ? (block.children ?? []) : [block]).map((step, stepIndex) => {
      const notes = stepNotes(step);
      return {
        key: `${index}-${stepIndex}`,
        label: group && step.label?.trim() ? `${step.label.trim()} · ${volumeLabel(step, sport)}` : volumeLabel(step, sport),
        paceLabel: targetText(step, sport, ref),
        recoveryLabel: group ? recoveryText(step) : undefined,
        note: group && notes.length ? notes.join(' · ') : undefined,
        pct: levelPct(intensityLevel(relativeIntensity(step, sport, ref), sport, block.role)),
      };
    });
    const notes = group ? [block.description?.trim()].filter(Boolean) : stepNotes(block);
    return {
      key: String(index),
      role: block.role,
      roleLabel: block.label?.trim() || ROLE_LABELS[block.role],
      repetitions: Math.max(1, block.repetitions ?? 1),
      steps,
      recoveryLabel: group ? undefined : recoveryText(block),
      note: notes.length ? notes.join(' · ') : undefined,
      durationSec: segments.filter((segment) => segment.block === index).reduce((sum, segment) => sum + segment.sec, 0),
    };
  });
}

/** Tout le matériel de la séance, pour le sac. */
export function sessionEquipment(blocks: ApiSportBlock[] | undefined) {
  const found = new Set<string>();
  for (const block of blocks ?? []) {
    for (const step of block.children?.length ? block.children : [block]) {
      for (const item of step.equipment ?? []) found.add(item);
    }
  }
  return [...found].map((item) => EQUIPMENT_LABELS[item] ?? item);
}
