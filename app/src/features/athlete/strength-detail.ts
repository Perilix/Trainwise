// Lecture d'une séance de renforcement déjà enregistrée : ce qui a été fait.
import type { ApiStrengthSessionDetail } from '@/lib/api-types';

import { entriesFromSession, groupEntries, type LogEntry, type LogSection } from './strength-log';

export type StrengthTotals = { sets: number; reps: number; volumeKg: number };

/**
 * Le volume de la séance, tel que l'API l'a enregistré.
 *
 * On ne compte que les séries réellement saisies : celles que le plan du coach
 * proposait mais que l'athlète n'a pas cochées n'ont pas eu lieu.
 */
export function sessionTotals(session: ApiStrengthSessionDetail): StrengthTotals {
  const totals = { sets: 0, reps: 0, volumeKg: 0 };
  (session.exercises ?? []).forEach((entry) =>
    (entry.sets ?? []).forEach((set) => {
      totals.sets += 1;
      totals.reps += set.reps ?? 0;
      totals.volumeKg += (set.reps ?? 0) * (set.weight ?? 0);
    }),
  );
  return totals;
}

/** Les exercices de la séance, groupés comme à la saisie (circuits, super-sets). */
export const sessionSections = (session: ApiStrengthSessionDetail): LogSection[] => groupEntries(entriesFromSession(session));

/** Les séries saisies d'un exercice — les autres n'ont jamais été faites. */
export const recordedSets = (entry: LogEntry) => entry.sets.filter((set) => set.done);

/** « 4 × 10 @ 60 kg » : ce que le coach demandait pour cet exercice. */
export function targetGoal(entry: LogEntry) {
  const { target } = entry;
  return [
    target.sets && target.reps ? `${target.sets} × ${target.reps}` : target.reps,
    target.weight ? `${target.weight} kg` : null,
    target.rest ? `récup ${target.rest}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
