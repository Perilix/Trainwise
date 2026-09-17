// Séance planifiée détaillée : blocs de course (profil d'intensité, déroulé) et plan de musculation.
import type { ApiPlanExercise, ApiPlannedRunDetail, ApiRunBlock, ApiRunBlockStep } from '@/lib/api-types';
import { PACE_ZONES } from '@/lib/pace-zones';
import { formatDuration } from '@/lib/sessions';

import { mapPlanned } from './mappers';
import { blocksToSegments, fallbackPct, orderedBlocks, parseDurationText, stepPct } from './run-blocks';
import type { ExerciseBlockRef, PlanExercise, PlannedSessionDetail, RunBlockView, StrengthPlanView } from './types';

const ROLE_LABELS = { warmup: 'Échauffement', main: 'Corps de séance', cooldown: 'Retour au calme' } as const;

export const MUSCLE_LABELS: Record<string, string> = {
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

const formatDistance = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${String(Number(km.toFixed(2))).replace('.', ',')} km`);

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
  // Les totaux manquants sont estimés depuis les blocs par `mapPlanned`.
  const base = mapPlanned(raw, coachName, vma);
  const running = raw.activityType === 'running';
  const segments = running ? blocksToSegments(raw.runBlocks ?? [], vma) : [];
  const linkedRunId = typeof raw.linkedRun === 'string' ? raw.linkedRun : (raw.linkedRun?._id ?? undefined);

  return {
    ...base,
    sessionType: raw.sessionType,
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
