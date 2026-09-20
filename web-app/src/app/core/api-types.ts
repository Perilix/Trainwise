// Formats bruts renvoyés par l'API Trainwise (api/src/models, api/src/controllers).
// Miroir de app/src/lib/api-types.ts : les deux clients parlent au même backend.
export type ApiUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  role: 'user' | 'admin' | 'coach';
  runningLevel?: 'debutant' | 'intermediaire' | 'confirme' | 'expert';
  weeklyFrequency?: number;
  vma?: number;
  fcmax?: number;
  height?: number;
  weight?: number;
  /** Blessures ou contraintes, en texte libre. */
  injuries?: string;
  /** Jours d'entraînement possibles : 'lundi', 'mardi'… */
  availableDays?: string[];
  /** Créneau préféré : 'matin', 'midi', 'soir'. */
  preferredTime?: string;
  hasCompletedOnboarding?: boolean;
  /** Visites guidées déjà vues, par identifiant d'écran. */
  toursSeen?: string[];
  // Profil coach
  disciplines?: string[];
  diplomas?: string[];
  experience?: number;
  bio?: string;
};

export type ApiAthleteStatus = 'green' | 'orange' | 'red';

/** Indicateurs de forme calculés par l'API (api/src/services/athleteStatus.service.js). */
export type ApiStatusData = {
  status: ApiAthleteStatus;
  lastActivityDate: string | null;
  daysSinceActivity: number | null;
  skippedCount: number;
  avgFeeling: number | null;
  weeklyVolume: number; // km, 7 derniers jours
  baselineWeeklyVolume: number; // km, moyenne des 3 semaines précédentes
  volumeDrop: boolean;
};

export type ApiPackageType = 'invited' | 'bronze' | 'silver' | 'gold';

/** Repère visuel d'un groupe, choisi par le coach. */
export type GroupColor = 'rouge' | 'bleu' | 'vert' | 'jaune' | 'orange' | 'violet' | 'rose';

/** Groupe d'athlètes (GET /api/coach/groups). */
export type ApiCoachGroup = {
  id: string;
  name: string;
  color: GroupColor;
  race: { name: string; date: string | null } | null;
  athletes: { id: string; firstName: string; lastName: string }[];
};

export type ApiCoachStats = {
  totalAthletes: number;
  pendingInvitations: number;
  sessionsCreatedThisWeek: number;
  sessionsCreatedTotal: number;
};

export type ApiCoachAthlete = ApiStatusData & {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  runningLevel?: string;
  vma?: number | null;
  nextCompetition: ApiCompetition | null;
  joinedAt: string | null;
  packageType?: ApiPackageType;
};

export type ApiRecentActivity = {
  _id: string;
  type: 'run' | 'strength';
  date: string;
  duration?: number; // min
  feeling?: number;
  distance?: number; // km
  sessionType?: string;
  exerciseCount?: number;
};

export type ApiCoachAthleteDetail = ApiStatusData & {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  runningLevel?: string;
  weeklyFrequency?: number;
  injuries?: string;
  availableDays?: string[];
  preferredTime?: string;
  height?: number;
  weight?: number;
  vma?: number;
  fcmax?: number;
  strengthFrequency?: number;
  strengthGoal?: string;
  strengthType?: string;
  statusTrend: 'improving' | 'declining' | 'stable';
  statusChangedAt: string | null;
  statusHistory: { status: ApiAthleteStatus; date: string }[];
  joinedAt: string | null;
  recentStats: { weeklyDistance: number; weeklyRuns: number; streak: number; weeklyStrengthSessions: number; recentActivities: ApiRecentActivity[] };
};

export type ApiSubscriptionRequest = { _id: string; athlete: ApiUserRef | null; packageType: ApiPackageType; invitedAt: string };

export type ApiPendingInvitation = { _id: string; athlete: ApiUserRef | null; invitedAt: string; inviteMethod: 'code' | 'direct' };

export type ApiUserSearchResult = ApiUserRef & { relationStatus: 'pending' | 'accepted' | 'rejected' | 'requested' | null; hasCoach: boolean };

export type AuthResponse = { token: string; user: ApiUser };

export type ApiUserRef = {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  profilePicture?: string;
};

