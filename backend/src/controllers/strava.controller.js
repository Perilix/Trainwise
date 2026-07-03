const axios = require('axios');
const User = require('../models/user.model');
const Run = require('../models/run.model');
const StrengthSession = require('../models/strengthSession.model');
const { emitTrainCoinsUpdate } = require('../socket/index');
const { createNotification } = require('./notification.controller');
const { findPlannedMatches } = require('../services/planningAutoComplete');
const { athleteHasCoach } = require('../services/coachRelation.service');
const { getUpcomingCompetitionsForContext } = require('../utils/competitions');
const { reconstructBlocksFromLaps } = require('../utils/stravaReconstruct');
const { buildStravaData } = require('../utils/stravaMetrics');

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_URL = 'https://www.strava.com/api/v3';

// Helper: Analyser une course en arrière-plan
const analyzeRunInBackground = async (run, user) => {
  if (!process.env.N8N_WEBHOOK_URL) return;

  // Athlète coaché : pas d'analyse IA, c'est le coach qui assure le suivi
  if (await athleteHasCoach(user._id)) return;

  try {
    // Vérifier et déduire les TrainCoins (0.5 par analyse auto)
    const freshUser = await User.findById(user._id);
    if (!freshUser) return;

    const isPro = freshUser.subscriptionStatus === 'pro' &&
      freshUser.subscriptionExpiry && new Date(freshUser.subscriptionExpiry) > new Date();

    if (!isPro) {
      if ((freshUser.trainCoins || 0) < 0.5) return; // Pas assez de coins, on ne lance pas l'analyse
      await User.findByIdAndUpdate(user._id, { $inc: { trainCoins: -0.5 } });
      emitTrainCoinsUpdate(user._id, { trainCoins: (freshUser.trainCoins || 0) - 0.5 });
    }

    // Récupérer les 5 dernières courses
    const recentRuns = await Run.find({
      user: user._id,
      _id: { $ne: run._id }
    }).sort({ date: -1 }).limit(5);

    // Stats 2 dernières semaines
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksRuns = await Run.find({
      user: user._id,
      date: { $gte: twoWeeksAgo },
      _id: { $ne: run._id }
    });

    const totalDistance = twoWeeksRuns.reduce((sum, r) => sum + (r.distance || 0), 0);
    const totalDuration = twoWeeksRuns.reduce((sum, r) => sum + (r.duration || 0), 0);
    const upcomingCompetitions = await getUpcomingCompetitionsForContext(user._id);

    const enrichedContext = {
      runId: run._id,
      currentRun: {
        date: run.date,
        distance: run.distance,
        duration: run.duration,
        averagePace: run.averagePace,
        averageHeartRate: run.averageHeartRate,
        maxHeartRate: run.maxHeartRate,
        averageCadence: run.averageCadence,
        elevationGain: run.elevationGain,
        sessionType: run.sessionType,
        feeling: run.feeling ?? null,
        notes: run.notes || null
      },
      runner: {
        name: `${freshUser.firstName} ${freshUser.lastName}`,
        level: freshUser.runningLevel,
        weeklyFrequency: freshUser.weeklyFrequency,
        injuries: freshUser.injuries || null,
        height: freshUser.height || null,
        weight: freshUser.weight || null,
        vma: freshUser.vma || null,
        fcmax: freshUser.fcmax || null
      },
      upcomingCompetitions,
      recentRuns: recentRuns.map(r => ({
        date: r.date,
        distance: r.distance,
        duration: r.duration,
        averagePace: r.averagePace,
        sessionType: r.sessionType
      })),
      twoWeeksStats: {
        totalRuns: twoWeeksRuns.length,
        totalDistance: Math.round(totalDistance * 10) / 10,
        totalDuration: Math.round(totalDuration)
      }
    };

    const response = await axios.post(process.env.N8N_WEBHOOK_URL, enrichedContext);

    if (response.data?.analysis) {
      await Run.findByIdAndUpdate(run._id, {
        analysis: response.data.analysis,
        analyzedAt: new Date()
      });
    }
  } catch (e) {
    console.error(`Background analysis failed for run ${run._id}:`, e.message);
  }
};

