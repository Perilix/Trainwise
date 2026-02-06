import { PlannedSession } from '../services/planning.service';

export interface Athlete {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
  runningLevel?: string;
  goal?: string;
  joinedAt: Date;
}

export interface AthleteDetail extends Athlete {
  weeklyFrequency?: number;
  injuries?: string;
  availableDays?: string[];
  preferredTime?: string;
  age?: number;
  gender?: string;
  recentStats: {
    weeklyDistance: number;
    weeklyRuns: number;
    streak: number;
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
  month: number;
  year: number;
}
