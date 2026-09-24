// Données d'exemple de l'espace coach (mode démo), au format de l'API.
import type { ChatMessage } from '@/features/athlete/types';
import { sampleCoachThread, samplePlannedDetails, sampleRuns } from '@/features/athlete/sample-data';
import type {
  ApiAlertRulesState,
  ApiCoachBilling,
  ApiCoachGroup,
  ApiWeeklyStats,
  ApiCoachAthlete,
  ApiCoachAthleteDetail,
  ApiCoachStats,
  ApiCompetition,
  ApiConversation,
  ApiPendingInvitation,
  ApiSessionTemplate,
  ApiStatusData,
  ApiStrengthSessionDetail,
  ApiSubscriptionRequest,
  ApiUserSearchResult,
} from '@/lib/api-types';

export const COACH_SAMPLE_NOW = new Date(2026, 8, 14, 10, 0);

const sampleLongRun = Object.values(sampleRuns)[0];

const statusData = (status: ApiStatusData['status'], daysSinceActivity: number | null, extra: Partial<ApiStatusData> = {}): ApiStatusData => ({
  status,
  lastActivityDate: null,
  daysSinceActivity,
  skippedCount: 0,
  avgFeeling: 7.2,
  weeklyVolume: 42,
  baselineWeeklyVolume: 44,
  volumeDrop: false,
  ...extra,
});

const competition = (id: string, name: string, date: string, priority: 'A' | 'B' | 'C', targetTime: string | null = null): ApiCompetition => ({
  _id: id,
  name,
  date,
  priority,
  targetTime,
  status: 'upcoming',
});

export const sampleCoachStats: ApiCoachStats = { totalAthletes: 12, pendingInvitations: 2, sessionsCreatedThisWeek: 34, sessionsCreatedTotal: 1208 };

export const sampleCoachAthletes: ApiCoachAthlete[] = [
  {
    _id: 'athlete-lea',
    firstName: 'Léa',
    lastName: 'Martin',
    email: 'lea.martin@example.com',
    runningLevel: 'confirme',
    vma: 17,
    packageType: 'silver',
    joinedAt: '2026-03-03T09:00:00.000Z',
    nextCompetition: competition('comp-lyon', 'Marathon de Lyon', '2026-10-04T08:00:00.000Z', 'A', '3:05:00'),
    ...statusData('orange', 1, { skippedCount: 2, avgFeeling: 6.4, weeklyVolume: 38, baselineWeeklyVolume: 52 }),
  },
  {
    _id: 'athlete-chloe',
    firstName: 'Chloé',
    lastName: 'Bernard',
    email: 'chloe.bernard@example.com',
    vma: 15,
    packageType: 'bronze',
    joinedAt: '2026-01-12T09:00:00.000Z',
    nextCompetition: competition('comp-geneve', 'Semi de Genève', '2026-10-18T08:00:00.000Z', 'B'),
    ...statusData('green', 1),
  },
  {
    _id: 'athlete-antoine',
    firstName: 'Antoine',
    lastName: 'Moreau',
    email: 'antoine.moreau@example.com',
    vma: 18.5,
    packageType: 'silver',
    joinedAt: '2025-11-04T09:00:00.000Z',
    nextCompetition: competition('comp-aiguilles', 'Trail des Aiguilles', '2026-11-01T07:00:00.000Z', 'A'),
    ...statusData('green', 0),
  },
  { _id: 'athlete-maxime', firstName: 'Maxime', lastName: 'Petit', email: 'maxime.petit@example.com', vma: 20, packageType: 'gold', joinedAt: '2025-09-01T09:00:00.000Z', nextCompetition: null, ...statusData('green', 0) },
  {
    _id: 'athlete-ines',
    firstName: 'Inès',
    lastName: 'Robert',
    email: 'ines.robert@example.com',
    vma: 13.5,
    packageType: 'bronze',
    joinedAt: '2026-07-02T09:00:00.000Z',
    nextCompetition: competition('comp-lausanne', '10 km de Lausanne', '2026-11-07T09:00:00.000Z', 'B'),
    ...statusData('green', 2),
  },
  { _id: 'athlete-sarah', firstName: 'Sarah', lastName: 'Lambert', email: 'sarah.lambert@example.com', packageType: 'invited', joinedAt: '2026-05-20T09:00:00.000Z', nextCompetition: null, ...statusData('red', 12, { weeklyVolume: 0 }) },
];

