// Bibliothèque d'exercices de musculation (exercices publics et ceux créés par le coach).
import { MUSCLE_LABELS } from '@/features/athlete/session-detail';
import { useSessionQuery } from '@/features/auth/use-session-query';
import { api } from '@/lib/api';
import type { ApiExercise } from '@/lib/api-types';

export const MUSCLE_FILTERS = Object.entries(MUSCLE_LABELS);

const sampleExercises: ApiExercise[] = [
  { _id: 'ex-squat', name: 'Squat barre', primaryMuscle: 'quadriceps', equipment: 'barbell' },
  { _id: 'ex-bulgarian', name: 'Fente bulgare', primaryMuscle: 'glutes', equipment: 'dumbbell' },
  { _id: 'ex-rdl', name: 'Soulevé de terre roumain', primaryMuscle: 'hamstrings', equipment: 'barbell' },
  { _id: 'ex-hip-thrust', name: 'Hip thrust', primaryMuscle: 'glutes', equipment: 'barbell' },
  { _id: 'ex-calf', name: 'Mollets debout', primaryMuscle: 'calves', equipment: 'machine' },
  { _id: 'ex-plank', name: 'Planche', primaryMuscle: 'core', equipment: 'bodyweight' },
  { _id: 'ex-side-plank', name: 'Gainage latéral', primaryMuscle: 'core', equipment: 'bodyweight' },
  { _id: 'ex-step-up', name: 'Montée sur banc', primaryMuscle: 'quadriceps', equipment: 'dumbbell' },
  { _id: 'ex-nordic', name: 'Nordic hamstring curl', primaryMuscle: 'hamstrings', equipment: 'bodyweight' },
  { _id: 'ex-pushup', name: 'Pompes', primaryMuscle: 'chest', equipment: 'bodyweight' },
  { _id: 'ex-row', name: 'Rowing haltère', primaryMuscle: 'back', equipment: 'dumbbell' },
  { _id: 'ex-pullup', name: 'Tractions', primaryMuscle: 'back', equipment: 'bodyweight' },
  { _id: 'ex-press', name: 'Développé militaire', primaryMuscle: 'shoulders', equipment: 'barbell' },
  { _id: 'ex-burpee', name: 'Burpees', primaryMuscle: 'full_body', equipment: 'bodyweight' },
  { _id: 'ex-kb-swing', name: 'Kettlebell swing', primaryMuscle: 'full_body', equipment: 'kettlebell' },
  { _id: 'ex-dead-bug', name: 'Dead bug', primaryMuscle: 'core', equipment: 'bodyweight' },
];

const byName = (list: ApiExercise[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

export function useExerciseLibrary() {
  return useSessionQuery(
    'exercises:library',
    async () => byName(await api<ApiExercise[]>('/api/exercises', { query: { limit: 500 } })),
    () => byName(sampleExercises),
  );
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function filterExercises(list: ApiExercise[], search: string, muscle: string | null) {
  const query = normalize(search.trim());
  return list.filter((exercise) => (!muscle || exercise.primaryMuscle === muscle || exercise.muscleGroups?.includes(muscle)) && (!query || normalize(exercise.name).includes(query)));
}
