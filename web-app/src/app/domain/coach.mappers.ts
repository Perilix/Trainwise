import { initialsOf } from './athlete.mappers';
import type {
  ApiCoachAthlete,
  ApiCoachAthleteDetail,
  ApiCoachStats,
  ApiCompetition,
  ApiPackageType,
  ApiPendingInvitation,
  ApiRecentActivity,
  ApiSubscriptionRequest,
  ApiUserSearchResult,
} from '../core/api-types';
import { addDays, startOfWeek } from '../core/dates';
import { formatDayMonthYear, formatDayShort, formatDecimal, formatHoursMinutes, toIsoDay } from '../core/format';

import type { AthleteFiche, AthleteSearchRow, AthleteStatus, CoachAthleteLite, CoachHome, InviteOverview } from './coach.types';

export const PACKAGE_LABELS: Record<ApiPackageType, string> = { invited: 'Invité', bronze: 'Suivi', silver: 'Perf', gold: 'Élite' };
export const PACKAGE_PRICES: Partial<Record<ApiPackageType, string>> = { bronze: '49,99 €', silver: '79,99 €', gold: '149,99 €' };

const STATUS_ORDER: Record<AthleteStatus, number> = { red: 0, orange: 1, green: 2 };

const LEVEL_LABELS: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', confirme: 'Confirmé', expert: 'Expert' };
const STRENGTH_GOAL_LABELS: Record<string, string> = {
  force: 'Force',
  hypertrophie: 'Hypertrophie',
  endurance_musculaire: 'Endurance musculaire',
  remise_en_forme: 'Remise en forme',
  fonctionnel: 'Fonctionnel',
  calisthenie: 'Calisthénie',
};
const STRENGTH_TYPE_LABELS: Record<string, string> = { poids_libres: 'Poids libres', machines: 'Machines', bodyweight: 'Poids du corps', crossfit: 'CrossFit', mixte: 'Mixte' };
const STRENGTH_SESSION_LABELS: Record<string, string> = {
  upper_body: 'Renfo haut du corps',
  lower_body: 'Renfo bas du corps',
  full_body: 'Renfo corps complet',
  push: 'Renfo poussée',
  pull: 'Renfo tirage',
  legs: 'Renfo jambes',
  core: 'Gainage',
  hiit: 'HIIT',
};
const WEEK_DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const fullName = (person: { firstName: string; lastName: string }) => `${person.firstName} ${person.lastName}`.trim();

/** "4 oct." */
const dayMonth = (date: string | Date) => formatDayShort(toIsoDay(new Date(date))).split(' ').slice(1).join(' ');

function daysAgoLabel(days: number | null) {
  if (days === null) return '—';
  if (days === 0) return 'Aujourd’hui';
  if (days === 1) return 'Hier';
  return `Il y a ${days} j`;
}

function athleteSubtitle(athlete: ApiCoachAthlete) {
  const competition = athlete.nextCompetition;
  if (competition) return `${competition.name} · ${competition.priority} · ${dayMonth(competition.date)}`;
  if (athlete.daysSinceActivity === null) return 'Aucune activité enregistrée';
  if (athlete.daysSinceActivity > 7) return `Dernière activité il y a ${athlete.daysSinceActivity} j`;
  return 'Aucune course prévue';
}

export function buildCoachHome(stats: ApiCoachStats, athletes: ApiCoachAthlete[], requests: ApiSubscriptionRequest[]): CoachHome {
  return {
    stats: {
      athletes: stats.totalAthletes,
      pendingInvitations: stats.pendingInvitations,
      sessionsThisWeek: stats.sessionsCreatedThisWeek,
      sessionsTotal: stats.sessionsCreatedTotal,
    },
    requests: requests.flatMap((request) =>
      request.athlete
        ? [
            {
              id: request._id,
              athleteId: request.athlete._id,
              name: fullName(request.athlete),
              initials: initialsOf(request.athlete.firstName, request.athlete.lastName),
              offer: [PACKAGE_LABELS[request.packageType], PACKAGE_PRICES[request.packageType]].filter(Boolean).join(' · '),
              requestedLabel: `Demandé le ${dayMonth(request.invitedAt)}`,
            },
          ]
        : [],
    ),
    // Les athlètes qui demandent de l'attention d'abord.
    athletes: [...athletes]
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || fullName(a).localeCompare(fullName(b)))
      .map((athlete) => ({
        id: athlete._id,
        name: fullName(athlete),
        initials: initialsOf(athlete.firstName, athlete.lastName),
        email: athlete.email,
        status: athlete.status,
        offer: PACKAGE_LABELS[athlete.packageType ?? 'invited'],
        subtitle: athleteSubtitle(athlete),
        level: athlete.runningLevel ? LEVEL_LABELS[athlete.runningLevel] : undefined,
        nextRace: athlete.nextCompetition
          ? {
              name: athlete.nextCompetition.name,
              meta: `${athlete.nextCompetition.priority} · ${dayMonth(athlete.nextCompetition.date)}`,
            }
          : undefined,
      })),
  };
}