export const sampleSubscriptionRequests: ApiSubscriptionRequest[] = [
  { _id: 'request-nathan', athlete: { _id: 'user-nathan', firstName: 'Nathan', lastName: 'Girard' }, packageType: 'silver', invitedAt: '2026-09-11T18:20:00.000Z' },
  { _id: 'request-emma', athlete: { _id: 'user-emma', firstName: 'Emma', lastName: 'Faure' }, packageType: 'bronze', invitedAt: '2026-09-10T12:05:00.000Z' },
];

export const sampleAthleteDetail: ApiCoachAthleteDetail = {
  _id: 'athlete-lea',
  firstName: 'Léa',
  lastName: 'Martin',
  email: 'lea.martin@example.com',
  runningLevel: 'confirme',
  weeklyFrequency: 5,
  injuries: 'Tendinite d’Achille (2025)',
  availableDays: ['lundi', 'mardi', 'jeudi', 'samedi', 'dimanche'],
  preferredTime: 'matin',
  height: 168,
  weight: 56,
  vma: 17,
  fcmax: 188,
  strengthFrequency: 2,
  strengthGoal: 'force',
  strengthType: 'poids_libres',
  statusTrend: 'declining',
  statusChangedAt: '2026-09-09T06:00:00.000Z',
  statusHistory: [
    { status: 'green', date: '2026-06-20T06:00:00.000Z' },
    { status: 'orange', date: '2026-08-27T06:00:00.000Z' },
  ],
  joinedAt: '2026-03-03T09:00:00.000Z',
  recentStats: {
    weeklyDistance: 21.5,
    weeklyRuns: 2,
    streak: 1,
    weeklyStrengthSessions: 1,
    recentActivities: [
      { _id: 'act-1', type: 'run', date: '2026-09-12T08:10:00.000Z', distance: 8.1, duration: 49, feeling: 6 },
      { _id: 'act-2', type: 'run', date: '2026-09-10T18:30:00.000Z', distance: 13.4, duration: 68, feeling: 5 },
      { _id: 'act-3', type: 'strength', date: '2026-09-08T12:15:00.000Z', sessionType: 'lower_body', duration: 50, feeling: 7, exerciseCount: 6 },
      { _id: 'act-4', type: 'run', date: '2026-09-07T07:40:00.000Z', distance: 9, duration: 52, feeling: 6 },
    ],
  },
  ...statusData('orange', 1, { skippedCount: 2, avgFeeling: 6.4, weeklyVolume: 38, baselineWeeklyVolume: 52 }),
};

export const sampleAthleteCompetitions: ApiCompetition[] = [competition('comp-lyon', 'Marathon de Lyon', '2026-10-04T08:00:00.000Z', 'A', '3:05:00')];

