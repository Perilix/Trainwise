// Modèles de vue de l'espace coach.
import type { Sport } from '@/features/athlete/types';
import type { ApiAthleteStatus, ApiPackageType } from '@/lib/api-types';

export type AthleteStatus = ApiAthleteStatus;
export type PackageType = ApiPackageType;

export type CoachAthleteRow = {
  id: string;
  name: string;
  initials: string;
  email: string;
  status: AthleteStatus;
  offer: string;
  subtitle: string;
};

export type SubscriptionRequestRow = {
  id: string;
  athleteId: string;
  name: string;
  initials: string;
  offer: string;
  requestedLabel: string;
};

export type CoachHome = {
  stats: { athletes: number; pendingInvitations: number; sessionsThisWeek: number; sessionsTotal: number };
  requests: SubscriptionRequestRow[];
  athletes: CoachAthleteRow[];
};

export type AthleteFiche = {
  id: string;
  name: string;
  initials: string;
  sinceLabel?: string;
  status: AthleteStatus;
  trend: 'improving' | 'declining' | 'stable';
  statusSinceLabel?: string;
  lastActivityLabel: string;
  skippedCount: number;
  avgFeeling?: number;
  weeklyVolume: number;
  baselineWeeklyVolume: number;
  weeks: (AthleteStatus | null)[]; // 8 dernières semaines, la plus ancienne en premier
  physical: { heightCm?: number; weightKg?: number; vma?: number; fcMax?: number };
  running: { level?: string; frequency?: number; injuries?: string };
  competition?: { name: string; dateLabel: string; priority: 'A' | 'B' | 'C'; goal?: string };
  strength: { goal?: string; type?: string; frequency?: number };
  availability: { days: boolean[]; preferredTime?: string };
  activities: { id: string; sport: Sport; title: string; dateLabel: string; value: string; feeling?: number }[];
};

export type InviteOverview = {
  code: string | null;
  pending: { id: string; name: string; initials: string; sentLabel: string }[];
};

export type AthleteSearchRow = {
  id: string;
  name: string;
  initials: string;
  email?: string;
  state: 'available' | 'pending' | 'following' | 'taken';
};
