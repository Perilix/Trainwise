// Conversion des réponses de l'API vers les modèles de vue des écrans athlète.
import type {
  ApiCalendarData,
  ApiCoach,
  ApiCompetition,
  ApiConversation,
  ApiMessage,
  ApiNotification,
  ApiPlannedRun,
  ApiRun,
  ApiStrengthSession,
  ApiStravaStatus,
  ApiUser,
} from '@/lib/api-types';
import { addDays, daysBetween, isoWeek, startOfWeek } from '@/lib/dates';
import { formatDayMonthYear, formatDayShort, formatMonthName, formatMonthShort, formatMonthYear, formatTime, paceToSeconds, parseDay, toIsoDay } from '@/lib/format';

import { blocksToSegments, describeBlocks, estimateFromBlocks } from './run-blocks';
import type {
  Activity,
  AthleteHome,
  AthleteNotification,
  AthleteProfile,
  CalendarMarker,
  ChatMessage,
  KmSplit,
  NotificationKind,
  PlannedSession,
  PlanningMonth,
  RunDetail,
  RunsOverview,
  RunsPeriod,
} from './types';

export const SESSION_TYPE_LABELS: Record<string, string> = {
  endurance: 'Endurance',
  fractionne: 'Fractionné',
  tempo: 'Tempo',
  recuperation: 'Récupération',
  sortie_longue: 'Sortie longue',
  cotes: 'Côtes',
  fartlek: 'Fartlek',
  upper_body: 'Renfo haut du corps',
  lower_body: 'Renfo bas du corps',
  full_body: 'Renfo corps complet',
  push: 'Renfo poussée',
  pull: 'Renfo tirage',
  legs: 'Renfo jambes',
  core: 'Gainage',
  hiit: 'HIIT',
  other: 'Renforcement',
};

const LEVEL_LABELS: Record<NonNullable<ApiUser['runningLevel']>, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  confirme: 'Confirmé',
  expert: 'Expert',
};