export const sampleCoachConversations: ApiConversation[] = [
  {
    _id: 'conv-lea',
    type: 'direct',
    otherParticipant: { _id: 'athlete-lea', firstName: 'Léa', lastName: 'Martin', isOnline: true },
    lastMessage: { content: 'Ça marche, merci !', type: 'text', sentAt: '2026-09-14T07:07:00.000Z' },
    unreadCount: 1,
  },
  {
    _id: 'conv-nathan',
    type: 'direct',
    otherParticipant: { _id: 'user-nathan', firstName: 'Nathan', lastName: 'Girard', isOnline: false },
    lastMessage: { content: 'Bonjour, je prépare le semi de Paris et j’aimerais un suivi hebdo.', type: 'text', sentAt: '2026-09-13T17:42:00.000Z' },
    unreadCount: 2,
  },
  {
    _id: 'conv-antoine',
    type: 'direct',
    otherParticipant: { _id: 'athlete-antoine', firstName: 'Antoine', lastName: 'Moreau', isOnline: false },
    lastMessage: { content: 'Top pour le seuil, on garde ce rythme la semaine prochaine.', type: 'text', sentAt: '2026-09-11T19:15:00.000Z' },
    unreadCount: 0,
  },
  {
    _id: 'conv-chloe',
    type: 'direct',
    otherParticipant: { _id: 'athlete-chloe', firstName: 'Chloé', lastName: 'Bernard', isOnline: false },
    lastMessage: { content: 'Photo', type: 'image', sentAt: '2026-08-30T09:02:00.000Z' },
    unreadCount: 0,
  },
];

/** Messages vus par la coach : la conversation de l'athlète démo, du point de vue inverse. */
export const sampleCoachMessages = (peerId: string): ChatMessage[] =>
  peerId === 'athlete-lea' ? sampleCoachThread.map((message) => ({ ...message, fromMe: !message.fromMe })) : [];

const zone = (key: string) => ({ mode: 'zone' as const, zone: key });
const percent = (vmaPercent: number) => ({ mode: 'vmaPercent' as const, vmaPercent });
const template = (fields: Pick<ApiSessionTemplate, '_id' | 'name' | 'sport' | 'sessionType' | 'usageCount'> & Partial<ApiSessionTemplate>): ApiSessionTemplate => ({
  targetDistance: null,
  targetDuration: null,
  runBlocks: [],
  strengthPlan: null,
  lastUsedAt: null,
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...fields,
});

export const sampleTemplates: ApiSessionTemplate[] = [
  template({
    _id: 'template-12x400',
    name: 'Fractionné 12 × 400 m',
    description: 'Développer la VMA : 400 m à 100 % VMA, récupération courte.',
    sport: 'running',
    sessionType: 'fractionne',
    usageCount: 34,
    runBlocks: [
      { role: 'warmup', mode: 'duration', duration: 20, pace: zone('endurance'), order: 0 },
      { role: 'main', mode: 'distance', distance: 0.4, pace: percent(100), repetitions: 12, recoveryMode: 'duration', recoveryDuration: '1min15', recoveryDescription: 'trot', order: 1 },
      { role: 'cooldown', mode: 'duration', duration: 10, pace: zone('endurance'), order: 2 },
    ],
  }),
  template({
    _id: 'template-8x1000',
    name: 'VMA 8 × 1000 m',
    sport: 'running',
    sessionType: 'fractionne',
    usageCount: 21,
    runBlocks: [
      { role: 'warmup', mode: 'duration', duration: 20, pace: zone('endurance'), order: 0 },
      { role: 'main', mode: 'distance', distance: 1, pace: zone('vma'), repetitions: 8, recoveryMode: 'duration', recoveryDuration: '2min', order: 1 },
      { role: 'cooldown', mode: 'duration', duration: 10, pace: zone('endurance'), order: 2 },
    ],
  }),
  template({
    _id: 'template-seuil',
    name: 'Seuil 3 × 3 km',
    sport: 'running',
    sessionType: 'tempo',
    usageCount: 18,
    runBlocks: [
      { role: 'warmup', mode: 'duration', duration: 20, pace: zone('endurance'), order: 0 },
      { role: 'main', mode: 'distance', distance: 3, pace: zone('threshold'), repetitions: 3, recoveryMode: 'duration', recoveryDuration: '3min', order: 1 },
      { role: 'cooldown', mode: 'duration', duration: 10, pace: zone('endurance'), order: 2 },
    ],
  }),
  template({
    _id: 'template-sortie-longue',
    name: 'Sortie longue 18 km',
    sport: 'running',
    sessionType: 'sortie_longue',
    usageCount: 26,
    runBlocks: [
      { role: 'main', mode: 'distance', distance: 15, pace: zone('endurance'), order: 0 },
      { role: 'main', mode: 'distance', distance: 3, pace: zone('marathon'), order: 1 },
    ],
  }),
  template({
    _id: 'template-renfo',
    name: 'Renfo bas du corps',
    sport: 'strength',
    sessionType: 'lower_body',
    usageCount: 15,
    strengthPlan: samplePlannedDetails['plan-2026-09-17'].strengthPlan,
  }),
  template({
    _id: 'template-gainage',
    name: 'Gainage & pieds',
    sport: 'strength',
    sessionType: 'core',
    usageCount: 11,
    strengthPlan: {
      estimatedDuration: 20,
      circuit: {
        rounds: 3,
        restBetweenRounds: 45,
        exercises: [
          { exercise: { _id: 'ex-plank', name: 'Planche' }, targetReps: '40 s' },
          { exercise: { _id: 'ex-side-plank', name: 'Gainage latéral' }, targetReps: '30 s' },
          { exercise: { _id: 'ex-calf', name: 'Mollets debout' }, targetReps: '20' },
        ],
      },
    },
  }),
];

