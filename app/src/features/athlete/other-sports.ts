// Les sports que Trainwise ne programme pas en détail (vélo, natation, ski…) : on les montre
// tels que Strava les envoie, chiffres clés et description.
import type { IconName } from '@/components/ui';
import type { ApiOtherActivity } from '@/lib/api-types';
import { formatClock, formatDecimal, formatHoursMinutes, formatPace, toIsoDay } from '@/lib/format';

import type { OtherActivity, OtherSportFamily, PlannedSession, Sport } from './types';

/** sport_type Strava → libellé et famille. Un sport absent de la liste reste « Autre sport ». */
const SPORTS: Record<string, { label: string; family: OtherSportFamily }> = {
  Ride: { label: 'Vélo', family: 'bike' },
  VirtualRide: { label: 'Home trainer', family: 'bike' },
  MountainBikeRide: { label: 'VTT', family: 'bike' },
  GravelRide: { label: 'Gravel', family: 'bike' },
  EBikeRide: { label: 'Vélo électrique', family: 'bike' },
  EMountainBikeRide: { label: 'VTT électrique', family: 'bike' },
  Velomobile: { label: 'Vélomobile', family: 'bike' },
  Handcycle: { label: 'Handbike', family: 'bike' },
  Swim: { label: 'Natation', family: 'swim' },
  Walk: { label: 'Marche', family: 'other' },
  Hike: { label: 'Randonnée', family: 'mountain' },
  AlpineSki: { label: 'Ski alpin', family: 'mountain' },
  BackcountrySki: { label: 'Ski de randonnée', family: 'mountain' },
  NordicSki: { label: 'Ski de fond', family: 'mountain' },
  Snowboard: { label: 'Snowboard', family: 'mountain' },
  Snowshoe: { label: 'Raquettes', family: 'mountain' },
  RockClimbing: { label: 'Escalade', family: 'mountain' },
  IceSkate: { label: 'Patinage', family: 'other' },
  InlineSkate: { label: 'Roller', family: 'other' },
  Skateboard: { label: 'Skateboard', family: 'other' },
  Canoeing: { label: 'Canoë', family: 'water' },
  Kayaking: { label: 'Kayak', family: 'water' },
  StandUpPaddling: { label: 'Paddle', family: 'water' },
  Surfing: { label: 'Surf', family: 'water' },
  Kitesurf: { label: 'Kitesurf', family: 'water' },
  Windsurf: { label: 'Planche à voile', family: 'water' },
  Sail: { label: 'Voile', family: 'water' },
  Soccer: { label: 'Football', family: 'other' },
  Tennis: { label: 'Tennis', family: 'other' },
  Padel: { label: 'Padel', family: 'other' },
  Badminton: { label: 'Badminton', family: 'other' },
  Squash: { label: 'Squash', family: 'other' },
  TableTennis: { label: 'Tennis de table', family: 'other' },
  Golf: { label: 'Golf', family: 'other' },
};

const FAMILY_ICONS: Record<OtherSportFamily, IconName> = { bike: 'bike', swim: 'swim', water: 'swim', mountain: 'mountain', other: 'activity' };

export const otherSportIcon = (family: OtherSportFamily) => FAMILY_ICONS[family];

export function mapOtherActivity(activity: ApiOtherActivity): OtherActivity {
  const sport = SPORTS[activity.sportType] ?? { label: 'Autre sport', family: 'other' as const };
  const local = activity.startDateLocal;
  return {
    id: activity._id,
    // L'heure locale de l'athlète fixe le jour : une sortie à 23 h reste sur sa journée.
    date: local ? local.slice(0, 10) : toIsoDay(new Date(activity.date)),
    startTime: local ? local.slice(11, 16) : undefined,
    family: sport.family,
    sportLabel: sport.label,
    title: activity.name?.trim() || sport.label,
    description: activity.description?.trim() ?? '',
    distanceKm: activity.distance || undefined,
    durationSec: activity.movingTime || activity.elapsedTime || 0,
    elevationGain: activity.elevationGain ? Math.round(activity.elevationGain) : undefined,
    avgSpeedMs: activity.averageSpeed || undefined,
    avgHr: activity.averageHeartRate ? Math.round(activity.averageHeartRate) : undefined,
    avgWatts: activity.averageWatts ? Math.round(activity.averageWatts) : undefined,
  };
}

/** Distance d'un autre sport : en mètres pour la natation, en km sinon. */
const otherDistance = (family: OtherSportFamily, km: number) => (family === 'swim' ? { value: `${Math.round(km * 1000)}`, unit: 'm' } : { value: formatDecimal(km, 1), unit: 'km' });

export type OtherStat = { label: string; value: string; unit?: string };

/** Les chiffres qui parlent pour chaque sport : vitesse et D+ à vélo, allure au 100 m en natation. */
export function otherActivityStats(activity: OtherActivity): OtherStat[] {
  const stats: OtherStat[] = [];
  if (activity.distanceKm) stats.push({ label: 'Distance', ...otherDistance(activity.family, activity.distanceKm) });
  if (activity.durationSec) stats.push({ label: 'Durée', value: formatClock(activity.durationSec) });
  if (activity.avgSpeedMs && activity.family === 'swim') stats.push({ label: 'Allure', value: formatPace(100 / activity.avgSpeedMs), unit: '/100 m' });
  else if (activity.avgSpeedMs && activity.family === 'bike') stats.push({ label: 'Vitesse', value: formatDecimal(activity.avgSpeedMs * 3.6, 1), unit: 'km/h' });
  else if (activity.elevationGain) stats.push({ label: 'D+', value: `${activity.elevationGain}`, unit: 'm' });
  return stats;
}

/** Résumé d'une ligne pour la carte du planning : « 1 500 m · 45:00 · 2:58 /100 m ». */
export function otherActivityMeta(activity: OtherActivity) {
  return otherActivityStats(activity)
    .map((stat) => (stat.unit ? `${stat.value} ${stat.unit}` : stat.value))
    .join(' · ');
}

// --- Séances programmées : icône, libellé et distance selon le sport ---

const SPORT_ICONS: Record<Sport, IconName> = { running: 'route', strength: 'dumbbell', bike: 'bike', swim: 'swim' };

export const SPORT_LABELS: Record<Sport, string> = { running: 'Course', strength: 'Musculation', bike: 'Vélo', swim: 'Natation' };

export const sportIcon = (sport: Sport) => SPORT_ICONS[sport];

export const isOtherSport = (sport: Sport) => sport === 'bike' || sport === 'swim';

/** Distance d'une séance : en mètres pour la natation, en km sinon. */
export function sessionDistance(sport: Sport, km: number) {
  return sport === 'swim' ? { value: `${Math.round(km * 1000)}`, unit: 'm' } : { value: formatDecimal(km, km % 1 ? 1 : 0), unit: 'km' };
}

/** Résumé d'une séance vélo ou natation : « 1500 m · 45 min ». */
export function otherSessionMeta(session: Pick<PlannedSession, 'sport' | 'distanceKm' | 'durationMin'>) {
  const distance = session.distanceKm ? sessionDistance(session.sport, session.distanceKm) : null;
  return [distance ? `${distance.value} ${distance.unit}` : null, session.durationMin ? formatHoursMinutes(session.durationMin * 60) : null].filter(Boolean).join(' · ');
}
