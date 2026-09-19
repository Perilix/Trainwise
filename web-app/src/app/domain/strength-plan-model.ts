// Plan de musculation éditable : exercices simples, super-set et circuit.
import { MUSCLE_LABELS } from './session-detail';
import type { ApiExerciseRef, ApiPlanExercise, ApiStrengthPlan } from '../core/api-types';
import { formatDecimal } from '../core/format';

export type EditableExercise = {
  key: string;
  exerciseId: string;
  name: string;
  muscle?: string;
  sets: number;
  reps: string;
  weight: number | null;
  rest: string;
  notes: string;
};

export type EditablePair = { key: string; a: EditableExercise | null; b: EditableExercise | null };
export type EditableSuperset = { name: string; sets: number; restSec: number; pairs: EditablePair[] };
export type EditableCircuit = { name: string; rounds: number; restSec: number; exercises: EditableExercise[] };
export type EditableStrengthPlan = { exercises: EditableExercise[]; superset: EditableSuperset | null; circuit: EditableCircuit | null };

/** Où se range l'exercice : les séries et la récup ne se règlent qu'en exercice simple. */
export type ExerciseSlot = 'single' | 'superset' | 'circuit';

let sequence = 0;
const nextKey = (prefix: string) => `${prefix}-${++sequence}`;

const DEFAULTS: Record<ExerciseSlot, Pick<EditableExercise, 'sets' | 'reps' | 'rest'>> = {
  single: { sets: 3, reps: '8-12', rest: '90 s' },
  superset: { sets: 1, reps: '10', rest: '' },
  circuit: { sets: 1, reps: '12', rest: '' },
};

const muscleLabel = (ref: ApiExerciseRef) => (ref.primaryMuscle ? MUSCLE_LABELS[ref.primaryMuscle] : undefined);

export const emptyStrengthPlan = (): EditableStrengthPlan => ({ exercises: [], superset: null, circuit: null });
export const newPair = (): EditablePair => ({ key: nextKey('pair'), a: null, b: null });
export const newSuperset = (): EditableSuperset => ({ name: 'Super-set', sets: 4, restSec: 90, pairs: [newPair()] });
export const newCircuit = (): EditableCircuit => ({ name: 'Circuit', rounds: 3, restSec: 60, exercises: [] });

export const exerciseFromLibrary = (ref: ApiExerciseRef, slot: ExerciseSlot): EditableExercise => ({
  key: nextKey('exercise'),
  exerciseId: ref._id,
  name: ref.name,
  muscle: muscleLabel(ref),
  weight: null,
  notes: '',
  ...DEFAULTS[slot],
});

/** Change l'exercice en gardant séries, charge et consignes. */
export const swapExercise = (item: EditableExercise, ref: ApiExerciseRef): EditableExercise => ({ ...item, exerciseId: ref._id, name: ref.name, muscle: muscleLabel(ref) });

function toEditableExercise(item: ApiPlanExercise | undefined, slot: ExerciseSlot): EditableExercise | null {
  if (!item?.exercise) return null;
  const ref = typeof item.exercise === 'string' ? { _id: item.exercise, name: 'Exercice' } : item.exercise;
  return {
    key: nextKey('exercise'),
    exerciseId: ref._id,
    name: ref.name,
    muscle: muscleLabel(ref),
    sets: item.targetSets ?? DEFAULTS[slot].sets,
    reps: item.targetReps ?? '',
    weight: item.targetWeight ?? null,
    rest: item.targetRest ?? '',
    notes: item.notes ?? '',
  };
}

const isPresent = <T>(value: T | null): value is T => value !== null;

export function toEditableStrength(plan?: ApiStrengthPlan | null): EditableStrengthPlan {
  if (!plan) return emptyStrengthPlan();
  const circuitExercises = (plan.circuit?.exercises ?? []).map((item) => toEditableExercise(item, 'circuit')).filter(isPresent);
  const pairs = (plan.superset?.pairs ?? [])
    .map((pair) => ({ key: nextKey('pair'), a: toEditableExercise(pair.a, 'superset'), b: toEditableExercise(pair.b, 'superset') }))
    .filter((pair) => pair.a || pair.b);

  return {
    exercises: (plan.exercises ?? []).map((item) => toEditableExercise(item, 'single')).filter(isPresent),
    superset: pairs.length ? { name: plan.superset?.name || 'Super-set', sets: plan.superset?.sets ?? 4, restSec: plan.superset?.restBetweenSets ?? 90, pairs } : null,
    circuit: circuitExercises.length ? { name: plan.circuit?.name || 'Circuit', rounds: plan.circuit?.rounds ?? 3, restSec: plan.circuit?.restBetweenRounds ?? 60, exercises: circuitExercises } : null,
  };
}

const toApiExercise = (item: EditableExercise): ApiPlanExercise => ({
  exercise: item.exerciseId,
  targetSets: item.sets,
  targetReps: item.reps.trim() || undefined,
  targetWeight: item.weight ?? undefined,
  targetRest: item.rest.trim() || undefined,
  notes: item.notes.trim() || undefined,
});

/** Corps attendu par l'API (identifiants d'exercices) ; un bloc vide est retiré. */
export function toStrengthPayload(plan: EditableStrengthPlan, estimatedDuration?: number): ApiStrengthPlan {
  const pairs = (plan.superset?.pairs ?? []).filter((pair) => pair.a || pair.b);
  return {
    exercises: plan.exercises.map(toApiExercise),
    superset:
      plan.superset && pairs.length
        ? {
            name: plan.superset.name.trim() || 'Super-set',
            sets: plan.superset.sets,
            restBetweenSets: plan.superset.restSec,
            pairs: pairs.map((pair) => ({ a: pair.a ? toApiExercise(pair.a) : undefined, b: pair.b ? toApiExercise(pair.b) : undefined })),
          }
        : null,
    circuit:
      plan.circuit && plan.circuit.exercises.length
        ? { name: plan.circuit.name.trim() || 'Circuit', rounds: plan.circuit.rounds, restBetweenRounds: plan.circuit.restSec, exercises: plan.circuit.exercises.map(toApiExercise) }
        : null,
    estimatedDuration,
  };
}

export const strengthExerciseCount = (plan: EditableStrengthPlan) =>
  plan.exercises.length + (plan.circuit?.exercises.length ?? 0) + (plan.superset?.pairs.reduce((count, pair) => count + (pair.a ? 1 : 0) + (pair.b ? 1 : 0), 0) ?? 0);

export function validateStrength(plan: EditableStrengthPlan): string | null {
  if (plan.superset && !plan.superset.pairs.some((pair) => pair.a || pair.b)) return 'Choisissez les exercices du super-set, ou retirez-le.';
  if (plan.circuit && !plan.circuit.exercises.length) return 'Ajoutez des exercices au circuit, ou retirez-le.';
  if (!strengthExerciseCount(plan)) return 'Ajoutez au moins un exercice.';
  return null;
}

/** « 4 × 8-10 · 60 kg · récup 90 s » (exercice simple) ou « 12 · 40 kg » (super-set, circuit). */
export function exerciseMeta(item: EditableExercise, slot: ExerciseSlot) {
  const reps = item.reps.trim();
  const volume = slot === 'single' ? `${item.sets} × ${reps || '?'}` : reps;
  const weight = item.weight ? `${formatDecimal(item.weight, item.weight % 1 ? 1 : 0)} kg` : null;
  const rest = slot === 'single' && item.rest.trim() ? `récup ${item.rest.trim()}` : null;
  return [volume, weight, rest].filter(Boolean).join(' · ');
}
