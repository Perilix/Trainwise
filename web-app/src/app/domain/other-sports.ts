// Les sports que Trainwise ne programme pas (vélo, natation, ski…) : on les montre
// dans le planning tels que Strava les envoie, chiffres clés et description.
import type { ApiOtherActivity } from '../core/api-types';
import { formatDecimal, formatHoursMinutes, formatPace, toIsoDay } from '../core/format';

import type { OtherActivity, OtherSportFamily, PlannedSession, Sport } from './athlete.types';

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
  Pickleball: { label: 'Pickleball', family: 'other' },
  Racquetball: { label: 'Racquetball', family: 'other' },
  Golf: { label: 'Golf', family: 'other' },
  Wheelchair: { label: 'Fauteuil', family: 'other' },
};

const ICONS: Record<OtherSportFamily, string> = {
  bike: 'bike',
  swim: 'swim',
  water: 'swim',
  mountain: 'mountain',
  other: 'activity',
};

export const otherSportIcon = (family: OtherSportFamily) => ICONS[family];

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
    maxHr: activity.maxHeartRate ? Math.round(activity.maxHeartRate) : undefined,
    avgWatts: activity.averageWatts ? Math.round(activity.averageWatts) : undefined,
  };
}

export type OtherStat = { label: string; value: string; unit: string };

/** Les chiffres qui parlent pour chaque sport : vitesse et D+ à vélo, allure au 100 m en natation. */
export function otherActivityStats(activity: OtherActivity): OtherStat[] {
  const stats: OtherStat[] = [];
  if (activity.durationSec) stats.push({ label: 'Durée', value: formatHoursMinutes(activity.durationSec), unit: '' });
  if (activity.distanceKm) {
    stats.push(
      activity.family === 'swim'
        ? { label: 'Distance', value: `${Math.round(activity.distanceKm * 1000)}`, unit: 'm' }
        : { label: 'Distance', value: formatDecimal(activity.distanceKm, 1), unit: 'km' },
    );
  }
  if (activity.avgSpeedMs) {
    if (activity.family === 'swim') stats.push({ label: 'Allure', value: formatPace(100 / activity.avgSpeedMs), unit: '/100 m' });
    else if (activity.family === 'bike') stats.push({ label: 'Vitesse', value: formatDecimal(activity.avgSpeedMs * 3.6, 1), unit: 'km/h' });
  }
  if (activity.elevationGain && activity.family !== 'swim') stats.push({ label: 'D+', value: `${activity.elevationGain}`, unit: 'm' });
  if (activity.avgWatts) stats.push({ label: 'Puissance', value: `${activity.avgWatts}`, unit: 'W' });
  if (activity.avgHr) stats.push({ label: 'FC moy.', value: `${activity.avgHr}`, unit: 'bpm' });
  if (activity.maxHr) stats.push({ label: 'FC max', value: `${activity.maxHr}`, unit: 'bpm' });
  return stats;
}

/** Résumé d'une ligne, pour la pastille du calendrier. */
export function otherActivityMeta(activity: OtherActivity) {
  if (activity.distanceKm) {
    return activity.family === 'swim' ? `${Math.round(activity.distanceKm * 1000)} m` : `${formatDecimal(activity.distanceKm, 1)} km`;
  }
  return activity.durationSec ? formatHoursMinutes(activity.durationSec) : activity.sportLabel;
}

// --- Séances programmées en vélo et natation ---

const SPORT_ICONS: Record<Sport, string> = { running: 'run', strength: 'dumbbell', bike: 'bike', swim: 'swim' };

export const SPORT_LABELS: Record<Sport, string> = { running: 'Course', strength: 'Renforcement', bike: 'Vélo', swim: 'Natation' };

/** Icône d'une séance selon son sport. */
export const sportIcon = (sport: Sport) => SPORT_ICONS[sport];

export const isOtherSport = (sport: Sport) => sport === 'bike' || sport === 'swim';

/** Distance d'une séance : en mètres pour la natation, en km sinon. */
export function sessionDistance(sport: Sport, km: number) {
  return sport === 'swim' ? `${Math.round(km * 1000)} m` : `${formatDecimal(km, km % 1 ? 1 : 0)} km`;
}

/** Objectifs d'une séance vélo ou natation : distance et durée, pas d'allure. */
export function plannedOtherStats(session: Pick<PlannedSession, 'sport' | 'distanceKm' | 'durationMin'>): OtherStat[] {
  const swim = session.sport === 'swim';
  const km = session.distanceKm;
  return [
    { label: 'Distance', value: km ? (swim ? `${Math.round(km * 1000)}` : formatDecimal(km, km % 1 ? 1 : 0)) : '—', unit: km ? (swim ? 'm' : 'km') : '' },
    { label: 'Durée', value: session.durationMin ? formatHoursMinutes(session.durationMin * 60) : '—', unit: '' },
  ];
}
