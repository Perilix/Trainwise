// Séance de musculation réalisée : ce qui était prévu face à ce qui a été fait.
import { MUSCLE_LABELS } from '@/features/athlete/session-detail';
import type { ApiStrengthEntry, ApiStrengthSessionDetail } from '@/lib/api-types';
import { formatDecimal } from '@/lib/format';

export type DoneSet = { reps: number; weight?: number };

export type DoneExercise = {
  key: string;
  name: string;
  muscle?: string;
  /** Consigne du coach, telle qu'elle était au moment de la séance. */
  targetLabel?: string;
  doneLabel: string;
  sets: DoneSet[];
  totalReps: number;
  /** Volume soulevé (kg × répétitions), absent au poids du corps. */
  volumeKg?: number;
  /** Écart aux séries prévues : négatif quand l'athlète en a fait moins. */
  setsDelta?: number;
  notes?: string;
};

export type DoneBlock = { kind: 'single' | 'circuit' | 'superset'; title: string; meta?: string; exercises: DoneExercise[] };

export type StrengthDoneView = {
  id: string;
  date: string;
  durationMin?: number;
  feeling?: number;
  notes?: string;
  totalSets: number;
  totalVolumeKg: number;
  blocks: DoneBlock[];
};

const setLabel = (sets: DoneSet[]) => {
  if (!sets.length) return 'aucune série';
  const reps = sets.map((set) => set.reps);
  const weights = [...new Set(sets.map((set) => set.weight ?? 0))];
  const sameReps = reps.every((value) => value === reps[0]);
  const volume = sameReps ? `${sets.length} × ${reps[0]}` : `${sets.length} séries · ${reps.join(', ')}`;
  const weight = weights.length === 1 && weights[0] ? `${formatDecimal(weights[0], weights[0] % 1 ? 1 : 0)} kg` : null;
  return [volume, weight].filter(Boolean).join(' · ');
};

const targetLabel = (target?: ApiStrengthEntry['target']) => {
  if (!target) return undefined;
  const volume = target.sets && target.reps ? `${target.sets} × ${target.reps}` : target.reps;
  const weight = target.weight ? `${formatDecimal(target.weight, target.weight % 1 ? 1 : 0)} kg` : null;
  return [volume, weight].filter(Boolean).join(' · ') || undefined;
};

function mapEntry(entry: ApiStrengthEntry, index: number): DoneExercise {
  const ref = typeof entry.exercise === 'string' || !entry.exercise ? null : entry.exercise;
  const sets = (entry.sets ?? []).map((set) => ({ reps: set.reps, weight: set.weight }));
  const volumeKg = sets.reduce((sum, set) => sum + (set.weight ?? 0) * set.reps, 0);
  return {
    key: `${ref?._id ?? 'exercice'}-${index}`,
    name: ref?.name ?? 'Exercice',
    muscle: ref?.primaryMuscle ? MUSCLE_LABELS[ref.primaryMuscle] : undefined,
    targetLabel: targetLabel(entry.target),
    doneLabel: setLabel(sets),
    sets,
    totalReps: sets.reduce((sum, set) => sum + set.reps, 0),
    volumeKg: volumeKg || undefined,
    setsDelta: entry.target?.sets ? sets.length - entry.target.sets : undefined,
    notes: entry.notes || undefined,
  };
}

const restLabel = (seconds?: number) => (seconds ? `repos ${seconds} s` : null);

export function mapStrengthDone(session: ApiStrengthSessionDetail): StrengthDoneView {
  const entries = [...(session.exercises ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(mapEntry);
  const kinds = (session.exercises ?? []).map((entry) => entry.block?.kind ?? 'single');

  const pick = (kind: 'single' | 'circuit' | 'superset') => entries.filter((_, index) => kinds[index] === kind);
  const blocks: DoneBlock[] = [];
  const singles = pick('single');
  if (singles.length) blocks.push({ kind: 'single', title: 'Exercices', exercises: singles });

  const supersetExercises = pick('superset');
  if (supersetExercises.length) {
    blocks.push({
      kind: 'superset',
      title: session.superset?.name || 'Super-set',
      meta: [session.superset?.sets ? `${session.superset.sets} séries` : null, restLabel(session.superset?.restBetweenSets)].filter(Boolean).join(' · ') || undefined,
      exercises: supersetExercises,
    });
  }

  const circuitExercises = pick('circuit');
  if (circuitExercises.length) {
    blocks.push({
      kind: 'circuit',
      title: session.circuit?.name || 'Circuit',
      meta: [session.circuit?.rounds ? `${session.circuit.rounds} tours` : null, restLabel(session.circuit?.restBetweenRounds)].filter(Boolean).join(' · ') || undefined,
      exercises: circuitExercises,
    });
  }

  return {
    id: session._id,
    date: session.date,
    durationMin: session.duration || undefined,
    feeling: session.feeling ?? undefined,
    notes: session.notes?.trim() || undefined,
    totalSets: entries.reduce((sum, exercise) => sum + exercise.sets.length, 0),
    totalVolumeKg: Math.round(entries.reduce((sum, exercise) => sum + (exercise.volumeKg ?? 0), 0)),
    blocks,
  };
}
