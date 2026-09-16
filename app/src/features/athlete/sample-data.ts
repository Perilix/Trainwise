// Données d'exemple (celles de la maquette), utilisées par le mode démo.
import type { ApiPlannedRunDetail } from '@/lib/api-types';

import type {
  Activity,
  AthleteHome,
  AthleteNotification,
  AthleteProfile,
  CalendarMarker,
  ChatMessage,
  KmSplit,
  PlannedSession,
  PlanningMonth,
  RunDetail,
  RunsOverview,
} from './types';

export const SAMPLE_TODAY = '2026-09-13';

const coachPlanned = {
  status: 'planned',
  feeling: null,
  generatedBy: 'coach',
  createdBy: 'demo-coach',
  targetDistance: null,
  targetDuration: null,
  targetPace: null,
} as const;

// Séances planifiées détaillées, au format de GET /api/planning/:id
export const samplePlannedDetails: Record<string, ApiPlannedRunDetail> = {
  'plan-2026-09-13': {
    ...coachPlanned,
    _id: 'plan-2026-09-13',
    date: '2026-09-13T00:00:00.000Z',
    activityType: 'running',
    sessionType: 'sortie_longue',
    title: 'Sortie longue',
    description: 'Endurance fondamentale en aisance respiratoire, relances légères sur les 2 derniers km.',
    targetDistance: 16,
    targetDuration: 85,
    targetPace: '5:20',
    runBlocks: [
      { role: 'warmup', mode: 'distance', distance: 2, pace: '6:00', order: 0, description: 'Très progressif, épaules relâchées.' },
      { role: 'main', mode: 'distance', distance: 12, pace: '5:20', order: 1 },
      { role: 'main', mode: 'distance', distance: 2, pace: '4:50', order: 2, description: 'Relances sans forcer, comme en fin de marathon.' },
    ],
  },
  'plan-2026-09-15': {
    ...coachPlanned,
    _id: 'plan-2026-09-15',
    date: '2026-09-15T00:00:00.000Z',
    activityType: 'running',
    sessionType: 'fractionne',
    title: 'Fractionné 10 × 400 m',
    description: 'Récupération complète entre les répétitions : la FC doit redescendre sous 150.',
    targetDistance: 11,
    targetPace: '3:32',
    runBlocks: [
      { role: 'warmup', mode: 'duration', duration: 20, pace: '6:00', order: 0, description: 'Footing puis 3 lignes droites.' },
      { role: 'main', mode: 'distance', distance: 0.4, pace: '3:32', repetitions: 10, recoveryMode: 'duration', recoveryDuration: '1min30', recoveryDescription: 'trot', order: 1 },
      { role: 'cooldown', mode: 'duration', duration: 10, pace: '6:10', order: 2 },
    ],
  },
  'plan-2026-09-17': {
    ...coachPlanned,
    _id: 'plan-2026-09-17',
    date: '2026-09-17T00:00:00.000Z',
    activityType: 'strength',
    sessionType: 'lower_body',
    title: 'Renfo bas du corps',
    description: 'Charges modérées, priorité à l’amplitude. Stoppe une série si la technique se dégrade.',
    strengthPlan: {
      estimatedDuration: 50,
      exercises: [
        { exercise: { _id: 'ex-squat', name: 'Squat barre', primaryMuscle: 'quadriceps' }, targetSets: 4, targetReps: '8-10', targetWeight: 60, targetRest: '90 s' },
        { exercise: { _id: 'ex-bulgarian', name: 'Fente bulgare', primaryMuscle: 'glutes' }, targetSets: 3, targetReps: '10', targetWeight: 12, targetRest: '60 s', notes: 'Par jambe' },
        { exercise: { _id: 'ex-rdl', name: 'Soulevé de terre roumain', primaryMuscle: 'hamstrings' }, targetSets: 3, targetReps: '10', targetWeight: 50, targetRest: '90 s' },
      ],
      superset: {
        sets: 3,
        restBetweenSets: 75,
        pairs: [
          {
            a: { exercise: { _id: 'ex-hip-thrust', name: 'Hip thrust', primaryMuscle: 'glutes' }, targetReps: '12', targetWeight: 40 },
            b: { exercise: { _id: 'ex-calf', name: 'Mollets debout', primaryMuscle: 'calves' }, targetReps: '15' },
          },
        ],
      },
      circuit: {
        name: 'Gainage',
        rounds: 3,
        restBetweenRounds: 45,
        exercises: [{ exercise: { _id: 'ex-plank', name: 'Planche', primaryMuscle: 'core' }, targetReps: '40 s' }],
      },
    },
  },
};

