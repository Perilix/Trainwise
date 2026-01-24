const GarminConnect = require('garmin-connect').default;
const crypto = require('crypto');
const User = require('../models/user.model');
const Run = require('../models/run.model');

// Encryption helpers
const ENCRYPTION_KEY = process.env.GARMIN_ENCRYPTION_KEY || 'runiq-garmin-secret-key-32chars!'; // 32 chars for AES-256
const IV_LENGTH = 16;

const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

const decrypt = (text) => {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

// Helper: Analyser une course en arrière-plan
const analyzeRunInBackground = async (run, user) => {
  if (!process.env.N8N_WEBHOOK_URL) return;

  try {
    const axios = require('axios');

    const recentRuns = await Run.find({
      user: user._id,
      _id: { $ne: run._id }
    }).sort({ date: -1 }).limit(5);

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

// Helper: Convertir duration Garmin en pace
const durationToPace = (durationSeconds, distanceMeters) => {
  if (!durationSeconds || !distanceMeters || distanceMeters === 0) return null;
  const paceSeconds = durationSeconds / (distanceMeters / 1000);
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Helper: Mapper le type Garmin vers nos types de session
const mapGarminType = (garminType) => {
  const typeMap = {
    'running': 'endurance',
    'trail_running': 'trail',
    'treadmill_running': 'endurance',
    'track_running': 'fractionné',
    'indoor_running': 'endurance'
  };
  return typeMap[garminType?.toLowerCase()] || 'endurance';
};

// Connecter le compte Garmin
exports.connect = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Tester la connexion
    const GC = new GarminConnect();

    try {
      await GC.login(email, password);
    } catch (loginError) {
      console.error('Garmin login error:', loginError.message);
      return res.status(401).json({ error: 'Identifiants Garmin invalides' });
    }

    // Récupérer les infos du profil
    const userInfo = await GC.getUserProfile();

    // Chiffrer le mot de passe avant stockage
    const encryptedPassword = encrypt(password);

    // Sauvegarder les credentials
    await User.findByIdAndUpdate(req.user._id, {
      'garmin.email': email,
      'garmin.password': encryptedPassword,
      'garmin.displayName': userInfo.displayName || userInfo.userName,
      'garmin.connectedAt': new Date()
    });

    res.json({
      message: 'Compte Garmin connecté avec succès',
      displayName: userInfo.displayName || userInfo.userName
    });
  } catch (error) {
    console.error('Garmin connect error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Vérifier le statut de connexion
exports.getStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+garmin.email +garmin.password');

    res.json({
      connected: !!user.garmin?.email,
      displayName: user.garmin?.displayName || null,
      connectedAt: user.garmin?.connectedAt || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Synchroniser les activités
exports.syncActivities = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+garmin.email +garmin.password');
    const fullUser = await User.findById(req.user._id);

    if (!user.garmin?.email || !user.garmin?.password) {
      return res.status(400).json({ error: 'Compte Garmin non connecté' });
    }

    // Connexion à Garmin
    const GC = new GarminConnect();
    const decryptedPassword = decrypt(user.garmin.password);

    try {
      await GC.login(user.garmin.email, decryptedPassword);
    } catch (loginError) {
      console.error('Garmin login error:', loginError.message);
      return res.status(401).json({ error: 'Session Garmin expirée, reconnectez-vous' });
    }

    // Récupérer les activités (par défaut les 30 dernières)
    const { limit = 30 } = req.query;
    const activities = await GC.getActivities(0, parseInt(limit));

    // Filtrer pour ne garder que les courses
    const runActivities = activities.filter(a =>
      a.activityType?.typeKey?.toLowerCase().includes('running') ||
      a.activityType?.typeKey?.toLowerCase().includes('run')
    );

    const imported = [];
    const skipped = [];

    for (const activity of runActivities) {
      // Vérifier si déjà importée
      const existing = await Run.findOne({
        user: req.user._id,
        garminActivityId: activity.activityId
      });

      if (existing) {
        skipped.push(activity.activityId);
        continue;
      }

      // Récupérer les détails de l'activité
      let activityDetails = null;
      try {
        activityDetails = await GC.getActivity({ activityId: activity.activityId });
      } catch (e) {
        console.error(`Failed to get details for activity ${activity.activityId}`);
      }

      // Construire les notes
      let notes = activity.activityName || 'Course Garmin';
      if (activity.description) {
        notes += `\n\n${activity.description}`;
      }

      // Créer la course
      const run = new Run({
        user: req.user._id,
        garminActivityId: activity.activityId,
        date: new Date(activity.startTimeLocal || activity.startTimeGMT),
        distance: activity.distance ? Math.round(activity.distance / 1000 * 100) / 100 : null,
        duration: activity.duration ? secondsToMinutes(activity.duration) : null,
        averagePace: durationToPace(activity.duration, activity.distance),
        averageHeartRate: activity.averageHR || null,
        maxHeartRate: activity.maxHR || null,
        averageCadence: activity.averageRunningCadenceInStepsPerMinute ||
                        (activity.averageCadence ? Math.round(activity.averageCadence * 2) : null),
        elevationGain: activity.elevationGain || null,
        sessionType: mapGarminType(activity.activityType?.typeKey),
        notes,
        // Garmin ne fournit pas de polyline encodée facilement, on stocke les coords de début/fin
        startLatLng: activity.startLatitude && activity.startLongitude
          ? [activity.startLatitude, activity.startLongitude] : null,
        endLatLng: activity.endLatitude && activity.endLongitude
          ? [activity.endLatitude, activity.endLongitude] : null
      });

      await run.save();

      // Lancer l'analyse IA en arrière-plan
      analyzeRunInBackground(run, fullUser);

      imported.push({
        id: run._id,
        garminId: activity.activityId,
        name: activity.activityName,
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
    console.error('Garmin sync error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Récupérer les stats utilisateur Garmin
exports.getUserStats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+garmin.email +garmin.password');

    if (!user.garmin?.email || !user.garmin?.password) {
      return res.status(400).json({ error: 'Compte Garmin non connecté' });
    }

    const GC = new GarminConnect();
    const decryptedPassword = decrypt(user.garmin.password);

    try {
      await GC.login(user.garmin.email, decryptedPassword);
    } catch (loginError) {
      return res.status(401).json({ error: 'Session Garmin expirée' });
    }

    // Récupérer diverses stats
    const [userProfile, heartRate, steps] = await Promise.all([
      GC.getUserProfile().catch(() => null),
      GC.getHeartRate().catch(() => null),
      GC.getSteps().catch(() => null)
    ]);

    res.json({
      profile: userProfile,
      heartRate,
      steps
    });
  } catch (error) {
    console.error('Garmin stats error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Déconnecter le compte Garmin
exports.disconnect = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $unset: {
        'garmin.email': 1,
        'garmin.password': 1,
        'garmin.displayName': 1,
        'garmin.connectedAt': 1
      }
    });

    res.json({ message: 'Compte Garmin déconnecté' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
