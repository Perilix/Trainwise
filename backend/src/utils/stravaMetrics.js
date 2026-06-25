// ============================================================================
// Extrait un sous-ensemble léger et exploitable des données Strava détaillées
// (activity detail) pour enrichir l'affichage d'une séance : laps, splits/km,
// best efforts, zones d'allure, chaussures, dénivelé, social…
// On NE stocke PAS le payload complet (polyline streams, etc.), juste l'utile.
// ============================================================================

const { speedToPaceStr } = require('./stravaReconstruct');

function mapLap(l) {
  return {
    lapIndex: l.lap_index,
    name: l.name,
    distance: l.distance,                 // m
    movingTime: l.moving_time,            // s
    elapsedTime: l.elapsed_time,          // s
    averageSpeed: l.average_speed,        // m/s
    maxSpeed: l.max_speed,                // m/s
    paceZone: l.pace_zone ?? null,
    averageHeartrate: l.average_heartrate ?? null,
    averageCadence: l.average_cadence ?? null,
    totalElevationGain: l.total_elevation_gain ?? null,
    pace: speedToPaceStr(l.average_speed)
  };
}

function mapSplit(s) {
  return {
    split: s.split,
    distance: s.distance,                 // m (~1000)
    movingTime: s.moving_time,            // s
    elapsedTime: s.elapsed_time,          // s
    averageSpeed: s.average_speed,        // m/s
    paceZone: s.pace_zone ?? null,
    elevationDifference: s.elevation_difference ?? null,
    averageHeartrate: s.average_heartrate ?? null,
    pace: speedToPaceStr(s.average_speed)
  };
}

function mapBestEffort(b) {
  return {
    name: b.name,
    distance: b.distance,                 // m
    movingTime: b.moving_time,            // s
    elapsedTime: b.elapsed_time,          // s
    prRank: b.pr_rank ?? null,            // 1/2/3 si record perso
    pace: b.distance ? speedToPaceStr(b.distance / (b.moving_time || b.elapsed_time)) : null
  };
}

/** Répartition du temps (s) par zone d'allure, calculée depuis les splits/km (sinon laps). */
function paceZoneDistribution(splits, laps) {
  const src = (splits && splits.length) ? splits : (laps || []);
  const dist = {};
  for (const s of src) {
    const z = s.pace_zone ?? s.paceZone;
    if (z == null) continue;
    const t = s.moving_time || s.movingTime || s.elapsed_time || s.elapsedTime || 0;
    dist[z] = (dist[z] || 0) + t;
  }
  return dist; // { 1: 120, 2: 600, 3: 90, ... } en secondes
}

/**
 * @param {Object} d - activity detail Strava (le `full`)
 * @returns {Object} stravaData léger à stocker sur le Run
 */
function buildStravaData(d) {
  if (!d) return null;
  const laps = (d.laps || []).map(mapLap);
  const splits = (d.splits_metric || []).map(mapSplit);

  return {
    activityId: d.id,
    name: d.name,
    type: d.type,
    sportType: d.sport_type,
    workoutType: d.workout_type ?? null,
    description: d.description || '',
    startDateLocal: d.start_date_local || null,
    timezone: d.timezone || null,

    distance: d.distance,                 // m
    movingTime: d.moving_time,            // s
    elapsedTime: d.elapsed_time,          // s
    averageSpeed: d.average_speed,        // m/s
    maxSpeed: d.max_speed,                // m/s
    averagePace: speedToPaceStr(d.average_speed),

    calories: d.calories ?? null,
    totalElevationGain: d.total_elevation_gain ?? null,
    elevHigh: d.elev_high ?? null,
    elevLow: d.elev_low ?? null,

    hasHeartrate: !!d.has_heartrate,
    averageHeartrate: d.average_heartrate ?? null,
    maxHeartrate: d.max_heartrate ?? null,
    averageCadence: d.average_cadence ?? null,
    availableZones: d.available_zones || [],

    // Contexte
    athleteCount: d.athlete_count ?? 1,
    kudosCount: d.kudos_count ?? 0,
    commentCount: d.comment_count ?? 0,
    prCount: d.pr_count ?? 0,
    achievementCount: d.achievement_count ?? 0,
    gear: d.gear ? {
      name: d.gear.name,
      nickname: d.gear.nickname || null,
      distanceKm: d.gear.distance != null ? Math.round(d.gear.distance / 1000) : null
    } : null,

    laps,
    splits,
    bestEfforts: (d.best_efforts || []).map(mapBestEffort),
    segmentEffortsCount: (d.segment_efforts || []).length,
    paceZoneDistribution: paceZoneDistribution(splits, laps),

    syncedAt: new Date()
  };
}

module.exports = { buildStravaData };
