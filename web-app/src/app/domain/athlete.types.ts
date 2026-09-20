// Modèles de vue de la partie athlète : ce que les écrans affichent, indépendamment du format de l'API.
import type { PhaseComparison } from './planned-vs-done';
import type { Segment } from './sessions';

export type Sport = 'running' | 'strength';
export type PlannedBy = 'coach' | 'athlete';
export type SessionStatus = 'planned' | 'done' | 'skipped';

export type PlannedSession = {
  id: string;
  date: string; // AAAA-MM-JJ
  sport: Sport;
  title: string;
  description?: string;
  distanceKm?: number;
  durationMin?: number;
  paceSecPerKm?: number;
  exercisesCount?: number;
  plannedBy: PlannedBy;
  coachName?: string;
  status: SessionStatus;
  /** Ce que le coach annonce comme difficulté, sur 10. */
  expectedFeeling?: number;
  /** Profil de la séance (échauffement, blocs, retour au calme) : vide hors course à pied. */
  segments: Segment[];
};

/** Corps de POST /api/planning pour une séance ajoutée par l'athlète. */
export type NewPlannedSession = {
  date: string; // AAAA-MM-JJ
  activityType: Sport;
  sessionType: string;
  targetDistance?: number;
  targetDuration?: number;
  targetPace?: string;
  description?: string;
};

export type CoachInvitation = { id: string; coachName: string; initials: string; email?: string };

export type ExerciseBlockRef = { kind: 'single' | 'circuit' | 'superset'; pairIndex: number | null; slot: 'a' | 'b' | null };

export type PlanExercise = {
  key: string;
  exerciseId: string;
  name: string;
  muscle?: string;
  sets?: number;
  reps?: string; // "8-12"
  weight?: number; // kg
  rest?: string; // texte libre du coach
  notes?: string;
  block: ExerciseBlockRef;
};

export type StrengthPlanView = {
  exercises: PlanExercise[];
  circuit?: { name?: string; rounds: number; restBetweenRoundsSec: number; exercises: PlanExercise[] };
  superset?: { name?: string; sets: number; restBetweenSetsSec: number; pairs: { a?: PlanExercise; b?: PlanExercise }[] };
  estimatedDuration?: number;
};

export type RunStepView = {
  key: string;
  label: string; // "400 m", "20 min"
  paceLabel?: string; // "3:32 /km"
  recoveryLabel?: string;
  note?: string;
  pct: number; // % VMA estimé
};

export type RunBlockView = {
  key: string;
  role: 'warmup' | 'main' | 'cooldown';
  roleLabel: string;
  repetitions: number;
  steps: RunStepView[];
  recoveryLabel?: string;
  note?: string;
  durationSec: number;
};

export type PlannedSessionDetail = PlannedSession & {
  sessionType: string;
  blocks: RunBlockView[];
  segments: Segment[];
  textPlan: { label: string; text: string }[];
  strength?: StrengthPlanView;
  linkedRunId?: string;
};

export type Activity = {
  id: string;
  date: string;
  startTime?: string; // "08:12"
  sport: Sport;
  title: string;
  distanceKm?: number;
  durationSec: number;
  paceSecPerKm?: number;
  avgHr?: number;
  setsCount?: number;
  feeling?: number; // 1 à 10
  fromStrava: boolean;
  /** Tracé encodé, absent pour une séance sans GPS. */
  polyline?: string | null;
};

export type WeekDay = {
  date: string;
  status: 'done' | 'planned' | 'rest';
  isToday: boolean;
};

export type CoachSummary = {
  name: string;
  initials: string;
  online: boolean;
  lastMessage?: string;
};

export type AthleteHome = {
  firstName: string;
  initials: string;
  motto: string;
  streakWeeks: number;
  today?: PlannedSession;
  week: WeekDay[];
  weekStats: { runs: number; distanceKm: number; durationSec: number };
  upcoming: PlannedSession[];
  recent: Activity[];
  coach?: CoachSummary;
  strava: { connected: boolean; lastSyncLabel?: string };
};

/** Un jour du rail « semaine » (chat, fiche) : ce qui est prévu et ce qui a été fait. */
export type WeekPlanDay = {
  iso: string;
  isToday: boolean;
  sessions: PlannedSession[];
  activities: Activity[];
};

