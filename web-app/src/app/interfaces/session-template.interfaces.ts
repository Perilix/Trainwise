import { Exercise } from './strength.interfaces';

export type Sport = 'running' | 'strength';

export type RunSessionType =
  | 'endurance' | 'fractionne' | 'tempo' | 'recuperation'
  | 'sortie_longue' | 'cotes' | 'fartlek';

export type StrengthSessionType =
  | 'upper_body' | 'lower_body' | 'full_body'
  | 'push' | 'pull' | 'legs' | 'core' | 'hiit';

export type SessionType = RunSessionType | StrengthSessionType;

export type PaceMode = 'absolute' | 'vmaPercent' | 'zone';

export type PaceZoneKey =
  | 'recovery' | 'recoveryActive' | 'endurance' | 'marathon' | 'semi'
  | 'threshold' | 'tenK' | 'fiveK' | 'vma' | 'speed';

export interface PaceZone {
  key: PaceZoneKey;
  label: string;
  defaultPercent: number;
  minPercent: number;
  maxPercent: number;
}

export interface PaceConfig {
  mode: PaceMode;
  zone?: PaceZoneKey | null;
  vmaPercent?: number | null;
  absolute?: string | null; // "m:ss"
}

export interface TemplateRunBlock {
  role: 'warmup' | 'main' | 'cooldown';
  mode: 'distance' | 'duration';
  distance?: number | null;
  duration?: number | null;
  pace: PaceConfig;
  repetitions: number;
  description?: string;
  recoveryMode?: 'distance' | 'duration' | null;
  recoveryDistance?: number | null;
  recoveryDuration?: string | null;
  recoveryPace?: PaceConfig | null;
  recoveryDescription?: string;
  order: number;
  // Étapes enfants d'un bloc « Répéter » multi-étapes (un niveau d'imbrication)
  children?: TemplateRunBlock[];
}

export interface StrengthExerciseEntry {
  exercise: string | Exercise;
  targetSets?: number;
  targetReps?: string;
  targetWeight?: number;
  targetRest?: string;
  notes?: string;
}

export interface StrengthCircuit {
  name?: string;
  rounds?: number;
  restBetweenRounds?: number;
  exercises: StrengthExerciseEntry[];
}

export interface StrengthSuperset {
  name?: string;
  sets?: number;
  restBetweenSets?: number;
  pairs: { a: StrengthExerciseEntry; b: StrengthExerciseEntry }[];
}

export interface StrengthPlan {
  exercises?: StrengthExerciseEntry[];
  circuit?: StrengthCircuit;
  superset?: StrengthSuperset;
  estimatedDuration?: number;
}

export interface SessionTemplate {
  _id: string;
  name: string;
  description?: string;
  sport: Sport;
  sessionType: SessionType;
  targetDistance?: number | null;
  targetDuration?: number | null;
  warmup?: string;
  mainWorkout?: string;
  cooldown?: string;
  runBlocks?: TemplateRunBlock[];
  strengthPlan?: StrengthPlan | null;
  coach: string;
  tags?: string[];
  isPublic?: boolean;
  usageCount?: number;
  lastUsedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssignmentBlockPreview {
  blockIndex: number;
  role: 'warmup' | 'main' | 'cooldown';
  paceConfig: PaceConfig;
  resolvedPace: string | null;
  recoveryPaceConfig?: PaceConfig | null;
  resolvedRecoveryPace: string | null;
}

export interface AthleteAssignmentPreview {
  athleteId: string;
  firstName: string;
  lastName: string;
  vma: number | null;
  missingVma: boolean;
  blocks: AssignmentBlockPreview[];
}

export interface AssignmentPreviewResponse {
  template: SessionTemplate;
  previews: AthleteAssignmentPreview[];
}

export interface BlockOverride {
  pace?: string | null;
  recoveryPace?: string | null;
}

export interface AssignmentEntry {
  athleteId: string;
  date: string; // ISO
  paceOverrides?: Record<number, BlockOverride>;
}
