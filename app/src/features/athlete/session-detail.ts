// Séance planifiée détaillée : blocs de course (profil d'intensité, déroulé) et plan de musculation.
import type { ApiPlanExercise, ApiPlannedRunDetail, ApiRunBlock, ApiRunBlockStep } from '@/lib/api-types';
import { PACE_ZONES } from '@/lib/pace-zones';
import { formatDuration, totals, type Segment } from '@/lib/sessions';

import { mapPlanned, paceToSeconds } from './mappers';
import type { ExerciseBlockRef, PlanExercise, PlannedSessionDetail, RunBlockView, StrengthPlanView } from './types';

const ROLE_LABELS = { warmup: 'Échauffement', main: 'Corps de séance', cooldown: 'Retour au calme' } as const;

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Pectoraux',
  back: 'Dos',
  shoulders: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Avant-bras',
  core: 'Sangle abdominale',
  quadriceps: 'Quadriceps',
  hamstrings: 'Ischio-jambiers',
  glutes: 'Fessiers',
  calves: 'Mollets',
  full_body: 'Corps complet',
};

// Sans allure donnée, on suppose un footing tranquille ; sans VMA, une VMA moyenne (le profil reste indicatif).
const EASY_PACE_SEC = 390;
const EASY_RECOVERY_PACE_SEC = 420;
const DEFAULT_VMA = 16;