const coachSession = (session: Omit<PlannedSession, 'plannedBy' | 'coachName' | 'status'> & Partial<PlannedSession>): PlannedSession => ({
  plannedBy: 'coach',
  coachName: 'Camille',
  status: 'planned',
  ...session,
});

const longRunToday = coachSession({
  id: 'plan-2026-09-13',
  date: '2026-09-13',
  sport: 'running',
  title: 'Sortie longue',
  description: 'Endurance fondamentale en aisance respiratoire, relances légères sur les 2 derniers km.',
  distanceKm: 16,
  durationMin: 85,
  paceSecPerKm: 320,
});

export const sampleHome: AthleteHome = {
  firstName: 'Thomas',
  initials: 'TD',
  motto: 'La constance fait la différence.',
  streakWeeks: 6,
  today: longRunToday,
  week: ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'].map((date, index) => ({
    date,
    status: index === 6 ? 'planned' : [0, 2, 4].includes(index) ? 'done' : 'rest',
    isToday: date === SAMPLE_TODAY,
  })),
  weekStats: { runs: 2, distanceKm: 19.6, durationSec: 2 * 3600 + 36 * 60 },
  upcoming: [
    coachSession({ id: 'plan-2026-09-15', date: '2026-09-15', sport: 'running', title: 'Fractionné 10 × 400 m', distanceKm: 11, paceSecPerKm: 212 }),
    coachSession({ id: 'plan-2026-09-17', date: '2026-09-17', sport: 'strength', title: 'Renfo bas du corps', durationMin: 50, exercisesCount: 6 }),
  ],
  recent: [
    { id: 'strength-2026-09-11', date: '2026-09-11', sport: 'strength', title: 'Renfo haut du corps', durationSec: 55 * 60, setsCount: 17, fromStrava: false },
    { id: 'run-2026-09-09', date: '2026-09-09', sport: 'running', title: 'Fractionné 6 × 1000 m', distanceKm: 11.2, durationSec: 52 * 60 + 10, paceSecPerKm: 279, fromStrava: true },
    { id: 'run-2026-09-07', date: '2026-09-07', sport: 'running', title: 'Footing', distanceKm: 8.4, durationSec: 48 * 60 + 47, paceSecPerKm: 348, fromStrava: true },
  ],
  coach: { name: 'Camille Roux', initials: 'CR', online: true, lastMessage: 'Pense à noter ton ressenti après la sortie longue, on ajuste la semaine ensuite.' },
  strava: { connected: true, lastSyncLabel: 'il y a 2 h' },
};