export const sampleInviteCode = 'CAMILLE24';

export const samplePendingInvitations: ApiPendingInvitation[] = [
  { _id: 'invitation-paul', athlete: { _id: 'user-paul', firstName: 'Paul', lastName: 'Fontaine', email: 'paul.fontaine@example.com' }, invitedAt: '2026-09-09T10:00:00.000Z', inviteMethod: 'direct' },
];

export const sampleSearchResults: ApiUserSearchResult[] = [
  { _id: 'user-julie', firstName: 'Julie', lastName: 'Mercier', email: 'julie.mercier@example.com', relationStatus: null, hasCoach: false },
  { _id: 'user-paul', firstName: 'Paul', lastName: 'Fontaine', email: 'paul.fontaine@example.com', relationStatus: 'pending', hasCoach: false },
  { _id: 'user-hugo', firstName: 'Hugo', lastName: 'Lefebvre', email: 'hugo.lefebvre@example.com', relationStatus: null, hasCoach: true },
  { _id: 'athlete-lea', firstName: 'Léa', lastName: 'Martin', email: 'lea.martin@example.com', relationStatus: 'accepted', hasCoach: true },
];

/** Sortie d'un athlète, telle que le coach la consulte (mode démo). */
export const sampleCoachRun = {
  run: { ...sampleLongRun, id: 'run-2026-09-09', date: '2026-09-09', title: 'Sortie longue' },
  snapshot: {
    title: 'Sortie longue 20 km',
    coach: 'coach-camille',
    sessionType: 'sortie_longue',
    targetDistance: 20,
    targetDuration: 105,
    targetPace: '5:15',
    description: 'Endurance fondamentale, relances légères sur les 2 derniers km.',
  },
};