/** Durée saisie en texte libre par le coach : "1min30", "90s", "2 min", "1'30", "1:30" → secondes. */
export function parseDurationText(text?: string | null): number | undefined {
  if (!text) return undefined;
  const value = text.trim().toLowerCase().replace(',', '.');
  const clock = value.match(/^(\d+)\s*[:'′]\s*(\d{1,2})\s*["″]?$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const minutes = value.match(/(\d+(?:\.\d+)?)\s*(?:min|mn|m(?![a-z]))/);
  const seconds = value.match(/(\d+)\s*(?:s|sec)\b/) ?? value.match(/(?:min|mn|m)\s*(\d{1,2})$/);
  if (minutes || seconds) return Math.round((minutes ? Number(minutes[1]) * 60 : 0) + (seconds ? Number(seconds[1]) : 0));
  const bare = Number(value);
  return Number.isFinite(bare) && value !== '' ? Math.round(bare) : undefined;
}

const clampPct = (pct: number) => Math.min(115, Math.max(40, Math.round(pct)));

const formatDistance = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${String(Number(km.toFixed(2))).replace('.', ',')} km`);

const fallbackPct = (role: ApiRunBlockStep['role']) => (role === 'main' ? 85 : 62);

function stepPct(step: ApiRunBlockStep, vma: number | undefined, fallback: number) {
  if (step.paceSource?.vmaPercent) return clampPct(step.paceSource.vmaPercent);
  const pace = paceToSeconds(step.pace);
  return pace ? clampPct((3600 / pace / (vma ?? DEFAULT_VMA)) * 100) : fallback;
}

/** Allure de l'étape en s/km : fixe si donnée, sinon déduite du % VMA, sinon footing. */
function stepPaceSec(step: ApiRunBlockStep, vma: number | undefined) {
  const fixed = paceToSeconds(step.pace);
  if (fixed) return fixed;
  const pct = step.paceSource?.vmaPercent;
  return pct ? 3600 / (((vma ?? DEFAULT_VMA) * pct) / 100) : EASY_PACE_SEC;
}

const stepSeconds = (step: ApiRunBlockStep, vma: number | undefined) =>
  step.mode === 'duration' ? (step.duration ?? 0) * 60 : (step.distance ?? 0) * stepPaceSec(step, vma);

const stepMeters = (step: ApiRunBlockStep, vma: number | undefined) =>
  step.mode === 'distance' ? (step.distance ?? 0) * 1000 : (((step.duration ?? 0) * 60) / stepPaceSec(step, vma)) * 1000;

function recoverySeconds(step: ApiRunBlockStep) {
  if (step.recoveryMode === 'duration') return parseDurationText(step.recoveryDuration) ?? 0;
  if (step.recoveryMode === 'distance' && step.recoveryDistance) return step.recoveryDistance * (paceToSeconds(step.recoveryPace) ?? EASY_RECOVERY_PACE_SEC);
  return 0;
}

function recoveryLabel(step: ApiRunBlockStep) {
  const detail = step.recoveryDescription?.trim();
  const suffix = detail ? ` · ${detail}` : '';
  if (step.recoveryMode === 'duration' && step.recoveryDuration) {
    const seconds = parseDurationText(step.recoveryDuration);
    return `Récup ${seconds ? formatDuration(seconds) : step.recoveryDuration}${suffix}`;
  }
  if (step.recoveryMode === 'distance' && step.recoveryDistance) {
    return `Récup ${formatDistance(step.recoveryDistance)}${step.recoveryPace ? ` à ${step.recoveryPace} /km` : ''}${suffix}`;
  }
  return detail ? `Récup · ${detail}` : undefined;
}

/** Sans allure calculée (séance type, VMA inconnue) : zone et % de VMA. */
function zoneLabel(step: ApiRunBlockStep) {
  const source = step.paceSource;
  const zone = source?.zone ? PACE_ZONES[source.zone] : undefined;
  const percent = source?.vmaPercent ?? zone?.percent;
  return [zone?.label, percent ? `${percent} % VMA` : null].filter(Boolean).join(' · ') || undefined;
}

const orderedBlocks = (blocks: ApiRunBlock[]) => [...blocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/** Déplie les blocs (répétitions et groupes « Répéter » compris) en segments pour le profil d'intensité. */
export function blocksToSegments(blocks: ApiRunBlock[], vma?: number): Segment[] {
  const segments: Segment[] = [];

  orderedBlocks(blocks).forEach((block, index) => {
    const group = Boolean(block.children?.length);
    const steps = group ? (block.children ?? []) : [block];
    const reps = Math.max(1, block.repetitions ?? 1);
    const kind: Segment['kind'] = block.role === 'warmup' ? 'warmup' : block.role === 'cooldown' ? 'cooldown' : reps > 1 || group ? 'work' : 'steady';

    for (let rep = 0; rep < reps; rep++) {
      const lastRep = rep === reps - 1;
      steps.forEach((step, stepIndex) => {
        segments.push({ kind, sec: stepSeconds(step, vma), pct: stepPct(step, vma, fallbackPct(block.role)), dist: stepMeters(step, vma), block: index });
        const rest = recoverySeconds(step);
        // Pas de récupération après la dernière répétition d'un bloc répété
        const endOfBlock = lastRep && stepIndex === steps.length - 1 && (reps > 1 || group);
        if (rest > 0 && !endOfBlock) segments.push({ kind: 'rest', sec: rest, pct: 50, dist: 0, block: index });
      });
      const groupRest = group && !lastRep ? recoverySeconds(block) : 0;
      if (groupRest > 0) segments.push({ kind: 'rest', sec: groupRest, pct: 50, dist: 0, block: index });
    }
  });

  return segments.filter((segment) => segment.sec > 0);
}

export function describeBlocks(blocks: ApiRunBlock[], vma?: number): RunBlockView[] {
  const segments = blocksToSegments(blocks, vma);

  return orderedBlocks(blocks).map((block, index) => {
    const group = Boolean(block.children?.length);
    const steps = (group ? (block.children ?? []) : [block]).map((step, stepIndex) => ({
      key: `${index}-${stepIndex}`,
      label: step.mode === 'duration' ? formatDuration((step.duration ?? 0) * 60) : formatDistance(step.distance ?? 0),
      paceLabel: step.pace ? `${step.pace} /km` : zoneLabel(step),
      recoveryLabel: group ? recoveryLabel(step) : undefined,
      note: group ? step.description?.trim() || undefined : undefined,
      pct: stepPct(step, vma, fallbackPct(block.role)),
    }));

    return {
      key: String(index),
      role: block.role,
      roleLabel: ROLE_LABELS[block.role],
      repetitions: Math.max(1, block.repetitions ?? 1),
      steps,
      recoveryLabel: recoveryLabel(block),
      note: block.description?.trim() || undefined,
      durationSec: segments.filter((segment) => segment.block === index).reduce((sum, segment) => sum + segment.sec, 0),
    };
  });
}

function planExercise(item: ApiPlanExercise | undefined, key: string, block: ExerciseBlockRef): PlanExercise | null {
  if (!item?.exercise) return null;
  const ref = typeof item.exercise === 'string' ? { _id: item.exercise, name: 'Exercice', primaryMuscle: undefined } : item.exercise;
  return {
    key,
    exerciseId: ref._id,
    name: ref.name,
    muscle: ref.primaryMuscle ? MUSCLE_LABELS[ref.primaryMuscle] : undefined,
    sets: item.targetSets,
    reps: item.targetReps,
    weight: item.targetWeight,
    rest: item.targetRest,
    notes: item.notes?.trim() || undefined,
    block,
  };
}

const isPresent = <T,>(value: T | null): value is T => value !== null;

export function mapStrengthPlan(plan: ApiPlannedRunDetail['strengthPlan']): StrengthPlanView | undefined {
  if (!plan) return undefined;
  const single: ExerciseBlockRef = { kind: 'single', pairIndex: null, slot: null };
  const exercises = (plan.exercises ?? []).map((item, index) => planExercise(item, `single-${index}`, single)).filter(isPresent);

  const circuitExercises = (plan.circuit?.exercises ?? [])
    .map((item, index) => planExercise(item, `circuit-${index}`, { kind: 'circuit', pairIndex: null, slot: null }))
    .filter(isPresent);

  const pairs = (plan.superset?.pairs ?? [])
    .map((pair, pairIndex) => ({
      a: planExercise(pair.a, `superset-${pairIndex}-a`, { kind: 'superset', pairIndex, slot: 'a' }) ?? undefined,
      b: planExercise(pair.b, `superset-${pairIndex}-b`, { kind: 'superset', pairIndex, slot: 'b' }) ?? undefined,
    }))
    .filter((pair) => pair.a || pair.b);

  return {
    exercises,
    circuit: circuitExercises.length
      ? { name: plan.circuit?.name || undefined, rounds: plan.circuit?.rounds ?? 3, restBetweenRoundsSec: plan.circuit?.restBetweenRounds ?? 60, exercises: circuitExercises }
      : undefined,
    superset: pairs.length
      ? { name: plan.superset?.name || undefined, sets: plan.superset?.sets ?? 4, restBetweenSetsSec: plan.superset?.restBetweenSets ?? 90, pairs }
      : undefined,
    estimatedDuration: plan.estimatedDuration,
  };
}

export function mapPlannedDetail(raw: ApiPlannedRunDetail, vma?: number, coachName?: string): PlannedSessionDetail {
  const base = mapPlanned(raw, coachName);
  const running = raw.activityType === 'running';
  const segments = running ? blocksToSegments(raw.runBlocks ?? [], vma) : [];
  const total = totals(segments);
  const linkedRunId = typeof raw.linkedRun === 'string' ? raw.linkedRun : (raw.linkedRun?._id ?? undefined);

  return {
    ...base,
    sessionType: raw.sessionType,
    distanceKm: base.distanceKm ?? (total.dist ? Math.round(total.dist / 100) / 10 : undefined),
    durationMin: base.durationMin ?? (total.sec ? Math.round(total.sec / 60) : undefined),
    blocks: running ? describeBlocks(raw.runBlocks ?? [], vma) : [],
    segments,
    textPlan: [
      { label: 'Échauffement', text: raw.warmup?.trim() ?? '' },
      { label: 'Corps de séance', text: raw.mainWorkout?.trim() ?? '' },
      { label: 'Retour au calme', text: raw.cooldown?.trim() ?? '' },
    ].filter((item) => item.text),
    strength: running ? undefined : mapStrengthPlan(raw.strengthPlan),
    linkedRunId,
  };
}
