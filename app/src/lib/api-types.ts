// Formats bruts renvoyés par l'API Trainwise (api/src/models, api/src/controllers).
// Seuls les champs utilisés par l'app sont typés.

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
  ftp?: number | null;
  css?: number | null;
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
  ftp?: number | null;
  css?: number | null;
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
  ftp?: number | null;
  css?: number | null;
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

/** Abonnement du coach (GET /api/coach/billing). Le mobile ne fait que l'afficher. */
export type ApiCoachBilling = {
  configured: boolean;
  plans: { id: string; name: string; athletes: number | null; groups: number | null; customAlerts: boolean }[];
  subscription: {
    planId: string;
    cycle: 'monthly' | 'yearly';
    status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
    renewsOn: string | null;
    cancelAtPeriodEnd: boolean;
    managed: boolean;
  };
  usage: { athletes: number; athleteLimit: number | null; groups: number; groupLimit: number | null };
};

/** Le groupe derrière une conversation (GET /api/chat/conversations/:id/group). */
export type ApiConversationGroup = {
  name: string;
  color: GroupColor;
  race: { name: string; date: string | null } | null;
};

/** Planifié et réalisé, semaine par semaine (GET /api/coach/stats/weekly). */
export type ApiWeeklyStats = {
  weeks: { label: string; planned: number; done: number }[];
  totals: { planned: number; done: number };
  completionRate: number;
};

/** Seuils d'alerte du coach : à partir de quand un athlète passe en orange, puis en rouge. */
export type ApiAlertRules = {
  inactivityOrange: number;
  inactivityRed: number;
  skippedOrange: number;
  skippedRed: number;
  feelingOrange: number;
  feelingRed: number;
  volumeDropEnabled: boolean;
  volumeDropPercent: number;
};

/** `editable` est faux quand le plan du coach n'inclut pas les alertes sur mesure. */
export type ApiAlertRulesState = { rules: ApiAlertRules; editable: boolean; planName: string };

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
  activityType: 'running' | 'strength' | 'bike' | 'swim';
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
  /** Difficulté attendue, sur 10 : ce que le coach annonce à l'athlète. */
  expectedFeeling?: number | null;
  generatedBy: 'ai' | 'manual' | 'coach';
  createdBy: string | null;
  // Le calendrier renvoie les séances entières : les blocs servent à estimer
  // distance, durée et allure quand le coach n'a pas rempli les totaux.
  runBlocks?: ApiRunBlock[];
  sportBlocks?: ApiSportBlock[];
  reference?: ApiSportReference | null;
  pool?: '25' | '50' | 'open' | null;
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
export type ApiExercise = ApiExerciseRef & {
  muscleGroups?: string[];
  equipment?: string;
  isPublic?: boolean;
  /** Renseigné pour un exercice perso : l'id du coach qui l'a créé. Absent pour le catalogue. */
  createdBy?: string | null;
  instructions?: string;
  videoUrl?: string;
};

/** Ce qu'un coach saisit pour créer ou modifier un de ses exercices. */
export type ApiExerciseInput = {
  name: string;
  primaryMuscle?: string;
  muscleGroups?: string[];
  equipment?: string;
  instructions?: string;
  videoUrl?: string;
  imageUrl?: string;
  /** Partagé avec tous les coachs ; privé (false) par défaut. */
  isPublic?: boolean;
};

export type ApiStrengthPlan = {
  exercises?: ApiPlanExercise[];
  circuit?: { name?: string; rounds?: number; restBetweenRounds?: number; exercises?: ApiPlanExercise[] } | null;
  superset?: { name?: string; sets?: number; restBetweenSets?: number; pairs?: { a?: ApiPlanExercise; b?: ApiPlanExercise }[] } | null;
  estimatedDuration?: number;
};

/** Séance planifiée détaillée (GET /api/planning/:id, exercices peuplés). */
/** Étape d'une séance de vélo ou de natation (voir api/src/models/sportBlock.schema.js). */
export type ApiSportStep = {
  role: 'warmup' | 'main' | 'cooldown';
  label?: string;
  duration?: number | null; // secondes (vélo)
  distance?: number | null; // mètres (natation)
  intensityMode?: 'ftp' | 'watts' | 'hr' | 'rpe' | 'css' | 'pace' | null;
  intensityLow?: number | null;
  intensityHigh?: number | null;
  ramp?: boolean;
  cadence?: string;
  position?: '' | 'assis' | 'danseuse';
  stroke?: string;
  equipment?: string[];
  repetitions?: number;
  description?: string;
  recoveryMode?: 'duration' | 'rest' | 'sendoff' | null;
  recoverySeconds?: number | null;
  recoveryIntensity?: number | null; // vélo : % FTP
  recoveryDescription?: string;
  order?: number;
};

export type ApiSportBlock = ApiSportStep & { children?: ApiSportStep[] };

/** FTP (watts) et CSS (s / 100 m) de l'athlète, figées à l'assignation de la séance. */
export type ApiSportReference = { ftp?: number | null; css?: number | null };

export type ApiPlannedRunDetail = Omit<ApiPlannedRun, 'strengthPlan'> & {
  warmup?: string;
  mainWorkout?: string;
  cooldown?: string;
  runBlocks?: ApiRunBlock[];
  linkedRun?: string | { _id: string } | null;
  /** Vélo, natation : la sortie Strava qui a validé la séance (peuplée par l'API). */
  linkedOtherActivity?: ApiOtherActivity | string | null;
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
  sport: 'running' | 'strength' | 'bike' | 'swim';
  sessionType: string;
  targetDistance: number | null;
  targetDuration: number | null;
  /** Difficulté attendue, sur 10 : ce que l'athlète devrait ressentir. */
  expectedFeeling?: number | null;
  runBlocks: ApiTemplateRunBlock[];
  sportBlocks?: ApiSportBlock[];
  pool?: '25' | '50' | 'open' | null;
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

/** Retour du coach sur une séance réalisée. */
export type ApiCoachFeedback = { text: string | null; coach?: string | { _id: string } | null; at: string | null } | null;

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
  /** Le retour du coach sur cette séance, s'il en a laissé un. */
  coachFeedback?: ApiCoachFeedback;
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
  /** Le retour du coach sur cette séance, s'il en a laissé un. */
  coachFeedback?: ApiCoachFeedback;
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

/** Activité Strava d'un autre sport (vélo, natation…), recopiée telle quelle. */
export type ApiOtherActivity = {
  _id: string;
  stravaActivityId: number;
  sportType: string; // sport_type Strava : Ride, Swim, GravelRide…
  name?: string;
  description?: string;
  date: string;
  startDateLocal: string | null;
  movingTime: number | null; // s
  elapsedTime: number | null; // s
  distance: number | null; // km
  elevationGain: number | null; // m
  averageSpeed: number | null; // m/s
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  averageWatts: number | null;
};

export type ApiCalendarData = {
  runs: ApiRun[];
  plannedRuns: ApiPlannedRun[];
  strengthSessions: ApiStrengthSession[];
  /** Absent tant que l'API déployée ne les renvoie pas. */
  otherActivities?: ApiOtherActivity[];
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

/** Séance citée dans un message, figée à l'envoi. */
export type ApiSessionRef = {
  kind: 'planned' | 'run' | 'strength';
  id: string;
  sport?: 'running' | 'strength' | 'bike' | 'swim';
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
