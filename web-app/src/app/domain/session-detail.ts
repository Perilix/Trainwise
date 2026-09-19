// Séance planifiée détaillée : blocs de course (profil d'intensité, déroulé) et plan de musculation.
import type { ApiPlanExercise, ApiPlannedRunDetail } from '../core/api-types';

import { mapPlanned } from './athlete.mappers';
import { blocksToSegments, describeBlocks } from './run-blocks';
import type { ExerciseBlockRef, PlanExercise, PlannedSessionDetail, StrengthPlanView } from './athlete.types';

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
