// Porté depuis web-app/src/app/domain/exercises.ts.
// Bibliothèque d'exercices : le catalogue Trainwise (public) et les exercices perso
// d'un coach, plus la lecture d'une liste collée depuis un tableur pour les importer.
import { MUSCLE_LABELS } from '@/features/athlete/session-detail';
import type { ApiExercise, ApiExerciseInput } from '@/lib/api-types';

export const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'Barre',
  dumbbell: 'Haltères',
  kettlebell: 'Kettlebell',
  machine: 'Machine',
  cable: 'Poulie',
  bodyweight: 'Poids du corps',
  resistance_band: 'Élastique',
  other: 'Autre',
};

export const MUSCLE_OPTIONS = Object.entries(MUSCLE_LABELS).map(([value, label]) => ({ value, label }));
export const EQUIPMENT_OPTIONS = Object.entries(EQUIPMENT_LABELS).map(([value, label]) => ({ value, label }));

export const isMine = (exercise: ApiExercise, coachId: string | undefined) =>
  !!coachId && !!exercise.createdBy && exercise.createdBy === coachId;

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Ce que les coachs écrivent dans leurs tableurs, en plus des libellés exacts.
const MUSCLE_ALIASES: Record<string, string> = {
  pecs: 'chest',
  pectoraux: 'chest',
  dos: 'back',
  epaules: 'shoulders',
  deltoides: 'shoulders',
  abdos: 'core',
  abdominaux: 'core',
  gainage: 'core',
  sangle: 'core',
  quadris: 'quadriceps',
  quads: 'quadriceps',
  cuisses: 'quadriceps',
  ischios: 'hamstrings',
  ischio: 'hamstrings',
  fessiers: 'glutes',
  fessier: 'glutes',
  mollets: 'calves',
  mollet: 'calves',
  bras: 'biceps',
  'avant bras': 'forearms',
  'full body': 'full_body',
  'corps complet': 'full_body',
};

const EQUIPMENT_ALIASES: Record<string, string> = {
  barre: 'barbell',
  halteres: 'dumbbell',
  haltere: 'dumbbell',
  kettlebell: 'kettlebell',
  kb: 'kettlebell',
  machine: 'machine',
  poulie: 'cable',
  cable: 'cable',
  'poids du corps': 'bodyweight',
  pdc: 'bodyweight',
  aucun: 'bodyweight',
  elastique: 'resistance_band',
  elastiques: 'resistance_band',
};

function matchLabel(raw: string, labels: Record<string, string>, aliases: Record<string, string>) {
  const value = normalize(raw);
  if (!value) return undefined;
  if (aliases[value]) return aliases[value];
  const exact = Object.entries(labels).find(([key, label]) => normalize(label) === value || key === value);
  if (exact) return exact[0];
  const partial = Object.entries(labels).find(([, label]) => normalize(label).startsWith(value) || value.startsWith(normalize(label)));
  return partial?.[0];
}

export type ImportRow = ApiExerciseInput & { line: number; muscleLabel?: string; equipmentLabel?: string };

/**
 * Une ligne par exercice : « Nom ; muscle ; matériel ; lien vidéo », colonnes séparées
 * par un point-virgule ou une tabulation (copier-coller depuis Excel ou Sheets).
 * Seul le nom est obligatoire ; une première ligne d'en-tête « Nom … » est ignorée.
 */
export function parseExerciseList(text: string): ImportRow[] {
  const rows: ImportRow[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const cells = raw.split(/\t|;/).map((cell) => cell.trim());
    const name = cells[0];
    if (!name) return;
    if (index === 0 && normalize(name) === 'nom') return;
    const primaryMuscle = cells[1] ? matchLabel(cells[1], MUSCLE_LABELS, MUSCLE_ALIASES) : undefined;
    const equipment = cells[2] ? matchLabel(cells[2], EQUIPMENT_LABELS, EQUIPMENT_ALIASES) : undefined;
    const videoUrl = cells.slice(1).join(' ').match(/https?:\/\/\S+/i)?.[0];
    rows.push({
      line: index + 1,
      name,
      primaryMuscle,
      muscleGroups: primaryMuscle ? [primaryMuscle] : [],
      equipment: equipment ?? 'other',
      videoUrl,
      muscleLabel: primaryMuscle ? MUSCLE_LABELS[primaryMuscle] : undefined,
      equipmentLabel: equipment ? EQUIPMENT_LABELS[equipment] : undefined,
    });
  });
  return rows;
}
