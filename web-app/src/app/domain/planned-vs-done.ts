// Comparaison phase par phase entre la séance prévue et la sortie réalisée.
//
// Les totaux (distance, durée, allure moyenne) ne disent pas grand-chose d'une
// séance à intervalles : 10 km à 5:10 de moyenne, c'est aussi bien un footing
// qu'un 10 × 400. On compare donc échauffement, corps de séance et retour au
// calme séparément — c'est là que l'athlète lit s'il a tenu ses allures.
import type { ApiRunBlock, ApiRunBlockStep } from '../core/api-types';
import { formatDecimal, formatPace, paceToSeconds } from '../core/format';
import { formatDuration } from './sessions';

export type PhaseSide = {
  /** « 4,0 km », « 2 × 12 min », « 10 × 1min30 ». */
  volume: string;
  /** Allure de référence de la phase, en secondes par km. */
  paceSec?: number;
  paceLabel?: string;
};

export type PhaseComparison = {
  role: 'warmup' | 'main' | 'cooldown';
  label: string;
  planned?: PhaseSide;
  done?: PhaseSide;
  /** Écart d'allure mis en mots, seulement s'il dépasse la tolérance. */
  paceGap?: string;
  /** Écart de volume mis en mots (distance ou durée selon la phase). */
  volumeGap?: string;
  ok: boolean;
};

const ROLES = ['warmup', 'main', 'cooldown'] as const;
const LABELS: Record<(typeof ROLES)[number], string> = {
  warmup: 'Échauffement',
  main: 'Corps de séance',
  cooldown: 'Retour au calme',
};

// Au-delà, l'écart mérite d'être signalé.
const PACE_TOLERANCE_SEC = 10;
const DISTANCE_TOLERANCE_KM = 0.5;
const DURATION_TOLERANCE_MIN = 3;

const stepsOf = (block: ApiRunBlock): ApiRunBlockStep[] => (block.children?.length ? block.children : [block]);

const repetitions = (block: ApiRunBlock) => Math.max(1, block.repetitions ?? 1);

const stepLabel = (step: ApiRunBlockStep) =>
  step.mode === 'duration' ? formatDuration((step.duration ?? 0) * 60) : `${formatDecimal(step.distance ?? 0, (step.distance ?? 0) % 1 ? 1 : 0)} km`;

/** Distance (km) et durée (s) d'une phase, répétitions comprises. */
function phaseTotals(blocks: ApiRunBlock[]) {
  let distanceKm = 0;
  let durationSec = 0;
  for (const block of blocks) {
    const times = repetitions(block);
    for (const step of stepsOf(block)) {
      const stepTimes = times * Math.max(1, step.repetitions ?? 1);
      if (step.mode === 'duration') durationSec += (step.duration ?? 0) * 60 * stepTimes;
      else distanceKm += (step.distance ?? 0) * stepTimes;
    }
  }
  return { distanceKm, durationSec };
}

/** Allure de référence : la plus rapide du corps de séance, la moyenne ailleurs. */
function phasePace(blocks: ApiRunBlock[], role: string) {
  const paces = blocks
    .flatMap(stepsOf)
    .map((step) => paceToSeconds(step.pace ?? null))
    .filter((value): value is number => Boolean(value));
  if (!paces.length) return undefined;
  if (role === 'main') return Math.min(...paces);
  return Math.round(paces.reduce((sum, value) => sum + value, 0) / paces.length);
}

function describeSide(blocks: ApiRunBlock[], role: string): PhaseSide | undefined {
  if (!blocks.length) return undefined;

  // Un bloc répété se lit « 2 × 12 min » ; sinon on donne le total de la phase.
  const repeated = blocks.find((block) => repetitions(block) > 1 || (block.children?.length ?? 0) > 1);
  let volume: string;
  if (repeated) {
    const steps = stepsOf(repeated);
    const inner = steps.length === 1 ? stepLabel(steps[0]) : steps.map(stepLabel).join(' + ');
    volume = repetitions(repeated) > 1 ? `${repetitions(repeated)} × ${inner}` : inner;
  } else {
    const { distanceKm, durationSec } = phaseTotals(blocks);
    volume = distanceKm > 0 ? `${formatDecimal(distanceKm, distanceKm % 1 ? 1 : 0)} km` : formatDuration(durationSec);
  }

  const paceSec = phasePace(blocks, role);
  return { volume, paceSec, paceLabel: paceSec ? `${formatPace(paceSec)} /km` : undefined };
}

const signedMinutes = (seconds: number) => `${seconds > 0 ? '+' : '−'}${Math.abs(Math.round(seconds / 60))} min`;
const signedKm = (km: number) => `${km > 0 ? '+' : '−'}${formatDecimal(Math.abs(km), 1)} km`;

/**
 * Une ligne par phase présente d'un côté ou de l'autre. Une phase prévue mais
 * absente du réalisé (ou l'inverse) reste affichée : c'est une information.
 */
export function comparePhases(planned: ApiRunBlock[], done: ApiRunBlock[]): PhaseComparison[] {
  return ROLES.flatMap((role) => {
    const plannedBlocks = planned.filter((block) => block.role === role);
    const doneBlocks = done.filter((block) => block.role === role);
    if (!plannedBlocks.length && !doneBlocks.length) return [];

    const plannedSide = describeSide(plannedBlocks, role);
    const doneSide = describeSide(doneBlocks, role);

    let paceGap: string | undefined;
    let ok = true;
    if (plannedSide?.paceSec && doneSide?.paceSec) {
      // Une allure plus basse est plus rapide : on inverse la lecture de l'écart.
      const gap = doneSide.paceSec - plannedSide.paceSec;
      if (Math.abs(gap) >= 3) paceGap = `${Math.abs(Math.round(gap))} s/km plus ${gap < 0 ? 'vite' : 'lent'}`;
      ok = Math.abs(gap) <= PACE_TOLERANCE_SEC;
    }

    let volumeGap: string | undefined;
    if (plannedBlocks.length && doneBlocks.length) {
      const plannedTotals = phaseTotals(plannedBlocks);
      const doneTotals = phaseTotals(doneBlocks);
      if (plannedTotals.distanceKm > 0 && doneTotals.distanceKm > 0) {
        const gap = doneTotals.distanceKm - plannedTotals.distanceKm;
        if (Math.abs(gap) >= 0.2) volumeGap = signedKm(gap);
        if (Math.abs(gap) > DISTANCE_TOLERANCE_KM) ok = false;
      } else if (plannedTotals.durationSec > 0 && doneTotals.durationSec > 0) {
        const gap = doneTotals.durationSec - plannedTotals.durationSec;
        if (Math.abs(gap) >= 60) volumeGap = signedMinutes(gap);
        if (Math.abs(gap) > DURATION_TOLERANCE_MIN * 60) ok = false;
      }
    } else {
      // Phase manquante d'un côté : impossible de parler d'écart, mais ce n'est pas conforme.
      ok = false;
    }

    return [{ role, label: LABELS[role], planned: plannedSide, done: doneSide, paceGap, volumeGap, ok }];
  });
}
