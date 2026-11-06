// Modèle d'édition des séances de vélo et de natation : étapes avec une clé stable pour
// l'interface, valeurs par défaut par sport, et passage au format de l'API.
import type { ApiSportBlock, ApiSportStep } from '../core/api-types';
import { formatSwimPace, parseSwimPace, zonesFor, type EnduranceSport } from './sport-blocks';

export type EditableSportStep = ApiSportStep & { key: string };
export type EditableSportBlock = EditableSportStep & { children?: EditableSportStep[] };

let seed = 0;
const nextKey = () => `s${Date.now().toString(36)}${(seed++).toString(36)}`;

const zone = (sport: EnduranceSport, key: string) => zonesFor(sport).find((item) => item.key === key)!;

function step(sport: EnduranceSport, role: ApiSportStep['role'], zoneKey: string, volume: number, extra: Partial<ApiSportStep> = {}): EditableSportStep {
  const { low, high } = zone(sport, zoneKey);
  return {
    key: nextKey(),
    role,
    label: '',
    duration: sport === 'bike' ? volume : null,
    distance: sport === 'swim' ? volume : null,
    intensityMode: sport === 'bike' ? 'ftp' : 'css',
    intensityLow: low,
    intensityHigh: high,
    ramp: false,
    cadence: '',
    position: '',
    stroke: sport === 'swim' ? 'crawl' : '',
    equipment: [],
    repetitions: 1,
    description: '',
    recoveryMode: null,
    recoverySeconds: null,
    recoveryIntensity: null,
    recoveryDescription: '',
    ...extra,
  };
}

export const newSportWarmup = (sport: EnduranceSport): EditableSportBlock =>
  sport === 'bike'
    ? step('bike', 'warmup', 'endurance', 900, { ramp: true, intensityLow: 50, intensityHigh: 70 })
    : step('swim', 'warmup', 'souple', 400);

export const newSportCooldown = (sport: EnduranceSport): EditableSportBlock =>
  sport === 'bike' ? step('bike', 'cooldown', 'recup', 600) : step('swim', 'cooldown', 'souple', 200, { stroke: '4n' });

export const newSportStep = (sport: EnduranceSport): EditableSportBlock =>
  sport === 'bike' ? step('bike', 'main', 'tempo', 1200) : step('swim', 'main', 'endurance', 400);

export function newSportChild(sport: EnduranceSport): EditableSportStep {
  return sport === 'bike'
    ? step('bike', 'main', 'seuil', 600, { recoveryMode: 'duration', recoverySeconds: 300, recoveryIntensity: 55 })
    : step('swim', 'main', 'seuil', 100, { recoveryMode: 'rest', recoverySeconds: 15 });
}

export function newSportRepeat(sport: EnduranceSport): EditableSportBlock {
  return { ...step(sport, 'main', sport === 'bike' ? 'seuil' : 'seuil', 0), repetitions: sport === 'bike' ? 3 : 10, children: [newSportChild(sport)] };
}

export const defaultSportBlocks = (sport: EnduranceSport): EditableSportBlock[] => [newSportWarmup(sport), newSportRepeat(sport), newSportCooldown(sport)];

export const toEditableSport = (blocks: ApiSportBlock[] | undefined): EditableSportBlock[] =>
  [...(blocks ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((block) => ({
      ...block,
      key: nextKey(),
      children: block.children?.length ? block.children.map((child) => ({ ...child, key: nextKey() })) : undefined,
    }));

function toApiStep({ key, ...rest }: EditableSportStep, order: number): ApiSportStep {
  return { ...rest, repetitions: Math.max(1, rest.repetitions ?? 1), order };
}

export const toSportPayload = (blocks: EditableSportBlock[]): ApiSportBlock[] =>
  blocks.map((block, order) => {
    const { children, ...rest } = block;
    const out: ApiSportBlock = toApiStep(rest, order);
    if (children?.length) out.children = children.map((child, index) => ({ ...toApiStep(child, index), role: block.role }));
    return out;
  });

/** Un message pour le coach si une étape n'a pas de volume, sinon null. */
export function validateSport(blocks: EditableSportBlock[], sport: EnduranceSport): string | null {
  if (!blocks.length) return 'Ajoutez au moins une étape.';
  const steps = blocks.flatMap((block) => (block.children?.length ? block.children : [block]));
  const empty = steps.some((item) => (sport === 'bike' ? !item.duration : !item.distance && !item.duration));
  if (empty) return sport === 'bike' ? 'Chaque étape a besoin d’une durée.' : 'Chaque série a besoin d’une distance.';
  return null;
}

// ---------- Saisie des durées ----------

/** Durée affichée dans un champ : « 10 » (minutes rondes) ou « 1:30 ». */
export function durationInput(seconds?: number | null) {
  if (!seconds) return '';
  if (seconds % 60 === 0) return String(seconds / 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** « 10 » → 10 min, « 1:30 » ou « 1'30 » → 90 s, « 45s » → 45 s. */
export function parseMinutesInput(text: string): number | null {
  const value = text.trim().toLowerCase().replace(',', '.');
  if (!value) return null;
  const seconds = value.match(/^(\d+)\s*s(ec)?$/);
  if (seconds) return Number(seconds[1]);
  const clock = value.match(/^(\d+)\s*[:'’′]\s*(\d{1,2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const minutes = Number(value.replace(/\s*min$/, ''));
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null;
}

/** Repos de natation : « 15 » → 15 s ; départ : « 1'50 » → 110 s. */
export const restInput = (seconds?: number | null, sendoff = false) =>
  !seconds ? '' : sendoff || seconds >= 60 ? formatSwimPace(seconds) : String(seconds);

export const parseRestInput = (text: string): number | null => parseSwimPace(text) ?? null;
