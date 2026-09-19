// Affiche les tours (laps) d'une activité Strava, tels que l'import les reçoit.
//
// C'est la matière première de la reconstruction du déroulé (utils/stravaReconstruct.js) :
// si la montre n'a pas enregistré de tours manuels, Strava ne renvoie que des tours
// automatiques d'un kilomètre, et la structure réelle de la séance est perdue.
//
//   node src/scripts/stravaLaps.js <email> [activityId]
//
// Sans activityId, on prend la dernière course importée de cet athlète.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const axios = require('axios');

const User = require('../models/user.model');
const Run = require('../models/run.model');

const say = (line = '') => process.stdout.write(`${line}\n`);

const STRAVA_API_URL = 'https://www.strava.com/api/v3';
const [email, activityArg] = process.argv.slice(2);

const pace = (speed) => {
  if (!speed || speed <= 0) return '—';
  const total = Math.round(1000 / speed);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}/km`;
};

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

async function accessTokenFor(user) {
  const now = Math.floor(Date.now() / 1000);
  if (user.strava.expiresAt && user.strava.expiresAt > now + 300) return user.strava.accessToken;

  const { data } = await axios.post('https://www.strava.com/oauth/token', {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: user.strava.refreshToken,
  });
  await User.findByIdAndUpdate(user._id, {
    'strava.accessToken': data.access_token,
    'strava.refreshToken': data.refresh_token,
    'strava.expiresAt': data.expires_at,
  });
  return data.access_token;
}

(async () => {
  if (!email) throw new Error('Usage : node src/scripts/stravaLaps.js <email> [activityId]');

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const user = await User.findOne({ email }).select('+strava.accessToken +strava.refreshToken');
  if (!user) throw new Error(`Aucun utilisateur avec l'email ${email}.`);
  if (!user.strava?.athleteId) throw new Error('Cet utilisateur n\'a pas de compte Strava lié.');

  let activityId = activityArg;
  let run = null;
  if (!activityId) {
    run = await Run.findOne({ user: user._id, stravaActivityId: { $ne: null } }).sort({ date: -1 });
    if (!run) throw new Error('Aucune course importée de Strava pour cet athlète.');
    activityId = run.stravaActivityId;
  } else {
    run = await Run.findOne({ user: user._id, stravaActivityId: Number(activityId) });
  }

  const token = await accessTokenFor(user);
  const { data: activity } = await axios.get(`${STRAVA_API_URL}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const laps = activity.laps || [];
  say(`${activity.name} — ${activity.start_date_local?.slice(0, 16).replace('T', ' ')}`);
  say(`${(activity.distance / 1000).toFixed(2)} km en ${clock(activity.moving_time)} (${pace(activity.average_speed)})`);
  say('');
  say(`Tours renvoyés par Strava : ${laps.length}`);
  for (const lap of laps) {
    const distance = (lap.distance / 1000).toFixed(2);
    say(`  ${String(lap.lap_index).padStart(2)} | ${distance} km | ${clock(lap.moving_time)} | ${pace(lap.average_speed)} | ${lap.name || ''}`);
  }

  say('');
  if (run) {
    const blocks = run.runBlocks || [];
    say(`Déroulé enregistré côté Trainwise : ${blocks.length} bloc(s)${run.blocksAutoReconstructed ? ' (reconstruits)' : ''}`);
    for (const block of blocks) {
      const children = block.children?.length ? ` → ${block.children.length} répétition(s)` : '';
      say(`  ${block.role} | ${block.repetitions || 1} × | ${block.distance ? `${block.distance} km` : `${block.duration || '—'} min`} | ${block.pace || '—'}${children}`);
    }
  } else {
    say('Cette activité n\'est pas (encore) importée dans Trainwise.');
  }

  await mongoose.disconnect();
})().catch(async (e) => {
  process.stderr.write(`Échec : ${e.response?.data?.message || e.message}\n`);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
