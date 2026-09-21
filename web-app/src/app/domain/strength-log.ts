// Saisie d'une séance de musculation à partir du plan : une ligne par série, cochée une fois faite.
import type { ApiStrengthSessionDetail } from '../core/api-types';
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
  /** Absent quand on complète une séance déjà enregistrée. */
  plannedId?: string;
  sessionType: string;
  /** Absent quand on complète une séance déjà enregistrée : sa structure suffit. */
  plan?: StrengthPlanView;
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
    circuit: plan?.circuit ? { name: plan.circuit.name, rounds: plan.circuit.rounds, restBetweenRounds: plan.circuit.restBetweenRoundsSec } : undefined,
    superset: plan?.superset ? { name: plan.superset.name, sets: plan.superset.sets, restBetweenSets: plan.superset.restBetweenSetsSec } : undefined,
    notes: notes.trim() || undefined,
    feeling,
    linkedPlannedSession: plannedId ?? undefined,
  };
}

export type StrengthSessionPayload = ReturnType<typeof buildStrengthPayload>;

/**
 * Reprend une séance déjà enregistrée pour la compléter.
 *
 * Une séance importée de Strava puis rapprochée du plan du coach arrive avec
 * ses exercices mais sans séries : l'athlète vient les remplir après coup.
 */
export function entriesFromSession(session: ApiStrengthSessionDetail): LogEntry[] {
  return (session.exercises ?? []).map((entry, index) => {
    const raw = entry.exercise;
    const ref = typeof raw === 'string' ? { _id: raw, name: 'Exercice' } : (raw ?? { _id: '', name: 'Exercice' });
    const block: ExerciseBlockRef = {
      kind: entry.block?.kind ?? 'single',
      pairIndex: entry.block?.pairIndex ?? null,
      slot: entry.block?.slot ?? null,
    };
    const context =
      block.kind === 'circuit' ? 'Circuit' : block.kind === 'superset' ? `Super-set ${(block.pairIndex ?? 0) + 1}${(block.slot ?? 'a').toUpperCase()}` : undefined;

    // Les séries déjà saisies restent cochées ; sinon on prépare celles que le
    // coach demandait, à remplir.
    const logged = (entry.sets ?? []).map((set) => ({ reps: String(set.reps ?? ''), weight: set.weight ? String(set.weight) : '', done: true }));
    const planned = Array.from({ length: Math.max(1, entry.target?.sets ?? 3) }, () => ({
      reps: String(parseInt(entry.target?.reps ?? '', 10) || 10),
      weight: entry.target?.weight ? String(entry.target.weight) : '',
      done: false,
    }));

    return {
      key: `done-${index}`,
      exerciseId: ref._id,
      name: ref.name,
      muscle: undefined,
      context,
      block,
      target: { sets: entry.target?.sets, reps: entry.target?.reps, weight: entry.target?.weight, rest: entry.target?.rest },
      sets: logged.length ? logged : planned,
    };
  });
}