// Helper: Convertir secondes en minutes
const secondsToMinutes = (seconds) => Math.round(seconds / 60 * 10) / 10;

// Helper: Convertir m/s en pace (min/km)
const speedToPace = (metersPerSecond) => {
  if (!metersPerSecond || metersPerSecond === 0) return null;
  const paceSeconds = 1000 / metersPerSecond;
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Helper: Récupérer le type d'activité (sport_type en priorité, type en fallback)
const getActivityType = (activity) => activity.sport_type || activity.type || '';

// Helper: Mapper le type Strava vers nos types de session (course)
const mapStravaType = (stravaType) => {
  const typeMap = {
    'Run': 'endurance',
    'TrailRun': 'trail',
    'VirtualRun': 'endurance'
  };
  return typeMap[stravaType] || 'endurance';
};

// Types Strava considérés comme de la course à pied
const STRAVA_RUN_TYPES = ['Run', 'TrailRun', 'VirtualRun'];

// Types Strava considérés comme de la muscu / strength
const STRAVA_STRENGTH_TYPES = ['WeightTraining', 'Crossfit', 'Workout', 'Yoga', 'Pilates', 'Elliptical', 'StairStepper', 'Rowing', 'HighIntensityIntervalTraining', 'Hiit'];

// Helper: Mapper le type Strava vers nos types de séance muscu
const mapStravaStrengthType = (stravaType) => {
  const typeMap = {
    'WeightTraining': 'full_body',
    'Crossfit': 'hiit',
    'Workout': 'full_body',
    'Yoga': 'other',
    'Pilates': 'core',
    'Elliptical': 'other',
    'StairStepper': 'legs',
    'Rowing': 'full_body',
    'HighIntensityIntervalTraining': 'hiit',
    'Hiit': 'hiit'
  };
  return typeMap[stravaType] || 'other';
};

// Helper: Rafraîchir le token si expiré
const refreshTokenIfNeeded = async (user) => {
  const now = Math.floor(Date.now() / 1000);

  if (user.strava.expiresAt && user.strava.expiresAt > now + 300) {
    // Token valide pour au moins 5 minutes
    return user.strava.accessToken;
  }

  // Rafraîchir le token
  const response = await axios.post(STRAVA_TOKEN_URL, {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: user.strava.refreshToken
  });

  // Mettre à jour les tokens
  await User.findByIdAndUpdate(user._id, {
    'strava.accessToken': response.data.access_token,
    'strava.refreshToken': response.data.refresh_token,
    'strava.expiresAt': response.data.expires_at
  });

  return response.data.access_token;
};

// ── Import d'une activité course (utilisé par la sync manuelle ET le webhook) ──
// `activity` peut être un summary (liste d'activités) ou un détail complet ;
// si `prefetchedDetail` n'est pas fourni, le détail est récupéré auprès de l'API.
const importRunActivity = async (userId, activity, accessToken, fullUser, prefetchedDetail = null) => {
  const existing = await Run.findOne({ user: userId, stravaActivityId: activity.id });
  if (existing) return { status: 'skipped', run: existing };

  let description = '';
  let polyline = activity.map?.summary_polyline || null;
  let startLatLng = activity.start_latlng || null;
  let endLatLng = activity.end_latlng || null;
  let stravaData = null;
  let detailLaps = null;

  let detail = prefetchedDetail;
  if (!detail) {
    try {
      const detailResponse = await axios.get(`${STRAVA_API_URL}/activities/${activity.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      detail = detailResponse.data;
    } catch (e) {
      console.error(`Failed to fetch details for activity ${activity.id}`);
    }
  }

  if (detail) {
    // Métriques détaillées (laps, splits, zones, chaussures…)
    stravaData = buildStravaData(detail);
    detailLaps = detail.laps;
    description = detail.description || '';
    if (detail.map?.polyline) polyline = detail.map.polyline;
    if (detail.start_latlng) startLatLng = detail.start_latlng;
    if (detail.end_latlng) endLatLng = detail.end_latlng;
  }

  let notes = activity.name;
  if (description) {
    notes += `\n\n${description}`;
  }

  // Suggestion de match avec une séance planifiée (l'athlète confirmera via la popup UI)
  const plannedCandidates = await findPlannedMatches(userId, new Date(activity.start_date), 'running');

  // Reconstruction des blocs réalisés : si une séance coach matche ce jour-là, on
  // CALE les laps sur son squelette (10×500 prévu → rempli avec 10×550 réels) ;
  // sinon détection autonome de la structure.
  const reconstructedBlocks = reconstructBlocksFromLaps(detailLaps, plannedCandidates[0]?.runBlocks);

  const run = new Run({
    user: userId,
    stravaActivityId: activity.id,
    date: new Date(activity.start_date),
    distance: Math.round(activity.distance / 1000 * 100) / 100,
    duration: secondsToMinutes(activity.moving_time),
    averagePace: speedToPace(activity.average_speed),
    averageHeartRate: activity.average_heartrate || null,
    maxHeartRate: activity.max_heartrate || null,
    averageCadence: activity.average_cadence ? Math.round(activity.average_cadence * 2) : null,
    elevationGain: activity.total_elevation_gain || null,
    sessionType: mapStravaType(getActivityType(activity)),
    notes,
    polyline,
    startLatLng,
    endLatLng,
    pendingPlannedMatch: plannedCandidates[0]?._id || null,
    stravaData: stravaData || undefined,
    runBlocks: reconstructedBlocks.length ? reconstructedBlocks : undefined,
    blocksAutoReconstructed: reconstructedBlocks.length > 0
  });

  await run.save();
  analyzeRunInBackground(run, fullUser);

  if (run.maxHeartRate) {
    await User.updateOne(
      { _id: userId, $or: [{ fcmax: null }, { fcmax: { $lt: run.maxHeartRate } }] },
      { $set: { fcmax: run.maxHeartRate } }
    );
  }

  return { status: 'imported', run, plannedCandidate: plannedCandidates[0] || null };
};

// ── Import d'une activité muscu (sync manuelle + webhook) ──
const importStrengthActivity = async (userId, activity, accessToken, prefetchedDetail = null) => {
  const existing = await StrengthSession.findOne({ user: userId, stravaActivityId: activity.id });
  if (existing) return { status: 'skipped', session: existing };

  let description = prefetchedDetail?.description || '';
  if (!prefetchedDetail) {
    try {
      const detailResponse = await axios.get(`${STRAVA_API_URL}/activities/${activity.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      description = detailResponse.data.description || '';
    } catch (e) {
      console.error(`Failed to fetch strength details for activity ${activity.id}`);
    }
  }

  let notes = activity.name;
  if (description) notes += `\n\n${description}`;

  const strengthCandidates = await findPlannedMatches(userId, new Date(activity.start_date), 'strength');

  const session = new StrengthSession({
    user: userId,
    stravaActivityId: activity.id,
    date: new Date(activity.start_date),
    duration: secondsToMinutes(activity.moving_time || activity.elapsed_time),
    sessionType: mapStravaStrengthType(getActivityType(activity)),
    notes,
    exercises: [],
    pendingPlannedMatch: strengthCandidates[0]?._id || null
  });

  await session.save();

  return { status: 'imported', session, plannedCandidate: strengthCandidates[0] || null };
};

// ── Mise à jour d'un Run existant depuis le détail Strava (resync + webhook update) ──
const applyRunUpdateFromStrava = async (run, activity) => {
  let notes = activity.name;
  if (activity.description) {
    notes += `\n\n${activity.description}`;
  }

  const update = {
    notes,
    distance: Math.round(activity.distance / 1000 * 100) / 100,
    duration: secondsToMinutes(activity.moving_time),
    averagePace: speedToPace(activity.average_speed),
    averageHeartRate: activity.average_heartrate || null,
    maxHeartRate: activity.max_heartrate || null,
    averageCadence: activity.average_cadence ? Math.round(activity.average_cadence * 2) : null,
    elevationGain: activity.total_elevation_gain || null,
    polyline: activity.map?.polyline || activity.map?.summary_polyline || null,
    startLatLng: activity.start_latlng || null,
    endLatLng: activity.end_latlng || null,
    stravaData: buildStravaData(activity)
  };

  // Re-reconstruire les blocs UNIQUEMENT s'ils sont encore auto (athlète n'a rien édité)
  if (run.blocksAutoReconstructed) {
    // Si la course est liée à un plan coach figé, on reste aligné dessus
    const blocks = reconstructBlocksFromLaps(activity.laps, run.plannedSnapshot?.runBlocks);
    if (blocks.length) update.runBlocks = blocks;
  }

  await Run.findByIdAndUpdate(run._id, update);
};

// Générer l'URL d'autorisation Strava
exports.getAuthUrl = async (req, res) => {
  try {
    const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/strava/callback`;

    const params = new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read,activity:read_all',
      state: req.user._id.toString()
    });

    const authUrl = `${STRAVA_AUTH_URL}?${params.toString()}`;

    res.json({ authUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Callback OAuth Strava
exports.handleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/dashboard?strava=error&message=no_code`);
    }

    // Échanger le code contre un token
    const tokenResponse = await axios.post(STRAVA_TOKEN_URL, {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code'
    });

    const { access_token, refresh_token, expires_at, athlete } = tokenResponse.data;

    // Mettre à jour l'utilisateur avec les infos Strava
    await User.findByIdAndUpdate(state, {
      'strava.athleteId': athlete.id,
      'strava.accessToken': access_token,
      'strava.refreshToken': refresh_token,
      'strava.expiresAt': expires_at,
      'strava.connectedAt': new Date()
    });

    // Rediriger vers le frontend avec succès
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/dashboard?strava=success`);
  } catch (error) {
    console.error('Strava callback error:', error.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/dashboard?strava=error&message=${encodeURIComponent(error.message)}`);
  }
};

