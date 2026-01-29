// Types pour la musculation

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'full_body';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'resistance_band'
  | 'other';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type StrengthSessionType =
  | 'upper_body'
  | 'lower_body'
  | 'full_body'
  | 'push'
  | 'pull'
  | 'legs'
  | 'core'
  | 'hiit'
  | 'other';

// Exercice de la bibliothèque
export interface Exercise {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  instructions?: string;
  muscleGroups: MuscleGroup[];
  primaryMuscle: MuscleGroup;
  equipment: Equipment;
  difficulty: Difficulty;
  videoUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  createdBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Set d'un exercice (une série)
export interface ExerciseSet {
  reps: number;
  weight?: number; // kg
  rpe?: number; // 1-10
  notes?: string;
}

// Entrée d'exercice dans une séance
export interface ExerciseEntry {
  exercise: Exercise | string; // Peut être l'objet ou juste l'ID
  sets: ExerciseSet[];
  order: number;
  notes?: string;
}

// Séance de musculation loggée
export interface StrengthSession {
  _id?: string;
  user: string;
  date: Date;
  duration?: number; // minutes
  sessionType: StrengthSessionType;
  exercises: ExerciseEntry[];
  notes?: string;
  feeling?: number; // 1-10
  linkedPlannedSession?: string;
  // Virtuals
  totalSets?: number;
  totalReps?: number;
  totalVolume?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Plan de musculation (pour séances planifiées)
export interface StrengthPlanExercise {
  exercise: Exercise | string;
  targetSets: number;
  targetReps: string; // "8-12" format
  targetWeight?: number;
  notes?: string;
}

export interface StrengthPlan {
  exercises: StrengthPlanExercise[];
  estimatedDuration?: number;
}

// Stats de musculation
export interface StrengthStats {
  period: string;
  startDate: Date;
  endDate: Date;
  stats: {
    totalSessions: number;
    totalDuration: number;
    totalSets: number;
    totalReps: number;
    totalVolume: number;
    avgSessionDuration: number;
    avgSetsPerSession: number;
  };
  muscleFrequency: Record<MuscleGroup, number>;
  sessionTypeFrequency: Record<StrengthSessionType, number>;
}

// Labels pour l'affichage
export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Pectoraux',
  back: 'Dos',
  shoulders: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Avant-bras',
  core: 'Abdominaux',
  quadriceps: 'Quadriceps',
  hamstrings: 'Ischio-jambiers',
  glutes: 'Fessiers',
  calves: 'Mollets',
  full_body: 'Corps complet'
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barre',
  dumbbell: 'Haltères',
  kettlebell: 'Kettlebell',
  machine: 'Machine',
  cable: 'Câble/Poulie',
  bodyweight: 'Poids du corps',
  resistance_band: 'Élastique',
  other: 'Autre'
};

export const SESSION_TYPE_LABELS: Record<StrengthSessionType, string> = {
  upper_body: 'Haut du corps',
  lower_body: 'Bas du corps',
  full_body: 'Corps complet',
  push: 'Push (Poussée)',
  pull: 'Pull (Tirage)',
  legs: 'Jambes',
  core: 'Abdos / Core',
  hiit: 'HIIT',
  other: 'Autre'
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé'
};
