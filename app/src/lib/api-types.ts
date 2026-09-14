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
  fcmax?: number;
  height?: number;
  weight?: number;
  hasCompletedOnboarding?: boolean;
};

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
    circuit?: { exercises?: unknown[] };
    superset?: { pairs?: { a?: unknown; b?: unknown }[] };
    estimatedDuration?: number;
  };
  status: 'planned' | 'completed' | 'skipped';
  feeling: number | null;
  generatedBy: 'ai' | 'manual' | 'coach';
  createdBy: string | null;
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
  paceSource?: { mode?: string | null; zone?: string | null; vmaPercent?: number | null } | null;
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

/** Séance planifiée détaillée (GET /api/planning/:id, exercices peuplés). */
export type ApiPlannedRunDetail = Omit<ApiPlannedRun, 'strengthPlan'> & {
  warmup?: string;
  mainWorkout?: string;
  cooldown?: string;
  runBlocks?: ApiRunBlock[];
  linkedRun?: string | { _id: string } | null;
  strengthPlan?: {
    exercises?: ApiPlanExercise[];
    circuit?: { name?: string; rounds?: number; restBetweenRounds?: number; exercises?: ApiPlanExercise[] };
    superset?: { name?: string; sets?: number; restBetweenSets?: number; pairs?: { a?: ApiPlanExercise; b?: ApiPlanExercise }[] };
    estimatedDuration?: number;
  };
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
  plannedSnapshot?: { title: string | null; coach: string | null };
  stravaData?: ApiStravaData;
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
  otherParticipant?: ApiUserRef & { isOnline: boolean };
  lastMessage?: { content: string; type: 'text' | 'image' | 'document'; sentAt: string | null };
  unreadCount: number;
};

export type ApiMessage = {
  _id: string;
  content: string;
  type: 'text' | 'image' | 'document';
  sender: ApiUserRef | string;
  createdAt: string;
};
