// Saisie d'une séance de musculation à partir du plan : une ligne par série, cochée une fois faite.
import { parseDecimal } from '@/lib/format';
import type { ApiStrengthSessionDetail } from '@/lib/api-types';

import type { ExerciseBlockRef, PlanExercise, StrengthPlanView } from './types';

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
  /** Absente quand la séance est créée maintenant : c'est aujourd'hui. */
  date?: string;
  /** Absente quand on complète une séance dont la durée est déjà connue. */
  durationMin?: number;
  feeling: number;
  notes: string;
};

/** Corps de POST /api/strength/sessions : seules les séries cochées sont enregistrées. */
export function buildStrengthPayload({ plannedId, sessionType, plan, entries, date, durationMin, feeling, notes }: PayloadInput) {
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
    date: date ?? new Date().toISOString(),
    duration: durationMin,
    sessionType,
    exercises,
    circuit: plan?.circuit ? { name: plan?.circuit.name, rounds: plan?.circuit.rounds, restBetweenRounds: plan?.circuit.restBetweenRoundsSec } : undefined,
    superset: plan?.superset ? { name: plan?.superset.name, sets: plan?.superset.sets, restBetweenSets: plan?.superset.restBetweenSetsSec } : undefined,
    notes: notes.trim() || undefined,
    feeling,
    linkedPlannedSession: plannedId ?? undefined,
  };
}

export type StrengthSessionPayload = ReturnType<typeof buildStrengthPayload>;

/**
 * Le titre d'une séance enregistrée : celui du coach, repris en tête des notes
 * au moment du rapprochement.
 */
export function sessionTitle(session: ApiStrengthSessionDetail): string {
  const first = (session.notes ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return first && first.length <= 80 ? first : 'Séance de renforcement';
}

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
      context,
      block,
      target: { sets: entry.target?.sets, reps: entry.target?.reps, weight: entry.target?.weight, rest: entry.target?.rest },
      sets: logged.length ? logged : planned,
    };
  });
}

/** Un bloc de la saisie : exercices libres, circuit, ou super-set. */
export type LogSection = {
  key: string;
  kind: 'single' | 'circuit' | 'superset';
  title?: string;
  subtitle?: string;
  /** Les couples d'un super-set, une ligne par couple ; une seule ligne ailleurs. */
  rows: { entry: LogEntry; index: number; slot?: 'A' | 'B' }[][];
};

/**
 * Regroupe les lignes de saisie par bloc.
 *
 * À plat, « Circuit » et « Super-set 1A » ne sont que des étiquettes collées à
 * des cartes identiques : on ne voit pas ce qui va ensemble. Groupés, un
 * circuit se lit comme un circuit, et les deux exercices d'un couple se
 * suivent.
 */
export function groupEntries(entries: LogEntry[]): LogSection[] {
  const sections: LogSection[] = [];
  const singles: LogSection['rows'] = [];
  const circuit: LogSection['rows'] = [];
  const pairs = new Map<number, { entry: LogEntry; index: number; slot?: 'A' | 'B' }[]>();

  entries.forEach((entry, index) => {
    const row = { entry, index, slot: entry.block.slot ? (entry.block.slot.toUpperCase() as 'A' | 'B') : undefined };
    if (entry.block.kind === 'circuit') circuit.push([row]);
    else if (entry.block.kind === 'superset') {
      const key = entry.block.pairIndex ?? 0;
      pairs.set(key, [...(pairs.get(key) ?? []), row]);
    } else singles.push([row]);
  });

  if (singles.length) sections.push({ key: 'single', kind: 'single', rows: singles });

  if (pairs.size) {
    sections.push({
      key: 'superset',
      kind: 'superset',
      title: 'Super-set',
      subtitle: 'Les deux exercices s’enchaînent sans repos.',
      rows: [...pairs.keys()].sort((a, b) => a - b).map((key) => pairs.get(key) ?? []),
    });
  }

  if (circuit.length) {
    const rounds = circuit[0][0].entry.sets.length;
    sections.push({
      key: 'circuit',
      kind: 'circuit',
      title: 'Circuit',
      subtitle: `${rounds} tour${rounds > 1 ? 's' : ''} — on enchaîne les exercices, puis on récupère.`,
      rows: circuit,
    });
  }

  return sections;
}
