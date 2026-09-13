// Modèles de vue de la partie athlète : ce que les écrans affichent, indépendamment du format de l'API.

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

export type CalendarMarker = 'done' | 'coach' | 'athlete' | 'competition';

export type PlanningMonth = {
  year: number;
  monthIndex: number; // 0 = janvier
  today: string;
  markers: Record<string, CalendarMarker>;
  competitionPriority: Record<string, 'A' | 'B' | 'C'>;
  sessionsByDay: Record<string, PlannedSession[]>;
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
  splits: KmSplit[];
  paceZones: { label: string; minutes: number }[];
};

export type RunsPeriod = 'week' | 'month' | 'year';

export type RunsOverview = {
  periodLabel: string;
  listTitle: string;
  distanceKm: number;
  trendLabel?: string;
  trendUp?: boolean;
  bars: { label: string; distanceKm: number; selected: boolean }[];
  stats: { runs: number; avgPaceSecPerKm?: number; durationSec: number };
  runs: Activity[];
};

export type Competition = {
  id: string;
  name: string;
  date: string;
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
  | 'message'
  | 'sessions-planned'
  | 'strava-import'
  | 'friend-request'
  | 'invitation'
  | 'record'
  | 'competition'
  | 'other';

export type AthleteNotification = {
  id: string;
  kind: NotificationKind;
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
  timeLabel?: string;
  dayLabel?: string;
};
