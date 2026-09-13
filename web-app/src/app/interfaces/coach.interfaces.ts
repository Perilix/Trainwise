import { PlannedSession } from '../services/planning.service';
import { StrengthSession } from './strength.interfaces';
import { PackageType } from './package.interface';
import { Competition } from '../services/competition.service';

export interface Athlete {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
  runningLevel?: string;
  vma?: number | null;
  nextCompetition?: Competition | null;
  joinedAt: Date;
  packageType?: PackageType;
  status?: 'green' | 'orange' | 'red';
  lastActivityDate?: Date | null;
  daysSinceActivity?: number | null;
  skippedCount?: number;
  avgFeeling?: number | null;
  weeklyVolume?: number;
  baselineWeeklyVolume?: number;
  volumeDrop?: boolean;
}

export interface RecentActivity {
  _id: string;
  type: 'run' | 'strength';
  date: Date | string;
  duration?: number;
  feeling?: number;
  notes?: string;
  // Run
  distance?: number;
  averagePace?: string;
  // Strength
  sessionType?: string;
  exerciseCount?: number;
  exercises?: { name: string; sets: number }[];
}

export interface StatusHistoryEntry {
  status: 'green' | 'orange' | 'red';
  date: Date | string;
}

export interface AthleteDetail extends Athlete {
  statusTrend?: 'improving' | 'declining' | 'stable';
  statusChangedAt?: Date | string | null;
  statusHistory?: StatusHistoryEntry[];
  weeklyFrequency?: number;
  injuries?: string;
  availableDays?: string[];
  preferredTime?: string;
  age?: number;
  gender?: string;
  height?: number;
  weight?: number;
  vma?: number;
  fcmax?: number;
  strengthFrequency?: number;
  strengthGoal?: string;
  strengthType?: string;
  recentStats: {
    weeklyDistance: number;
    weeklyRuns: number;
    streak: number;
    weeklyStrengthSessions: number;
    recentActivities: RecentActivity[];
  };
}

export interface CoachInvitation {
  _id: string;
  coach: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string;
  };
  status: 'pending' | 'accepted' | 'rejected';
  invitedAt: Date;
  inviteMethod: 'code' | 'direct';
}

export interface CoachStats {
  totalAthletes: number;
  pendingInvitations: number;
  sessionsCreatedThisWeek: number;
  sessionsCreatedTotal: number;
}

export interface Coach {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
  connectedSince: Date;
}

// Alias pour la compatibilité
export type CoachInfo = Coach;

export interface UserSearchResult {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
  relationStatus: 'pending' | 'accepted' | 'rejected' | null;
  hasCoach: boolean;
}

// Demande d'abonnement envoyée par un athlète (statut "requested"), à valider par le coach
export interface SubscriptionRequest {
  _id: string;
  athlete: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string;
    runningLevel?: string;
    vma?: number;
  };
  status: 'requested';
  packageType: 'bronze' | 'silver' | 'gold';
  invitedAt: Date;
}

export interface PendingInvitation {
  _id: string;
  athlete: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string;
  };
  status: 'pending';
  invitedAt: Date;
  inviteMethod: 'code' | 'direct';
}

export interface CalendarData {
  runs: any[];
  plannedRuns: PlannedSession[];
  strengthSessions: StrengthSession[];
  competitions?: Competition[];
  month: number;
  year: number;
}