// Planning de septembre 2026
const done = [1, 3, 5, 7, 9, 11];
const byCoach = [13, 15, 17, 20, 22, 24, 27, 29];
const byAthlete = [18, 25];
const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}`;

const markers: Record<string, CalendarMarker> = {};
done.forEach((n) => (markers[day(n)] = 'done'));
byCoach.forEach((n) => (markers[day(n)] = 'coach'));
byAthlete.forEach((n) => (markers[day(n)] = 'athlete'));
markers['2026-10-04'] = 'competition';

export const samplePlanning: PlanningMonth = {
  year: 2026,
  monthIndex: 8,
  today: SAMPLE_TODAY,
  markers,
  competitionPriority: { '2026-10-04': 'A' },
  sessionsByDay: {
    [SAMPLE_TODAY]: [longRunToday],
    '2026-09-15': [sampleHome.upcoming[0]],
    '2026-09-17': [sampleHome.upcoming[1]],
    '2026-09-18': [{ id: 'plan-2026-09-18', date: '2026-09-18', sport: 'running', title: 'Footing', durationMin: 45, plannedBy: 'athlete', status: 'planned' }],
  },
  activitiesByDay: Object.fromEntries(sampleHome.recent.map((activity) => [activity.date, [activity]])),
  stats: { planned: 16, done: 6, distanceKm: 58 },
};

// Sortie longue du 31 août : allure, FC et D+ par km (splits Strava)
const paces = Array.from({ length: 21 }, (_, i) => Math.round(334 - i * 1.25 + 6 * Math.sin(i * 1.7) + (i === 0 ? 6 : 0)));
paces[19] = 302;
const elevations = [4, 12, 3, 18, 6, 2, 9, 14, 21, 5, 3, 8, 16, 4, 11, 7, 13, 2, 19, 6, 1];
const splits: KmSplit[] = paces.map((pace, i) => ({
  km: i + 1,
  paceSecPerKm: pace,
  avgHr: Math.round(118 + 26 * (1 - Math.exp(-((i + 0.5) / 21) * 9)) + 12 * ((i + 0.5) / 21) ** 2 + (i > 18 ? 6 : 0)),
  elevation: elevations[i] * (i % 3 === 2 ? -1 : 1),
}));

const longRun: RunDetail = {
  id: 'run-2026-08-31',
  date: '2026-08-31',
  startTime: '08:12',
  sport: 'running',
  title: 'Sortie longue',
  distanceKm: 21.1,
  durationSec: 60 * 112 + 40,
  paceSecPerKm: 320,
  avgHr: 146,
  maxHr: 171,
  minHr: 112,
  elevationGain: 184,
  feeling: 8,
  fromStrava: true,
  plannedBy: 'coach',
  coachName: 'Camille',
  notes: 'Jambes lourdes au départ, bonnes sensations après le km 8.',
  splits,
  paceZones: [
    { label: 'Récupération', minutes: 8 },
    { label: 'Endurance', minutes: 61 },
    { label: 'Tempo', minutes: 38 },
    { label: 'Seuil', minutes: 5 },
    { label: 'VMA', minutes: 0 },
  ],
};

const augustRuns: Activity[] = [
  { id: longRun.id, date: '2026-08-31', startTime: '08:12', sport: 'running', title: 'Sortie longue', distanceKm: 21.1, durationSec: longRun.durationSec, paceSecPerKm: 320, avgHr: 146, feeling: 8, fromStrava: true },
  { id: 'run-2026-08-28', date: '2026-08-28', startTime: '18:40', sport: 'running', title: 'Fractionné 10 × 400 m', distanceKm: 9.2, durationSec: 48 * 60 + 10, paceSecPerKm: 314, avgHr: 158, feeling: 6, fromStrava: true },
  { id: 'run-2026-08-26', date: '2026-08-26', startTime: '07:05', sport: 'running', title: 'Footing', distanceKm: 10.4, durationSec: 58 * 60 + 20, paceSecPerKm: 337, avgHr: 139, feeling: 7, fromStrava: true },
  { id: 'run-2026-08-24', date: '2026-08-24', startTime: '09:30', sport: 'running', title: 'Sortie longue vallonnée', distanceKm: 19, durationSec: 103 * 60 + 10, paceSecPerKm: 326, avgHr: 144, feeling: 7, fromStrava: true },
];

export const sampleRunsOverview: RunsOverview = {
  periodLabel: 'Août 2026',
  listTitle: '14 sorties en août',
  distanceKm: 127.3,
  trendLabel: '+8 % vs juillet',
  trendUp: true,
  bars: [
    { label: 'Avr.', distanceKm: 88, selected: false },
    { label: 'Mai', distanceKm: 104, selected: false },
    { label: 'Juin', distanceKm: 112, selected: false },
    { label: 'Juil.', distanceKm: 118, selected: false },
    { label: 'Août', distanceKm: 127.3, selected: true },
    { label: 'Sept.', distanceKm: 58, selected: false },
  ],
  stats: { runs: 14, avgPaceSecPerKm: 321, durationSec: 11 * 3600 + 21 * 60 },
  runs: augustRuns,
};

export const sampleRuns: Record<string, RunDetail> = {
  [longRun.id]: longRun,
};

export const sampleProfile: AthleteProfile = {
  fullName: 'Thomas Dubois',
  initials: 'TD',
  email: 'thomas.dubois@example.com',
  level: 'Intermédiaire',
  runsPerWeek: 4,
  vma: 16.5,
  fcMax: 191,
  heightCm: 178,
  weightKg: 71,
  competitions: [
    { id: 'comp-lyon', name: 'Marathon de Lyon', date: '2026-10-04', priority: 'A', goal: '3:15:00', weeksLeftLabel: 'Dans 3 sem.' },
    { id: 'comp-lausanne', name: '10 km de Lausanne', date: '2026-11-07', priority: 'B', goal: '42:00', weeksLeftLabel: 'Dans 8 sem.' },
  ],
  strava: { connected: true, since: '2 juin 2026' },
  coach: { name: 'Camille Roux', since: 'mars 2026' },
};

export const sampleNotifications: AthleteNotification[] = [
  { id: 'n1', kind: 'session-updated', title: 'Séance modifiée par Camille', body: 'Fractionné : 12 × 400 m → 10 × 400 m · mar. 15 sept.', timeLabel: '09:05', group: 'today', unread: true },
  { id: 'n2', kind: 'message', title: 'Camille Roux', body: '« Si ça tire encore lundi, dis-le-moi et on adapte le bloc. »', timeLabel: '09:04', group: 'today', unread: true },
  { id: 'n3', kind: 'sessions-planned', title: '3 séances planifiées', body: 'Semaine du 14 sept. · par Camille', timeLabel: '08:30', group: 'today', unread: true },
  { id: 'n4', kind: 'strava-import', title: 'Sortie longue importée', body: '16,2 km · 1:26:40 · ressenti pas encore noté', timeLabel: '19:12', group: 'yesterday', unread: false },
  { id: 'n5', kind: 'friend-request', title: 'Nathan Girard veut t’ajouter en ami', body: 'Vous êtes tous les deux suivis par Camille', timeLabel: '17:40', group: 'yesterday', unread: false },
  { id: 'n6', kind: 'record', title: 'Nouveau record sur 400 m', body: '1:24 lors du fractionné du mar. 8 sept.', timeLabel: 'Mar.', group: 'week', unread: false },
  { id: 'n7', kind: 'competition', title: 'Marathon de Lyon dans 3 semaines', body: 'Dim. 4 oct. · objectif 3:15:00', timeLabel: 'Lun.', group: 'week', unread: false },
];

export const sampleCoachThread: ChatMessage[] = [
  { id: 'm1', fromMe: true, dayLabel: 'Hier', text: 'Séance seuil faite. Jambes lourdes sur le dernier bloc et le mollet gauche tire un peu.', timeLabel: '21:40' },
  { id: 'm2', fromMe: false, dayLabel: 'Aujourd’hui', text: 'Vu : ta FC n’est pas redescendue sous 150 entre les blocs. Pour mardi, fais plutôt 10 × 400 avec 1′30 de récup, je modifie la séance.' },
  {
    id: 'm3',
    fromMe: false,
    text: 'Séance du mardi 15 septembre : Fractionné 10 × 400 m',
    timeLabel: '09:05',
    session: { kind: 'planned', id: 'plan-2026-09-15', sport: 'running', title: 'Fractionné 10 × 400 m', meta: '11 km · 3:32 /km' },
  },
  { id: 'm4', fromMe: false, text: 'Si ça tire encore lundi, dis-le-moi et on adapte le bloc.', timeLabel: '09:05' },
  { id: 'm5', fromMe: true, text: 'Ça marche, merci !', timeLabel: '09:07' },
];