// Vérifier le statut de connexion Strava
exports.getStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+strava.accessToken');

    res.json({
      connected: !!user.strava?.athleteId,
      athleteId: user.strava?.athleteId || null,
      connectedAt: user.strava?.connectedAt || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Synchroniser les activités depuis Strava
exports.syncActivities = async (req, res) => {
  try {
    // Récupérer l'user complet (avec profil coureur pour l'analyse)
    const user = await User.findById(req.user._id)
      .select('+strava.accessToken +strava.refreshToken');
    const fullUser = await User.findById(req.user._id);

    if (!user.strava?.athleteId) {
      return res.status(400).json({ error: 'Compte Strava non connecté' });
    }

    // Rafraîchir le token si nécessaire
    const accessToken = await refreshTokenIfNeeded(user);

    // Paramètres de synchronisation
    const { after, before, limit = 30 } = req.query;

    const params = {
      per_page: Math.min(limit, 100)
    };

    if (after) params.after = Math.floor(new Date(after).getTime() / 1000);
    if (before) params.before = Math.floor(new Date(before).getTime() / 1000);

    // Récupérer toutes les activités
    const response = await axios.get(`${STRAVA_API_URL}/athlete/activities`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params
    });

    console.log('[Strava sync] Activities received:', response.data.map(a => ({
      id: a.id,
      name: a.name,
      sport_type: a.sport_type,
      type: a.type
    })));

    const runActivities = response.data.filter(a =>
      STRAVA_RUN_TYPES.includes(getActivityType(a))
    );
    const strengthActivities = response.data.filter(a =>
      STRAVA_STRENGTH_TYPES.includes(getActivityType(a))
    );
    const unrecognized = response.data
      .filter(a =>
        !STRAVA_RUN_TYPES.includes(getActivityType(a)) &&
        !STRAVA_STRENGTH_TYPES.includes(getActivityType(a))
      )
      .map(a => ({ id: a.id, name: a.name, type: getActivityType(a) }));

    console.log(`[Strava sync] Runs: ${runActivities.length}, Strength: ${strengthActivities.length}, Unrecognized: ${unrecognized.length}`);

    // --- Importer les courses ---
    const imported = [];
    const skipped = [];
    const skippedStrength = [];

    for (const activity of runActivities) {
      const result = await importRunActivity(req.user._id, activity, accessToken, fullUser);

      if (result.status === 'skipped') {
        skipped.push(activity.id);
        continue;
      }

      imported.push({
        id: result.run._id,
        stravaId: activity.id,
        name: activity.name,
        date: result.run.date,
        distance: result.run.distance,
        duration: result.run.duration,
        sessionType: result.run.sessionType,
        pendingPlannedMatch: result.plannedCandidate
      });
    }

    // --- Importer les séances muscu ---
    const importedStrength = [];

    for (const activity of strengthActivities) {
      const result = await importStrengthActivity(req.user._id, activity, accessToken);

      if (result.status === 'skipped') {
        skippedStrength.push(activity.id);
        continue;
      }

      importedStrength.push({
        id: result.session._id,
        stravaId: activity.id,
        name: activity.name,
        date: result.session.date,
        duration: result.session.duration,
        sessionType: result.session.sessionType,
        pendingPlannedMatch: result.plannedCandidate
      });
    }

    const totalImported = imported.length + importedStrength.length;
    const totalSkipped = skipped.length + skippedStrength.length;
    res.json({
      message: `${imported.length} course(s) et ${importedStrength.length} séance(s) muscu importée(s), ${totalSkipped} déjà présente(s). L'analyse IA est en cours...`,
      imported,
      importedStrength,
      skipped,
      skippedStrength,
      unrecognized
    });
  } catch (error) {
    console.error('Strava sync error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
};

// Resynchroniser les activités existantes (mettre à jour les données)
exports.resyncActivities = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('+strava.accessToken +strava.refreshToken');

    if (!user.strava?.athleteId) {
      return res.status(400).json({ error: 'Compte Strava non connecté' });
    }

    const accessToken = await refreshTokenIfNeeded(user);

    // Récupérer toutes les courses avec un stravaActivityId
    const runsToUpdate = await Run.find({
      user: req.user._id,
      stravaActivityId: { $ne: null }
    });

    if (runsToUpdate.length === 0) {
      return res.json({ message: 'Aucune course Strava à mettre à jour', updated: 0 });
    }

    let updated = 0;
    let errors = 0;

    for (const run of runsToUpdate) {
      try {
        const detailResponse = await axios.get(`${STRAVA_API_URL}/activities/${run.stravaActivityId}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        await applyRunUpdateFromStrava(run, detailResponse.data);

        updated++;
      } catch (e) {
        console.error(`Failed to resync activity ${run.stravaActivityId}:`, e.message);
        errors++;
      }
    }

    res.json({
      message: `${updated} course(s) mise(s) à jour${errors > 0 ? `, ${errors} erreur(s)` : ''}`,
      updated,
      errors
    });
  } catch (error) {
    console.error('Strava resync error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
};

// Rebalayer les activités Strava existantes pour leur attribuer une suggestion de match
// (rattrape les imports faits avant l'intro du bandeau, ou les planifiées créées après l'import).
exports.rematchExistingActivities = async (req, res) => {
  try {
    const userId = req.user._id;

    const runs = await Run.find({
      user: userId,
      stravaActivityId: { $ne: null },
      pendingPlannedMatch: null,
      matchDismissed: { $ne: true }
    });

    let runUpdates = 0;
    for (const run of runs) {
      const matches = await findPlannedMatches(userId, run.date, 'running');
      if (matches.length > 0) {
        run.pendingPlannedMatch = matches[0]._id;
        await run.save();
        runUpdates++;
      }
    }

    const sessions = await StrengthSession.find({
      user: userId,
      stravaActivityId: { $ne: null },
      pendingPlannedMatch: null,
      matchDismissed: { $ne: true },
      $or: [{ linkedPlannedSession: { $exists: false } }, { linkedPlannedSession: null }]
    });

    let strengthUpdates = 0;
    for (const session of sessions) {
      const matches = await findPlannedMatches(userId, session.date, 'strength');
      if (matches.length > 0) {
        session.pendingPlannedMatch = matches[0]._id;
        await session.save();
        strengthUpdates++;
      }
    }

    res.json({
      message: `${runUpdates} course(s) et ${strengthUpdates} séance(s) muscu re-mappées`,
      runUpdates,
      strengthUpdates,
      scanned: { runs: runs.length, strength: sessions.length }
    });
  } catch (error) {
    console.error('Strava rematch error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// Déconnecter le compte Strava
exports.disconnect = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('+strava.accessToken');

    if (user.strava?.accessToken) {
      // Révoquer l'accès côté Strava
      try {
        await axios.post('https://www.strava.com/oauth/deauthorize', null, {
          headers: { Authorization: `Bearer ${user.strava.accessToken}` }
        });
      } catch (e) {
        console.error('Strava deauthorize error:', e.message);
      }
    }

    // Supprimer les infos Strava de l'utilisateur
    await User.findByIdAndUpdate(req.user._id, {
      $unset: {
        'strava.athleteId': 1,
        'strava.accessToken': 1,
        'strava.refreshToken': 1,
        'strava.expiresAt': 1,
        'strava.connectedAt': 1
      }
    });

    res.json({ message: 'Compte Strava déconnecté' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ═══════════════════════════ Webhook Strava ═══════════════════════════
// Doc : https://developers.strava.com/docs/webhooks/
// Strava pousse un événement à chaque création/modif/suppression d'activité,
// ce qui rend l'import automatique (plus besoin du bouton "Synchroniser").

// GET /api/strava/webhook — handshake de validation lors de la création de l'abonnement
exports.webhookVerify = (req, res) => {
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && verifyToken && verifyToken === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    console.log('[Strava webhook] handshake validé');
    return res.json({ 'hub.challenge': challenge });
  }

  console.warn('[Strava webhook] handshake refusé (verify_token invalide)');
  res.status(403).json({ error: 'Verify token invalide' });
};

// POST /api/strava/webhook — réception des événements
// Strava exige une réponse 200 en moins de 2 secondes : on répond immédiatement
// et on traite l'événement en asynchrone.
exports.webhookEvent = (req, res) => {
  res.status(200).json({ received: true });

  processWebhookEvent(req.body).catch(e => {
    console.error('[Strava webhook] erreur de traitement:', e.message);
  });
};

const processWebhookEvent = async (event) => {
  const { object_type, object_id, aspect_type, owner_id, updates } = event || {};
  console.log(`[Strava webhook] ${object_type}/${aspect_type} — activité ${object_id}, athlète ${owner_id}`);

  // L'athlète a révoqué l'accès depuis Strava → on nettoie ses tokens
  if (object_type === 'athlete') {
    if (updates?.authorized === 'false') {
      const result = await User.updateOne(
        { 'strava.athleteId': owner_id },
        {
          $unset: {
            'strava.athleteId': 1,
            'strava.accessToken': 1,
            'strava.refreshToken': 1,
            'strava.expiresAt': 1,
            'strava.connectedAt': 1
          }
        }
      );
      console.log(`[Strava webhook] athlète ${owner_id} a révoqué l'accès (${result.modifiedCount} user nettoyé)`);
    }
    return;
  }

  if (object_type !== 'activity') return;

  const user = await User.findOne({ 'strava.athleteId': owner_id })
    .select('+strava.accessToken +strava.refreshToken');

  if (!user) {
    console.warn(`[Strava webhook] aucun utilisateur pour l'athlète Strava ${owner_id}`);
    return;
  }

  // Activité supprimée sur Strava → on supprime le miroir chez nous
  if (aspect_type === 'delete') {
    const run = await Run.findOneAndDelete({ user: user._id, stravaActivityId: object_id });
    const session = run ? null : await StrengthSession.findOneAndDelete({ user: user._id, stravaActivityId: object_id });
    console.log(`[Strava webhook] delete ${object_id} → ${run ? 'run supprimé' : session ? 'séance muscu supprimée' : 'rien à supprimer'}`);
    return;
  }

  // create / update → récupérer le détail de l'activité
  const accessToken = await refreshTokenIfNeeded(user);

  let detail;
  try {
    const detailResponse = await axios.get(`${STRAVA_API_URL}/activities/${object_id}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    detail = detailResponse.data;
  } catch (e) {
    console.error(`[Strava webhook] impossible de récupérer l'activité ${object_id}:`, e.response?.status || e.message);
    return;
  }

  const activityType = getActivityType(detail);

  if (STRAVA_RUN_TYPES.includes(activityType)) {
    const existing = await Run.findOne({ user: user._id, stravaActivityId: object_id });

    if (existing) {
      // Modif sur Strava (titre, description, correction de distance…) → on répercute
      if (aspect_type === 'update') {
        await applyRunUpdateFromStrava(existing, detail);
        console.log(`[Strava webhook] run ${existing._id} mis à jour`);
      }
      return;
    }

    const fullUser = await User.findById(user._id);
    const { run } = await importRunActivity(user._id, detail, accessToken, fullUser, detail);
    // À relire par l'athlète : la popup ressenti/match s'ouvrira au prochain
    // lancement du dashboard (GET /api/strava/pending-review)
    await Run.updateOne({ _id: run._id }, { $set: { needsReview: true } });
    console.log(`[Strava webhook] run ${run._id} importé (${run.distance} km)`);

    await createNotification({
      recipient: user._id,
      sender: null,
      type: 'session',
      action: 'strava_auto_import',
      title: 'Activité Strava synchronisée 🏃',
      message: `${detail.name} (${run.distance} km) a été synchronisée — viens la détailler !`,
      actionUrl: '/dashboard'
    });
  } else if (STRAVA_STRENGTH_TYPES.includes(activityType)) {
    const result = await importStrengthActivity(user._id, detail, accessToken, detail);
    if (result.status === 'imported') {
      await StrengthSession.updateOne({ _id: result.session._id }, { $set: { needsReview: true } });
      console.log(`[Strava webhook] séance muscu ${result.session._id} importée`);

      await createNotification({
        recipient: user._id,
        sender: null,
        type: 'session',
        action: 'strava_auto_import',
        title: 'Activité Strava synchronisée 💪',
        message: `${detail.name} a été synchronisée — viens la détailler !`,
        actionUrl: '/dashboard'
      });
    }
  } else {
    console.log(`[Strava webhook] type d'activité ignoré: ${activityType}`);
  }
};

// Exporté pour les tests / déclenchement manuel
exports.processWebhookEvent = processWebhookEvent;

// Même forme allégée que le populate des Run/StrengthSession côté athlète
const PENDING_MATCH_FIELDS = 'date activityType sessionType targetDistance targetDuration targetPace description generatedBy';

// Activités importées par le webhook et pas encore relues par l'athlète.
// Le dashboard les récupère au chargement pour ouvrir la popup ressenti/match.
exports.getPendingReview = async (req, res) => {
  try {
    const [runs, sessions] = await Promise.all([
      Run.find({ user: req.user._id, needsReview: true })
        .sort({ date: -1 })
        .select('date distance duration sessionType pendingPlannedMatch')
        .populate('pendingPlannedMatch', PENDING_MATCH_FIELDS)
        .lean(),
      StrengthSession.find({ user: req.user._id, needsReview: true })
        .sort({ date: -1 })
        .select('date duration sessionType pendingPlannedMatch')
        .populate('pendingPlannedMatch', PENDING_MATCH_FIELDS)
        .lean()
    ]);

    res.json({
      runs: runs.map(r => ({
        id: r._id,
        date: r.date,
        distance: r.distance,
        duration: r.duration,
        sessionType: r.sessionType,
        pendingPlannedMatch: r.pendingPlannedMatch || null
      })),
      strength: sessions.map(s => ({
        id: s._id,
        date: s.date,
        duration: s.duration,
        sessionType: s.sessionType,
        pendingPlannedMatch: s.pendingPlannedMatch || null
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Marquer les activités comme relues (appelé à la fermeture de la popup)
exports.clearPendingReview = async (req, res) => {
  try {
    const { runIds = [], strengthIds = [] } = req.body;

    await Promise.all([
      runIds.length
        ? Run.updateMany({ user: req.user._id, _id: { $in: runIds } }, { $set: { needsReview: false } })
        : Promise.resolve(),
      strengthIds.length
        ? StrengthSession.updateMany({ user: req.user._id, _id: { $in: strengthIds } }, { $set: { needsReview: false } })
        : Promise.resolve()
    ]);

    res.json({ message: 'Activités marquées comme relues' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