// Zones d'allure Strava 1 à 6, la 6 (anaérobie) est regroupée avec la VMA.
const PACE_ZONE_LABELS = ['Récupération', 'Endurance', 'Tempo', 'Seuil', 'VMA'];

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const initialsOf = (firstName?: string, lastName?: string) => `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';

const fullName = (person: { firstName: string; lastName: string }) => `${person.firstName} ${person.lastName}`.trim();

// Strava fournit l'heure locale de départ encodée comme UTC : on la lit telle quelle.
const runDay = (run: ApiRun) => run.stravaData?.startDateLocal?.slice(0, 10) ?? toIsoDay(new Date(run.date));
const dayOf = (isoDate: string) => toIsoDay(new Date(isoDate));

function exercisesCount(plan: ApiPlannedRun['strengthPlan']) {
  if (!plan) return undefined;
  const pairs = plan.superset?.pairs ?? [];
  const count = (plan.exercises?.length ?? 0) + (plan.circuit?.exercises?.length ?? 0) + sum(pairs.map((pair) => (pair.a ? 1 : 0) + (pair.b ? 1 : 0)));
  return count || undefined;
}

export function mapPlanned(planned: ApiPlannedRun, coachName?: string, vma?: number): PlannedSession {
  const byCoach = planned.generatedBy === 'coach';
  // Le coach construit sa séance bloc par bloc et laisse souvent les totaux vides :
  // sans cette estimation, l'athlète voit « — » en distance, durée et allure.
  const estimated = planned.activityType === 'running' ? estimateFromBlocks(planned.runBlocks, vma) : {};
  return {
    id: planned._id,
    date: dayOf(planned.date),
    sport: planned.activityType,
    title: planned.title || SESSION_TYPE_LABELS[planned.sessionType] || (planned.activityType === 'strength' ? 'Renforcement' : 'Course'),
    description: planned.description || undefined,
    distanceKm: planned.targetDistance ?? estimated.distanceKm,
    durationMin: planned.targetDuration ?? planned.strengthPlan?.estimatedDuration ?? estimated.durationMin,
    paceSecPerKm: paceToSeconds(planned.targetPace) ?? estimated.paceSecPerKm,
    exercisesCount: planned.activityType === 'strength' ? exercisesCount(planned.strengthPlan) : undefined,
    plannedBy: byCoach ? 'coach' : 'athlete',
    coachName: byCoach ? coachName : undefined,
    status: planned.status === 'completed' ? 'done' : planned.status,
  };
}

export function mapRun(run: ApiRun): Activity {
  const local = run.stravaData?.startDateLocal;
  return {
    id: run._id,
    date: runDay(run),
    startTime: local ? local.slice(11, 16) : undefined,
    sport: 'running',
    title: run.plannedSnapshot?.title || run.stravaData?.name || SESSION_TYPE_LABELS[run.sessionType ?? ''] || 'Course',
    distanceKm: run.distance,
    durationSec: run.stravaData?.movingTime ?? Math.round((run.duration ?? 0) * 60),
    paceSecPerKm: paceToSeconds(run.averagePace),
    avgHr: run.averageHeartRate ? Math.round(run.averageHeartRate) : undefined,
    feeling: run.feeling ?? undefined,
    fromStrava: Boolean(run.stravaActivityId),
    polyline: run.polyline ?? null,
  };
}

export function mapStrength(session: ApiStrengthSession): Activity {
  return {
    id: session._id,
    date: dayOf(session.date),
    sport: 'strength',
    title: SESSION_TYPE_LABELS[session.sessionType] ?? 'Renforcement',
    durationSec: Math.round((session.duration ?? 0) * 60),
    setsCount: session.totalSets || undefined,
    feeling: session.feeling ?? undefined,
    fromStrava: Boolean(session.stravaActivityId),
  };
}

const byMostRecent = (a: Activity, b: Activity) => b.date.localeCompare(a.date) || (b.startTime ?? '').localeCompare(a.startTime ?? '');

export function mapRunDetail(run: ApiRun, coachName?: string, vma?: number): RunDetail {
  const strava = run.stravaData;
  // Le dernier split partiel (moins de 500 m) fausserait l'allure : on l'écarte.
  const splits: KmSplit[] = (strava?.splits ?? [])
    .filter((split) => split.distance >= 500 && split.movingTime > 0)
    .map((split) => ({
      km: split.split,
      paceSecPerKm: Math.round(split.movingTime / (split.distance / 1000)),
      avgHr: split.averageHeartrate ? Math.round(split.averageHeartrate) : undefined,
      elevation: split.elevationDifference === null ? undefined : Math.round(split.elevationDifference),
    }));
  const zones = strava?.paceZoneDistribution;
  const paceZones =
    zones && Object.keys(zones).length
      ? PACE_ZONE_LABELS.map((label, index) => ({
          label,
          minutes: Math.round(((zones[String(index + 1)] ?? 0) + (index === 4 ? (zones['6'] ?? 0) : 0)) / 60),
        }))
      : [];
  // Les notes importées commencent par le nom de l'activité Strava.
  const name = strava?.name;
  const notes = run.notes && name && run.notes.startsWith(name) ? run.notes.slice(name.length).trim() : run.notes?.trim();
  const byCoach = Boolean(run.plannedSnapshot?.coach);

  // Déroulé réalisé : reconstruit des tours Strava, ou saisi par l'athlète.
  const runBlocks = run.runBlocks ?? [];

  return {
    ...mapRun(run),
    blocks: describeBlocks(runBlocks, vma),
    segments: blocksToSegments(runBlocks, vma),
    blocksAuto: Boolean(run.blocksAutoReconstructed),
    plannedBy: run.plannedSnapshot ? (byCoach ? 'coach' : 'athlete') : undefined,
    coachName: byCoach ? coachName : undefined,
    maxHr: run.maxHeartRate ?? strava?.maxHeartrate ?? undefined,
    elevationGain: run.elevationGain ?? strava?.totalElevationGain ?? undefined,
    notes: notes || undefined,
    splits,
    paceZones,
  };
}

/** Semaines consécutives (lundi → dimanche) avec au moins une course, en partant de la semaine en cours. */
export function weeklyStreak(runDays: string[], now: Date) {
  const weeks = new Set(runDays.map((day) => toIsoDay(startOfWeek(parseDay(day)))));
  let cursor = startOfWeek(now);
  if (!weeks.has(toIsoDay(cursor))) cursor = addDays(cursor, -7);
  let streak = 0;
  while (weeks.has(toIsoDay(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

type HomeInput = {
  user: ApiUser;
  calendars: ApiCalendarData[];
  runs: ApiRun[];
  strength: ApiStrengthSession[];
  coach: ApiCoach | null;
  conversations: ApiConversation[];
  strava: ApiStravaStatus | null;
  now: Date;
};

export function buildHome({ user, calendars, runs, strength, coach, conversations, strava, now }: HomeInput): AthleteHome {
  const today = toIsoDay(now);
  const plannedById = new Map(calendars.flatMap((calendar) => calendar.plannedRuns).map((planned) => [planned._id, planned]));
  const planned = [...plannedById.values()].map((item) => mapPlanned(item, coach?.firstName, user.vma ?? undefined));
  const activities = [...runs.map(mapRun), ...strength.map(mapStrength)];

  const activeDays = new Set(activities.map((activity) => activity.date));
  planned.filter((session) => session.status === 'done').forEach((session) => activeDays.add(session.date));

  const monday = startOfWeek(now);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = toIsoDay(addDays(monday, index));
    const hasPlanned = planned.some((session) => session.date === date && session.status === 'planned');
    return { date, status: activeDays.has(date) ? 'done' : hasPlanned ? 'planned' : 'rest', isToday: date === today } as const;
  });
  const weekStart = week[0].date;
  const weekEnd = week[6].date;
  const weekRuns = activities.filter((activity) => activity.sport === 'running' && activity.date >= weekStart && activity.date <= weekEnd);

  const pending = planned.filter((session) => session.status === 'planned' && session.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const todaySession = pending.find((session) => session.date === today);
  const conversation = coach ? conversations.find((item) => item.otherParticipant?._id === coach._id) : undefined;
  const lastMessage = conversation?.lastMessage;

  return {
    firstName: user.firstName,
    initials: initialsOf(user.firstName, user.lastName),
    motto: 'La constance fait la différence.',
    streakWeeks: weeklyStreak(runs.map(runDay), now),
    today: todaySession,
    week,
    weekStats: {
      runs: weekRuns.length,
      distanceKm: sum(weekRuns.map((run) => run.distanceKm ?? 0)),
      durationSec: sum(weekRuns.map((run) => run.durationSec)),
    },
    upcoming: pending.filter((session) => session !== todaySession).slice(0, 3),
    recent: activities.sort(byMostRecent).slice(0, 3),
    coach: coach
      ? {
          name: fullName(coach),
          initials: initialsOf(coach.firstName, coach.lastName),
          online: Boolean(conversation?.otherParticipant?.isOnline),
          lastMessage: lastMessage?.content ? (lastMessage.type === 'text' ? lastMessage.content : 'Pièce jointe') : undefined,
        }
      : undefined,
    strava: { connected: Boolean(strava?.connected) },
  };
}

export function buildPlanning(calendar: ApiCalendarData, now: Date, coachName?: string, vma?: number): PlanningMonth {
  const markers: Record<string, CalendarMarker> = {};
  const competitionPriority: PlanningMonth['competitionPriority'] = {};
  const sessionsByDay: Record<string, PlannedSession[]> = {};
  const planned = calendar.plannedRuns.map((item) => mapPlanned(item, coachName, vma));

  planned.forEach((session) => {
    (sessionsByDay[session.date] ??= []).push(session);
    if (session.status === 'planned' && markers[session.date] !== 'coach') markers[session.date] = session.plannedBy;
  });
  [...calendar.runs.map(runDay), ...calendar.strengthSessions.map((session) => dayOf(session.date)), ...planned.filter((session) => session.status === 'done').map((session) => session.date)].forEach(
    (day) => (markers[day] = 'done'),
  );
  const activitiesByDay: Record<string, Activity[]> = {};
  [...calendar.runs.map(mapRun), ...calendar.strengthSessions.map(mapStrength)].forEach((activity) => (activitiesByDay[activity.date] ??= []).push(activity));

  calendar.competitions.forEach((competition) => {
    const day = dayOf(competition.date);
    markers[day] = 'competition';
    competitionPriority[day] = competition.priority;
  });

  return {
    year: calendar.year,
    monthIndex: calendar.month - 1,
    today: toIsoDay(now),
    markers,
    competitionPriority,
    sessionsByDay,
    activitiesByDay,
    stats: {
      planned: planned.length,
      done: calendar.runs.length + calendar.strengthSessions.length,
      distanceKm: sum(calendar.runs.map((run) => run.distance ?? 0)),
    },
  };
}

type PeriodRange = { start: string; end: string; label: string; short: string; compareLabel: string };

function periodRange(period: RunsPeriod, now: Date, offset: number): PeriodRange {
  if (period === 'week') {
    const monday = addDays(startOfWeek(now), -7 * offset);
    return {
      start: toIsoDay(monday),
      end: toIsoDay(addDays(monday, 6)),
      label: offset === 0 ? 'Cette semaine' : `Semaine ${isoWeek(monday)}`,
      short: `S${isoWeek(monday)}`,
      compareLabel: 'sem. dernière',
    };
  }
  if (period === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    return {
      start: toIsoDay(first),
      end: toIsoDay(last),
      label: formatMonthYear(first.getFullYear(), first.getMonth()),
      short: capitalize(formatMonthShort(first.getMonth())),
      compareLabel: formatMonthName(first.getMonth()),
    };
  }
  const year = now.getFullYear() - offset;
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: String(year), short: String(year), compareLabel: String(year) };
}

export function buildRunsOverview(apiRuns: ApiRun[], period: RunsPeriod, now: Date, offset = 0): RunsOverview {
  const runs = apiRuns.map(mapRun);
  // Six périodes se terminant sur celle consultée : l'historique se lit vers la gauche.
  const ranges = Array.from({ length: 6 }, (_, index) => periodRange(period, now, 5 - index + offset));
  const within = (range: PeriodRange) => runs.filter((run) => run.date >= range.start && run.date <= range.end);
  const distance = (list: Activity[]) => sum(list.map((run) => run.distanceKm ?? 0));

  const current = within(ranges[5]).sort(byMostRecent);
  const total = distance(current);
  const previousTotal = distance(within(ranges[4]));
  const trend = previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : undefined;

  const timed = current.filter((run) => run.distanceKm && run.durationSec);
  const timedDistance = distance(timed);
  const count = current.length;
  const noun = count > 1 ? 'sorties' : 'sortie';
  const listTitle =
    period === 'week'
      ? `${count} ${noun} ${offset === 0 ? 'cette semaine' : `${ranges[5].label.toLowerCase()}`}`
      : period === 'month'
        ? `${count} ${noun} en ${formatMonthName(parseDay(ranges[5].start).getMonth())}`
        : `${count} ${noun} en ${ranges[5].label}`;

  return {
    periodLabel: ranges[5].label,
    listTitle,
    distanceKm: total,
    trendLabel: trend === undefined ? undefined : `${trend >= 0 ? '+' : '−'}${Math.abs(trend)} % vs ${ranges[4].compareLabel}`,
    trendUp: trend === undefined ? undefined : trend >= 0,
    bars: ranges.map((range, index) => ({ label: range.short, distanceKm: distance(within(range)), selected: index === 5, offset: offset + 5 - index })),
    stats: {
      runs: count,
      avgPaceSecPerKm: timedDistance > 0 ? sum(timed.map((run) => run.durationSec)) / timedDistance : undefined,
      durationSec: sum(current.map((run) => run.durationSec)),
    },
    runs: current,
  };
}

export function buildProfile(user: ApiUser, competitions: ApiCompetition[], strava: ApiStravaStatus | null, coach: ApiCoach | null, now: Date): AthleteProfile {
  const today = toIsoDay(now);
  const coachSince = coach ? new Date(coach.connectedSince) : null;

  return {
    fullName: fullName(user),
    initials: initialsOf(user.firstName, user.lastName),
    email: user.email,
    level: user.runningLevel ? LEVEL_LABELS[user.runningLevel] : 'Non défini',
    runsPerWeek: user.weeklyFrequency,
    vma: user.vma,
    fcMax: user.fcmax,
    heightCm: user.height,
    weightKg: user.weight,
    competitions: competitions
      .map((competition) => ({ ...competition, day: dayOf(competition.date) }))
      .filter((competition) => competition.status === 'upcoming' && competition.day >= today)
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((competition) => {
        const days = daysBetween(now, parseDay(competition.day));
        return {
          id: competition._id,
          name: competition.name,
          date: competition.day,
          discipline: competition.discipline ?? undefined,
          priority: competition.priority,
          goal: competition.targetTime ?? undefined,
          weeksLeftLabel: days === 0 ? 'Aujourd’hui' : days < 7 ? `Dans ${days} j` : `Dans ${Math.round(days / 7)} sem.`,
        };
      }),
    strava: { connected: Boolean(strava?.connected), since: strava?.connectedAt ? formatDayMonthYear(new Date(strava.connectedAt)) : undefined },
    coach: coach && coachSince ? { name: fullName(coach), since: formatMonthYear(coachSince.getFullYear(), coachSince.getMonth()).toLowerCase() } : undefined,
  };
}

function notificationKind(notification: ApiNotification): NotificationKind {
  switch (notification.type) {
    case 'message':
      return 'message';
    case 'session':
      return /updat|modif|edit/i.test(notification.action) ? 'session-updated' : 'sessions-planned';
    case 'friend':
      return 'friend-request';
    case 'invitation':
    case 'invitation_response':
      return 'invitation';
    default:
      return 'other';
  }
}

export function mapNotification(notification: ApiNotification, now: Date): AthleteNotification {
  const created = new Date(notification.createdAt);
  const age = daysBetween(created, now);
  const [weekday, ...dayMonth] = formatDayShort(toIsoDay(created)).split(' ');
  return {
    id: notification._id,
    kind: notificationKind(notification),
    title: notification.title,
    body: notification.message,
    timeLabel: age <= 1 ? formatTime(created) : age < 7 ? weekday : dayMonth.join(' '),
    group: age <= 0 ? 'today' : age === 1 ? 'yesterday' : age < 7 ? 'week' : 'older',
    unread: !notification.read,
    actionUrl: notification.actionUrl ?? undefined,
  };
}

export function mapMessages(messages: ApiMessage[], myId: string, now: Date): ChatMessage[] {
  let previousDay = '';
  return messages.map((message) => {
    const created = new Date(message.createdAt);
    const day = toIsoDay(created);
    const age = daysBetween(created, now);
    const dayLabel = day === previousDay ? undefined : age === 0 ? 'Aujourd’hui' : age === 1 ? 'Hier' : formatDayShort(day);
    previousDay = day;
    const senderId = typeof message.sender === 'string' ? message.sender : message.sender._id;
    const reference = message.sessionRef;
    return {
      id: message._id,
      fromMe: senderId === myId,
      text: message.type === 'text' || message.type === 'session' ? message.content : message.type === 'image' ? 'Photo' : `Document · ${message.content}`,
      timeLabel: formatTime(created),
      dayLabel,
      session:
        message.type === 'session' && reference?.id
          ? { kind: reference.kind, id: reference.id, sport: reference.sport, title: reference.title || 'Séance', meta: reference.meta }
          : undefined,
    };
  });
}