export type CalendarMarker = 'done' | 'coach' | 'athlete' | 'competition';

export type PlanningMonth = {
  year: number;
  monthIndex: number; // 0 = janvier
  today: string;
  markers: Record<string, CalendarMarker>;
  competitionPriority: Record<string, 'A' | 'B' | 'C'>;
  sessionsByDay: Record<string, PlannedSession[]>;
  activitiesByDay: Record<string, Activity[]>;
  stats: { planned: number; done: number; distanceKm: number };
};

export type KmSplit = {
  km: number;
  paceSecPerKm: number;
  avgHr?: number;
  elevation?: number; // dénivelé du km en m, négatif en descente
};

export type RunDetail = Activity & {
  plannedBy?: PlannedBy;
  coachName?: string;
  maxHr?: number;
  minHr?: number;
  elevationGain?: number;
  notes?: string;
  /** Le retour du coach sur cette séance, s'il en a laissé un. */
  coachFeedback?: { text: string | null; at: string | null };
  splits: KmSplit[];
  paceZones: { label: string; minutes: number }[];
  /** Déroulé réalisé, vide tant que personne ne l'a saisi. */
  blocks: RunBlockView[];
  segments: Segment[];
  /** Déroulé encore issu de la reconstruction automatique des tours Strava. */
  blocksAuto: boolean;
  /** La séance prévue figée au rapprochement, quand il y en a eu un. */
  planned?: {
    title?: string;
    blocks: RunBlockView[];
    segments: Segment[];
    phases: PhaseComparison[];
  };
};

export type RunsPeriod = 'week' | 'month' | 'year';

export type RunsOverview = {
  periodLabel: string;
  listTitle: string;
  distanceKm: number;
  trendLabel?: string;
  /** `true` en hausse, `false` en baisse, absent quand la comparaison n'a pas de sens. */
  trendUp?: boolean;
  /** `offset` : nombre de périodes en arrière, 0 = période en cours. */
  bars: { label: string; distanceKm: number; selected: boolean; offset: number }[];
  stats: { runs: number; avgPaceSecPerKm?: number; durationSec: number };
  runs: Activity[];
};

export type Competition = {
  id: string;
  name: string;
  date: string;
  discipline?: string;
  priority: 'A' | 'B' | 'C';
  goal?: string;
  weeksLeftLabel: string;
};

export type AthleteProfile = {
  fullName: string;
  initials: string;
  email: string;
  level: string;
  runsPerWeek?: number;
  vma?: number;
  fcMax?: number;
  heightCm?: number;
  weightKg?: number;
  competitions: Competition[];
  strava: { connected: boolean; since?: string };
  coach?: { name: string; since: string };
};

export type NotificationKind =
  | 'session-updated'
  | 'session-planned'
  | 'week-published'
  | 'session-reminder'
  | 'feedback'
  | 'message'
  | 'strava-import'
  | 'session-done'
  | 'friend-request'
  | 'invitation'
  | 'record'
  | 'competition'
  | 'subscription'
  | 'alert'
  | 'other';

/** Les trois sections du centre de notifications. */
export type NotificationCategory = 'priority' | 'training' | 'account';

export type AthleteNotification = {
  id: string;
  kind: NotificationKind;
  category: NotificationCategory;
  title: string;
  body: string;
  timeLabel: string;
  group: 'today' | 'yesterday' | 'week' | 'older';
  unread: boolean;
  actionUrl?: string;
};

export type ChatMessage = {
  id: string;
  fromMe: boolean;
  text: string;
  /** Ligne posée par l'app — une arrivée, un départ — et non par une personne. */
  system?: boolean;
  /** Qui parle — affiché dans les discussions de groupe uniquement. */
  senderName?: string;
  senderInitials?: string;
  timeLabel?: string;
  dayLabel?: string;
  sending?: boolean; // envoyé, pas encore confirmé par le serveur
  /** Séance citée : carte cliquable sous le message. */
  session?: CitedSession;
};

export type CitedSession = { kind: 'planned' | 'run' | 'strength'; id: string; sport?: Sport; title: string; meta?: string };