export const sampleStrengthDone: ApiStrengthSessionDetail = {
  _id: 'strength-2026-09-11',
  date: '2026-09-11T18:20:00.000Z',
  duration: 55,
  sessionType: 'lower_body',
  feeling: 7,
  stravaActivityId: null,
  totalSets: 17,
  notes: 'Squat un peu juste sur la dernière série, mollets faciles.',
  linkedPlannedSession: 'plan-2026-09-17',
  exercises: [
    {
      exercise: { _id: 'ex-squat', name: 'Squat barre', primaryMuscle: 'quadriceps' },
      order: 0,
      block: { kind: 'single' },
      target: { sets: 4, reps: '8-10', weight: 60, rest: '90 s' },
      sets: [
        { reps: 10, weight: 60 },
        { reps: 10, weight: 60 },
        { reps: 8, weight: 60 },
      ],
      notes: 'Arrêté à 3 séries, dos qui s’arrondit.',
    },
    {
      exercise: { _id: 'ex-bulgarian', name: 'Fente bulgare', primaryMuscle: 'glutes' },
      order: 1,
      block: { kind: 'single' },
      target: { sets: 3, reps: '10', weight: 12, rest: '60 s' },
      sets: [
        { reps: 10, weight: 12 },
        { reps: 10, weight: 12 },
        { reps: 10, weight: 14 },
      ],
    },
    {
      exercise: { _id: 'ex-hip-thrust', name: 'Hip thrust', primaryMuscle: 'glutes' },
      order: 2,
      block: { kind: 'superset', pairIndex: 0, slot: 'a' },
      target: { reps: '12', weight: 40 },
      sets: [
        { reps: 12, weight: 40 },
        { reps: 12, weight: 40 },
        { reps: 12, weight: 45 },
      ],
    },
    {
      exercise: { _id: 'ex-calf', name: 'Mollets debout', primaryMuscle: 'calves' },
      order: 3,
      block: { kind: 'superset', pairIndex: 0, slot: 'b' },
      target: { reps: '15' },
      sets: [{ reps: 15 }, { reps: 15 }, { reps: 15 }],
    },
    {
      exercise: { _id: 'ex-plank', name: 'Planche', primaryMuscle: 'core' },
      order: 4,
      block: { kind: 'circuit' },
      target: { reps: '40 s' },
      sets: [{ reps: 40 }, { reps: 40 }, { reps: 35 }],
    },
  ],
  circuit: { name: 'Gainage', rounds: 3, restBetweenRounds: 45 },
  superset: { name: 'Super-set fessiers', sets: 3, restBetweenSets: 75 },
};

/** Seuils d'alerte affichés en mode démo : les valeurs par défaut, non modifiables. */
export const sampleAlertRules: ApiAlertRulesState = {
  rules: {
    inactivityOrange: 7,
    inactivityRed: 14,
    skippedOrange: 1,
    skippedRed: 3,
    feelingOrange: 7,
    feelingRed: 4,
    volumeDropEnabled: true,
    volumeDropPercent: 50,
  },
  editable: false,
  planName: 'Découverte',
};

/** Deux groupes d'exemple pour le mode démo. */
export const sampleCoachGroups: ApiCoachGroup[] = [
  {
    id: 'grp-marathon',
    name: 'Marathon de Lyon',
    color: 'violet',
    race: { name: 'Marathon de Lyon', date: '2026-10-04T08:00:00.000Z' },
    athletes: [
      { id: 'ath-1', firstName: 'Camille', lastName: 'Rey' },
      { id: 'ath-2', firstName: 'Nicolas', lastName: 'Perrin' },
    ],
  },
  {
    id: 'grp-piste',
    name: 'Groupe piste',
    color: 'vert',
    race: null,
    athletes: [{ id: 'ath-3', firstName: 'Léa', lastName: 'Fournier' }],
  },
];

export const sampleWeeklyStats: ApiWeeklyStats = {
  weeks: [
    { label: 'S36', planned: 12, done: 11 },
    { label: 'S37', planned: 14, done: 12 },
    { label: 'S38', planned: 13, done: 13 },
    { label: 'S39', planned: 15, done: 9 },
  ],
  totals: { planned: 54, done: 45 },
  completionRate: 87,
};

/** Abonnement affiché en mode démo. */
export const sampleCoachBilling: ApiCoachBilling = {
  configured: true,
  plans: [
    { id: 'decouverte', name: 'Découverte', athletes: 3, groups: 0, customAlerts: false },
    { id: 'coach', name: 'Coach', athletes: 15, groups: 3, customAlerts: false },
    { id: 'studio', name: 'Studio', athletes: 40, groups: null, customAlerts: true },
    { id: 'club', name: 'Club', athletes: 100, groups: null, customAlerts: true },
  ],
  subscription: { planId: 'coach', cycle: 'monthly', status: 'active', renewsOn: '2026-10-19T00:00:00.000Z', cancelAtPeriodEnd: false, managed: true },
  usage: { athletes: 4, athleteLimit: 15, groups: 2, groupLimit: 3 },
};