export type ApiPlannedRun = {
  _id: string;
  date: string;
  activityType: 'running' | 'strength';
  sessionType: string;
  targetDistance: number | null; // km
  targetDuration: number | null; // min
  targetPace: string | null; // "5:30"
  title: string | null;
  description?: string;
  strengthPlan?: {
    exercises?: unknown[];
    circuit?: { exercises?: unknown[] } | null;
    superset?: { pairs?: { a?: unknown; b?: unknown }[] } | null;
    estimatedDuration?: number;
  };
  status: 'planned' | 'completed' | 'skipped';
  feeling: number | null;
  generatedBy: 'ai' | 'manual' | 'coach';
  createdBy: string | null;
  // Le calendrier renvoie les séances entières : les blocs servent à estimer
  // distance, durée et allure quand le coach n'a pas rempli les totaux.
  runBlocks?: ApiRunBlock[];
};

export type ApiRunBlockStep = {
  role: 'warmup' | 'main' | 'cooldown';
  mode: 'distance' | 'duration';
  distance?: number | null; // km
  duration?: number | null; // min
  pace?: string | null; // "mm:ss" /km
  repetitions?: number;
  description?: string;
  recoveryMode?: 'distance' | 'duration' | null;
  recoveryDistance?: number | null; // km
  recoveryDuration?: string | null; // texte libre : "1min30"
  recoveryPace?: string | null;
  recoveryDescription?: string;
  order?: number;
  paceSource?: ApiPaceSource | null;
  recoveryPaceSource?: ApiPaceSource | null;
};

/** Origine de l'allure d'une étape planifiée : zone VMA, % VMA ou allure fixe. */
export type ApiPaceSource = {
  mode?: string | null;
  zone?: string | null;
  vmaPercent?: number | null;
  resolvedFromVma?: number | null;
  overridden?: boolean;
};

export type ApiRunBlock = ApiRunBlockStep & { children?: ApiRunBlockStep[] };

export type ApiExerciseRef = { _id: string; name: string; imageUrl?: string; primaryMuscle?: string };

export type ApiPlanExercise = {
  exercise: ApiExerciseRef | string | null;
  targetSets?: number;
  targetReps?: string;
  targetWeight?: number;
  targetRest?: string;
  notes?: string;
};

/** Exercice de la bibliothèque (GET /api/exercises). */
export type ApiExercise = ApiExerciseRef & { muscleGroups?: string[]; equipment?: string; isPublic?: boolean };

export type ApiStrengthPlan = {
  exercises?: ApiPlanExercise[];
  circuit?: { name?: string; rounds?: number; restBetweenRounds?: number; exercises?: ApiPlanExercise[] } | null;
  superset?: { name?: string; sets?: number; restBetweenSets?: number; pairs?: { a?: ApiPlanExercise; b?: ApiPlanExercise }[] } | null;
  estimatedDuration?: number;
};

/** Séance planifiée détaillée (GET /api/planning/:id, exercices peuplés). */
export type ApiPlannedRunDetail = Omit<ApiPlannedRun, 'strengthPlan'> & {
  warmup?: string;
  mainWorkout?: string;
  cooldown?: string;
  runBlocks?: ApiRunBlock[];
  linkedRun?: string | { _id: string } | null;
  strengthPlan?: ApiStrengthPlan;
};

/** Allure d'une étape de séance type : zone VMA, % VMA ou allure fixe. */
export type ApiPaceConfig = { mode?: 'absolute' | 'vmaPercent' | 'zone'; zone?: string | null; vmaPercent?: number | null; absolute?: string | null } | null;

export type ApiTemplateRunBlockStep = Omit<ApiRunBlockStep, 'pace' | 'recoveryPace' | 'paceSource' | 'recoveryPaceSource'> & { pace?: ApiPaceConfig; recoveryPace?: ApiPaceConfig };

export type ApiTemplateRunBlock = ApiTemplateRunBlockStep & { children?: ApiTemplateRunBlockStep[] };

export type ApiSessionTemplate = {
  _id: string;
  name: string;
  description?: string;
  sport: 'running' | 'strength';
  sessionType: string;
  targetDistance: number | null;
  targetDuration: number | null;
  runBlocks: ApiTemplateRunBlock[];
  strengthPlan: ApiPlannedRunDetail['strengthPlan'] | null;
  usageCount: number;
  lastUsedAt: string | null;
  updatedAt: string;
};

export type ApiSplit = {
  split: number;
  distance: number; // m
  movingTime: number; // s
  averageSpeed: number; // m/s
  elevationDifference: number | null;
  averageHeartrate: number | null;
};

export type ApiStravaData = {
  name: string;
  startDateLocal: string | null;
  distance: number; // m
  movingTime: number; // s
  maxHeartrate: number | null;
  totalElevationGain: number | null;
  splits?: ApiSplit[];
  paceZoneDistribution?: Record<string, number>; // secondes par zone
};