/** Statut de chacune des 8 dernières semaines, d'après l'historique des changements de statut. */
function weeklyStatuses(detail: ApiCoachAthleteDetail, now: Date): (AthleteStatus | null)[] {
  const history = [...detail.statusHistory].sort((a, b) => a.date.localeCompare(b.date));
  const currentWeek = startOfWeek(now);
  return Array.from({ length: 8 }, (_, index) => {
    if (index === 7) return detail.status;
    const weekEnd = addDays(currentWeek, (index - 6) * 7);
    const entry = history.filter((item) => new Date(item.date) < weekEnd).pop();
    return entry?.status ?? null;
  });
}

function activityRow(activity: ApiRecentActivity) {
  const running = activity.type === 'run';
  let value: string;
  if (running) value = activity.distance ? `${formatDecimal(activity.distance)} km` : activity.duration ? formatHoursMinutes(activity.duration * 60) : '—';
  else value = activity.duration ? `${Math.round(activity.duration)} min` : `${activity.exerciseCount ?? 0} exercices`;
  return {
    id: activity._id,
    sport: running ? ('running' as const) : ('strength' as const),
    title: running ? 'Course' : (STRENGTH_SESSION_LABELS[activity.sessionType ?? ''] ?? 'Renforcement'),
    dateLabel: formatDayShort(toIsoDay(new Date(activity.date))),
    value,
    feeling: activity.feeling ?? undefined,
  };
}

export function buildAthleteFiche(detail: ApiCoachAthleteDetail, competitions: ApiCompetition[], now: Date): AthleteFiche {
  const today = toIsoDay(now);
  const next = competitions
    .filter((competition) => competition.status === 'upcoming' && toIsoDay(new Date(competition.date)) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return {
    id: detail._id,
    name: fullName(detail),
    initials: initialsOf(detail.firstName, detail.lastName),
    sinceLabel: detail.joinedAt ? `Votre athlète depuis le ${formatDayMonthYear(new Date(detail.joinedAt))}` : undefined,
    status: detail.status,
    trend: detail.statusTrend,
    statusSinceLabel: detail.statusChangedAt ? `depuis le ${dayMonth(detail.statusChangedAt)}` : undefined,
    lastActivityLabel: daysAgoLabel(detail.daysSinceActivity),
    skippedCount: detail.skippedCount,
    avgFeeling: detail.avgFeeling ?? undefined,
    weeklyVolume: detail.weeklyVolume,
    baselineWeeklyVolume: detail.baselineWeeklyVolume,
    weeks: weeklyStatuses(detail, now),
    physical: { heightCm: detail.height, weightKg: detail.weight, vma: detail.vma, fcMax: detail.fcmax },
    running: { level: detail.runningLevel ? (LEVEL_LABELS[detail.runningLevel] ?? detail.runningLevel) : undefined, frequency: detail.weeklyFrequency, injuries: detail.injuries?.trim() || undefined },
    competition: next
      ? { name: next.name, dateLabel: formatDayShort(toIsoDay(new Date(next.date))), priority: next.priority, goal: next.targetTime ?? undefined }
      : undefined,
    strength: {
      goal: detail.strengthGoal ? (STRENGTH_GOAL_LABELS[detail.strengthGoal] ?? detail.strengthGoal) : undefined,
      type: detail.strengthType ? (STRENGTH_TYPE_LABELS[detail.strengthType] ?? detail.strengthType) : undefined,
      frequency: detail.strengthFrequency,
    },
    availability: {
      days: WEEK_DAYS.map((day) => Boolean(detail.availableDays?.includes(day))),
      preferredTime: detail.preferredTime,
    },
    activities: detail.recentStats.recentActivities.map(activityRow),
  };
}

export function mapAthleteList(athletes: ApiCoachAthlete[]): CoachAthleteLite[] {
  return athletes
    .map((athlete) => ({ id: athlete._id, name: fullName(athlete), initials: initialsOf(athlete.firstName, athlete.lastName), vma: athlete.vma ?? undefined }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildInviteOverview(code: string | null, pending: ApiPendingInvitation[]): InviteOverview {
  return {
    code,
    pending: pending.flatMap((invitation) =>
      invitation.athlete
        ? [
            {
              id: invitation._id,
              name: fullName(invitation.athlete),
              initials: initialsOf(invitation.athlete.firstName, invitation.athlete.lastName),
              sentLabel: `Envoyée le ${dayMonth(invitation.invitedAt)}`,
            },
          ]
        : [],
    ),
  };
}

export function mapSearchResults(results: ApiUserSearchResult[]): AthleteSearchRow[] {
  return results.map((result) => ({
    id: result._id,
    name: fullName(result),
    initials: initialsOf(result.firstName, result.lastName),
    email: result.email,
    state:
      result.relationStatus === 'accepted'
        ? 'following'
        : result.relationStatus === 'pending' || result.relationStatus === 'requested'
          ? 'pending'
          : result.hasCoach
            ? 'taken'
            : 'available',
  }));
}
