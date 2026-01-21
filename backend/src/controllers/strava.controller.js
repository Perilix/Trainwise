const axios = require('axios');
const User = require('../models/user.model');
const Run = require('../models/run.model');

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_URL = 'https://www.strava.com/api/v3';

// Helper: Analyser une course en arrière-plan
const analyzeRunInBackground = async (run, user) => {
  if (!process.env.N8N_WEBHOOK_URL) return;

  try {
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
        notes: run.notes
      },
      runner: {
        name: `${user.firstName} ${user.lastName}`,
        level: user.runningLevel,
        goal: user.goal,
        goalDetails: user.goalDetails,
        weeklyFrequency: user.weeklyFrequency,
        injuries: user.injuries
      },
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

// Helper: Mapper le type Strava vers nos types de session
const mapStravaType = (stravaType) => {
  const typeMap = {
    'Run': 'endurance',
    'TrailRun': 'trail',
    'VirtualRun': 'endurance',
    'Workout': 'fractionné'
  };
  return typeMap[stravaType] || 'endurance';
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
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/profile?strava=error&message=no_code`);
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
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/profile?strava=success`);
  } catch (error) {
    console.error('Strava callback error:', error.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/profile?strava=error&message=${encodeURIComponent(error.message)}`);
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

    // Récupérer les activités de type Run uniquement
    const response = await axios.get(`${STRAVA_API_URL}/athlete/activities`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params
    });

    const activities = response.data.filter(a =>
      ['Run', 'TrailRun', 'VirtualRun'].includes(a.type)
    );

    // Importer les activités
    const imported = [];
    const skipped = [];

    for (const activity of activities) {
      // Vérifier si déjà importée
      const existing = await Run.findOne({
        user: req.user._id,
        stravaActivityId: activity.id
      });

      if (existing) {
        skipped.push(activity.id);
        continue;
      }

      // Récupérer les détails de l'activité (pour avoir la description et la polyline détaillée)
      let description = '';
      let polyline = activity.map?.summary_polyline || null;
      let startLatLng = activity.start_latlng || null;
      let endLatLng = activity.end_latlng || null;

      try {
        const detailResponse = await axios.get(`${STRAVA_API_URL}/activities/${activity.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        description = detailResponse.data.description || '';
        // Préférer la polyline détaillée si disponible
        if (detailResponse.data.map?.polyline) {
          polyline = detailResponse.data.map.polyline;
        }
        if (detailResponse.data.start_latlng) {
          startLatLng = detailResponse.data.start_latlng;
        }
        if (detailResponse.data.end_latlng) {
          endLatLng = detailResponse.data.end_latlng;
        }
      } catch (e) {
        console.error(`Failed to fetch details for activity ${activity.id}`);
      }

      // Construire les notes avec titre et description
      let notes = activity.name;
      if (description) {
        notes += `\n\n${description}`;
      }

      // Créer la course
      const run = new Run({
        user: req.user._id,
        stravaActivityId: activity.id,
        date: new Date(activity.start_date),
        distance: Math.round(activity.distance / 1000 * 100) / 100, // mètres -> km
        duration: secondsToMinutes(activity.moving_time),
        averagePace: speedToPace(activity.average_speed),
        averageHeartRate: activity.average_heartrate || null,
        maxHeartRate: activity.max_heartrate || null,
        averageCadence: activity.average_cadence ? Math.round(activity.average_cadence * 2) : null, // Strava = steps/min/2
        elevationGain: activity.total_elevation_gain || null,
        sessionType: mapStravaType(activity.type),
        notes,
        polyline,
        startLatLng,
        endLatLng
      });

      await run.save();

      // Lancer l'analyse IA en arrière-plan (sans bloquer)
      analyzeRunInBackground(run, fullUser);

      imported.push({
        id: run._id,
        stravaId: activity.id,
        name: activity.name,
        date: run.date,
        distance: run.distance
      });
    }

    res.json({
      message: `${imported.length} activité(s) importée(s), ${skipped.length} déjà présente(s). L'analyse IA est en cours...`,
      imported,
      skipped
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

        const activity = detailResponse.data;

        // Construire les notes avec titre et description
        let notes = activity.name;
        if (activity.description) {
          notes += `\n\n${activity.description}`;
        }

        // Récupérer la polyline
        const polyline = activity.map?.polyline || activity.map?.summary_polyline || null;
        const startLatLng = activity.start_latlng || null;
        const endLatLng = activity.end_latlng || null;

        // Mettre à jour la course
        await Run.findByIdAndUpdate(run._id, {
          notes,
          distance: Math.round(activity.distance / 1000 * 100) / 100,
          duration: secondsToMinutes(activity.moving_time),
          averagePace: speedToPace(activity.average_speed),
          averageHeartRate: activity.average_heartrate || null,
          maxHeartRate: activity.max_heartrate || null,
          averageCadence: activity.average_cadence ? Math.round(activity.average_cadence * 2) : null,
          elevationGain: activity.total_elevation_gain || null,
          polyline,
          startLatLng,
          endLatLng
        });

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