export type ApiRun = {
  _id: string;
  date: string;
  distance?: number; // km
  duration?: number; // min
  averagePace?: string;
  averageHeartRate?: number;
  maxHeartRate?: number;
  elevationGain?: number;
  sessionType?: string;
  feeling?: number;
  notes?: string;
  stravaActivityId: number | null;
  /** Tracé encodé (format Google polyline) quand la sortie a un GPS. */
  polyline?: string | null;
  /** Déroulé réalisé : reconstruit depuis les tours Strava, puis modifiable par l'athlète. */
  runBlocks?: ApiRunBlock[];
  /** Vrai tant que les blocs viennent de la reconstruction automatique. */
  blocksAutoReconstructed?: boolean;
  /** Ce que le coach avait prévu, figé au moment où la sortie a été rattachée. */
  plannedSnapshot?: {
    title: string | null;
    coach: string | null;
    sessionType?: string | null;
    targetDistance?: number | null;
    targetDuration?: number | null;
    targetPace?: string | null;
    description?: string | null;
    runBlocks?: ApiRunBlock[];
  };
  stravaData?: ApiStravaData;
};

/** Série réalisée lors d'une séance de musculation. */
export type ApiStrengthSet = { reps: number; weight?: number; rpe?: number; notes?: string };

export type ApiStrengthEntry = {
  exercise: ApiExerciseRef | string | null;
  sets: ApiStrengthSet[];
  order?: number;
  notes?: string;
  block?: { kind?: 'single' | 'circuit' | 'superset'; pairIndex?: number | null; slot?: 'a' | 'b' | null };
  target?: { sets?: number; reps?: string; weight?: number; rest?: string };
};

/** Séance de musculation réalisée (GET /api/coach/athletes/:id/strength-session/:plannedId). */
export type ApiStrengthSessionDetail = ApiStrengthSession & {
  notes?: string;
  exercises: ApiStrengthEntry[];
  circuit?: { name?: string; rounds?: number; restBetweenRounds?: number } | null;
  superset?: { name?: string; sets?: number; restBetweenSets?: number } | null;
  linkedPlannedSession?: string | null;
};

export type ApiStrengthSession = {
  _id: string;
  date: string;
  duration?: number; // min
  sessionType: string;
  feeling?: number;
  stravaActivityId: number | null;
  totalSets: number;
};

export type ApiCompetition = {
  _id: string;
  name: string;
  date: string;
  discipline?: string;
  targetTime: string | null;
  priority: 'A' | 'B' | 'C';
  status: 'upcoming' | 'completed' | 'cancelled';
};

export type ApiCalendarData = {
  runs: ApiRun[];
  plannedRuns: ApiPlannedRun[];
  strengthSessions: ApiStrengthSession[];
  competitions: ApiCompetition[];
  month: number; // 1 à 12
  year: number;
};

export type ApiCoach = ApiUserRef & { connectedSince: string };

export type ApiCoachInvitation = { _id: string; coach: ApiUserRef | null };

export type ApiStravaStatus = { connected: boolean; connectedAt: string | null };

export type ApiNotification = {
  _id: string;
  type: string;
  action: string;
  title: string;
  message: string;
  actionUrl: string | null;
  read: boolean;
  createdAt: string;
};

export type ApiConversation = {
  _id: string;
  type: 'direct' | 'group';
  /** Nom du groupe ; absent pour une conversation directe. */
  name?: string;
  participants?: (ApiUserRef & { role?: 'user' | 'coach' | 'admin' })[];
  otherParticipant?: ApiUserRef & { isOnline: boolean };
  lastMessage?: { content: string; type: 'text' | 'image' | 'document' | 'session' | 'system'; sentAt: string | null };
  unreadCount: number;
};

/** Le groupe derrière une conversation (GET /api/chat/conversations/:id/group). */
export type ApiConversationGroup = {
  name: string;
  color: GroupColor;
  race: { name: string; date: string | null } | null;
};

/** Séance citée dans un message, figée à l'envoi. */
export type ApiSessionRef = {
  kind: 'planned' | 'run' | 'strength';
  id: string;
  sport?: 'running' | 'strength';
  title?: string;
  date?: string;
  meta?: string;
};

export type ApiMessage = {
  _id: string;
  content: string;
  type: 'text' | 'image' | 'document' | 'session' | 'system';
  sender: ApiUserRef | string;
  sessionRef?: ApiSessionRef;
  createdAt: string;
};
