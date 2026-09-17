// Modèle de l'éditeur de séance par blocs : même format que les séances planifiées de l'API
// (échauffement, étapes, blocs « Répéter » à étapes enfants, retour au calme ; allure en zone VMA ou fixe).
import { parseDurationText } from '@/features/athlete/run-blocks';
import type { ApiRunBlock, ApiRunBlockStep } from '@/lib/api-types';
import { formatDecimal, formatPace } from '@/lib/format';
import { PACE_ZONES } from '@/lib/pace-zones';
import { formatDuration } from '@/lib/sessions';

export type EditableStep = ApiRunBlockStep & { key: string };
export type EditableBlock = EditableStep & { children?: EditableStep[] };

export const ZONE_CHOICES: readonly (readonly [string, string])[] = [
  ['recovery', 'Récup'],
  ['endurance', 'EF'],
  ['recoveryActive', 'Récup active'],
  ['marathon', 'Marathon'],
  ['semi', 'Semi'],
  ['threshold', 'Seuil'],
  ['tenK', '10K'],
  ['fiveK', '5K'],
  ['vma', 'VMA'],
  ['speed', 'Vitesse'],
];

let keyCounter = 0;
const newKey = () => `nouveau-${++keyCounter}`;

export const isGroup = (block: EditableBlock) => Boolean(block.children?.length);

export const paceMode = (step: ApiRunBlockStep): 'zone' | 'fixed' => (step.paceSource?.mode === 'zone' || step.paceSource?.mode === 'vmaPercent' ? 'zone' : 'fixed');

export const stepPercent = (step: ApiRunBlockStep) => step.paceSource?.vmaPercent ?? (step.paceSource?.zone ? PACE_ZONES[step.paceSource.zone]?.percent : undefined);

/** Allure "m:ss" pour un % de VMA, ou null si la VMA est inconnue. */
export function paceFromPercent(vma: number | undefined, percent: number | undefined) {
  if (!vma || !percent) return null;
  return formatPace(3600 / ((vma * percent) / 100));
}

export function withZone<T extends ApiRunBlockStep>(step: T, zone: string, vma?: number): T {
  const percent = PACE_ZONES[zone]?.percent ?? 70;
  return { ...step, paceSource: { mode: 'zone', zone, vmaPercent: percent, resolvedFromVma: vma ?? null }, pace: paceFromPercent(vma, percent) };
}

export function withPercent<T extends ApiRunBlockStep>(step: T, percent: number, vma?: number): T {
  const vmaPercent = Math.min(130, Math.max(40, Math.round(percent)));
  return { ...step, paceSource: { ...step.paceSource, mode: 'zone', vmaPercent, resolvedFromVma: vma ?? null }, pace: paceFromPercent(vma, vmaPercent) };
}

export function withFixedPace<T extends ApiRunBlockStep>(step: T, pace: string): T {
  return { ...step, paceSource: { mode: 'absolute' }, pace: pace.trim() || null };
}

export const newWarmup = (): EditableBlock =>
  withZone({ key: newKey(), role: 'warmup', mode: 'duration', duration: 20, distance: null, repetitions: 1, description: '', recoveryMode: null }, 'endurance');

export const newCooldown = (): EditableBlock =>
  withZone({ key: newKey(), role: 'cooldown', mode: 'duration', duration: 10, distance: null, repetitions: 1, description: '', recoveryMode: null }, 'endurance');

export const newStep = (): EditableBlock =>
  withZone({ key: newKey(), role: 'main', mode: 'distance', distance: 1, duration: null, repetitions: 1, description: '', recoveryMode: null }, 'threshold');

export const newChild = (): EditableStep =>
  withZone(
    { key: newKey(), role: 'main', mode: 'distance', distance: 0.4, duration: null, repetitions: 1, description: '', recoveryMode: 'duration', recoveryDuration: '1min30', recoveryDescription: 'trot' },
    'vma',
  );

export const newRepeat = (): EditableBlock => ({
  key: newKey(),
  role: 'main',
  mode: 'distance',
  distance: null,
  duration: null,
  pace: null,
  paceSource: null,
  repetitions: 8,
  description: '',
  recoveryMode: null,
  children: [newChild()],
});

