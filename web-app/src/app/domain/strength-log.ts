// Saisie d'une séance de musculation à partir du plan : une ligne par série, cochée une fois faite.
import { parseDecimal } from '../core/format';

import type { ExerciseBlockRef, PlanExercise, StrengthPlanView } from './athlete.types';

export type LogSet = { reps: string; weight: string; done: boolean };

export type LogEntry = {
  key: string;
  exerciseId: string;
  name: string;
  muscle?: string;
  context?: string; // "Circuit · 3 tours", "Super-set 1A"
  block: ExerciseBlockRef;
  target: { sets?: number; reps?: string; weight?: number; rest?: string };
  sets: LogSet[];
};

// "8-12" → "8" : la saisie part du bas de la fourchette.
const firstNumber = (reps?: string) => String(parseInt(reps ?? '', 10) || 10);

function entryFor(exercise: PlanExercise, count: number, context?: string): LogEntry {
  const total = Math.max(1, count);
  return {
    key: exercise.key,
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    muscle: exercise.muscle,
    context,
    block: exercise.block,
    target: { sets: total, reps: exercise.reps, weight: exercise.weight, rest: exercise.rest },
    sets: Array.from({ length: total }, () => ({
      reps: firstNumber(exercise.reps),
      weight: exercise.weight ? String(exercise.weight).replace('.', ',') : '',
      done: false,
    })),
  };
}

export function entriesFromPlan(plan: StrengthPlanView): LogEntry[] {
  const entries = plan.exercises.map((exercise) => entryFor(exercise, exercise.sets ?? 3));
  const { circuit, superset } = plan;

  // Même ordre que le détail de la séance : exercices, super-set, circuit.
  if (superset) {
    superset.pairs.forEach((pair, pairIndex) =>
      (['a', 'b'] as const).forEach((slot) => {
        const exercise = pair[slot];
        if (exercise) entries.push(entryFor(exercise, superset.sets, `Super-set ${pairIndex + 1}${slot.toUpperCase()}`));
      }),
    );
  }
  if (circuit) {
    entries.push(...circuit.exercises.map((exercise) => entryFor(exercise, circuit.rounds, `Circuit · ${circuit.rounds} tours`)));
  }
  return entries;
}

type PayloadInput = {
  plannedId: string;
  sessionType: string;
  plan: StrengthPlanView;
  entries: LogEntry[];
  durationMin: number;
  feeling: number;
  notes: string;
};

/** Corps de POST /api/strength/sessions : seules les séries cochées sont enregistrées. */
export function buildStrengthPayload({ plannedId, sessionType, plan, entries, durationMin, feeling, notes }: PayloadInput) {
  const exercises = entries
    .map((entry, order) => ({
      exercise: entry.exerciseId,
      order,
      block: entry.block,
      target: entry.target,
      sets: entry.sets
        .filter((set) => set.done)
        .map((set) => ({ reps: Math.max(1, Math.round(parseDecimal(set.reps) ?? 1)), weight: parseDecimal(set.weight) })),
    }))
    .filter((entry) => entry.sets.length > 0);

  return {
    date: new Date().toISOString(),
    duration: durationMin,
    sessionType,
    exercises,
    circuit: plan.circuit ? { name: plan.circuit.name, rounds: plan.circuit.rounds, restBetweenRounds: plan.circuit.restBetweenRoundsSec } : undefined,
    superset: plan.superset ? { name: plan.superset.name, sets: plan.superset.sets, restBetweenSets: plan.superset.restBetweenSetsSec } : undefined,
    notes: notes.trim() || undefined,
    feeling,
    linkedPlannedSession: plannedId,
  };
}

export type StrengthSessionPayload = ReturnType<typeof buildStrengthPayload>;