/** Blocs de l'API → blocs éditables (clés stables tant que la séance n'est pas modifiée). */
export function toEditable(blocks: ApiRunBlock[]): EditableBlock[] {
  return [...blocks]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((block, index) => ({
      ...block,
      key: `bloc-${index}`,
      children: block.children?.length
        ? [...block.children].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((child, childIndex) => ({ ...child, key: `bloc-${index}-${childIndex}` }))
        : undefined,
    }));
}

/** Insère une étape avant le retour au calme. */
export function insertMain(blocks: EditableBlock[], block: EditableBlock) {
  const cooldown = blocks.findIndex((item) => item.role === 'cooldown');
  return cooldown < 0 ? [...blocks, block] : [...blocks.slice(0, cooldown), block, ...blocks.slice(cooldown)];
}

function toApiStep(step: EditableStep, vma?: number): ApiRunBlockStep {
  const result: ApiRunBlockStep & { key?: string } = { ...step };
  delete result.key;
  // Une allure en zone est recalculée avec la VMA connue au moment de l'enregistrement.
  if (paceMode(step) === 'zone') {
    result.pace = paceFromPercent(vma, stepPercent(step)) ?? step.pace ?? null;
    result.paceSource = { ...step.paceSource, resolvedFromVma: vma ?? step.paceSource?.resolvedFromVma ?? null };
  }
  return result;
}

/** Blocs éditables → corps `runBlocks` de l'API (ordre recalculé). */
export function toPayload(blocks: EditableBlock[], vma?: number): ApiRunBlock[] {
  return blocks.map((block, order) => ({
    ...toApiStep(block, vma),
    order,
    children: block.children?.length ? block.children.map((child, childOrder) => ({ ...toApiStep(child, vma), order: childOrder })) : undefined,
  }));
}

export function validateBlocks(blocks: EditableBlock[]): string | null {
  if (!blocks.length) return 'Ajoutez au moins une étape.';
  const steps = blocks.flatMap((block) => (isGroup(block) ? (block.children ?? []) : [block]));
  for (const step of steps) {
    const value = step.mode === 'distance' ? step.distance : step.duration;
    if (!value || value <= 0) return 'Chaque étape doit avoir une distance ou une durée.';
    if (paceMode(step) === 'fixed' && step.pace && !/^\d{1,2}:[0-5]\d$/.test(step.pace)) return 'Allure fixe au format min:s, par exemple 4:30.';
    if (step.recoveryMode === 'duration' && !parseDurationText(step.recoveryDuration)) return 'Durée de récupération invalide, par exemple 1min30.';
    if (step.recoveryMode === 'distance' && !(step.recoveryDistance && step.recoveryDistance > 0)) return 'Distance de récupération invalide.';
  }
  return null;
}

// ---- Résumés affichés dans l'éditeur ----

export const ROLE_LABELS = { warmup: 'Échauffement', main: 'Étape', cooldown: 'Retour au calme' } as const;

export function stepValueLabel(step: ApiRunBlockStep) {
  if (step.mode === 'duration') return step.duration ? formatDuration(step.duration * 60) : '—';
  if (!step.distance) return '—';
  return step.distance < 1 ? `${Math.round(step.distance * 1000)} m` : `${formatDecimal(step.distance, step.distance % 1 ? 1 : 0)} km`;
}

export function stepTargetLabel(step: ApiRunBlockStep, vma?: number) {
  if (paceMode(step) === 'fixed') return step.pace ? `${step.pace} /km` : 'Allure libre';
  const percent = stepPercent(step);
  const zone = step.paceSource?.zone ? PACE_ZONES[step.paceSource.zone]?.label : undefined;
  const pace = paceFromPercent(vma, percent);
  return [zone, percent ? `${percent} % VMA` : null, pace ? `${pace} /km` : null].filter(Boolean).join(' · ');
}

export function recoveryLabel(step: ApiRunBlockStep) {
  if (!step.recoveryMode) return undefined;
  const value =
    step.recoveryMode === 'duration'
      ? (() => {
          const seconds = parseDurationText(step.recoveryDuration);
          return seconds ? formatDuration(seconds) : step.recoveryDuration || '—';
        })()
      : step.recoveryDistance
        ? `${Math.round(step.recoveryDistance * 1000)} m`
        : '—';
  return [`Récup ${value}`, step.recoveryDescription?.trim()].filter(Boolean).join(' · ');
}
