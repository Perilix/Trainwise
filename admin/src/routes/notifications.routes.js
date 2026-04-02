const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const User = require('../models/user.model');
const axios = require('axios');
const { JWT } = require('google-auth-library');

let jwtClient = null;
let projectId = null;

function initFirebase() {
  if (jwtClient) return;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) return;
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    projectId = parsed.project_id;
    jwtClient = new JWT({
      email: parsed.client_email,
      key: parsed.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging']
    });
  } catch (e) {
    console.error('Firebase init error:', e.message);
  }
}
initFirebase();

router.get('/', requireAuth, async (req, res) => {
  const [total, withToken] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ pushToken: { $ne: null } })
  ]);
  res.render('notifications', { stats: { total, withToken }, success: null, error: null, sent: 0 });
});

router.post('/', requireAuth, async (req, res) => {
  const { title, body, segment } = req.body;

  const [total, withToken] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ pushToken: { $ne: null } })
  ]);

  if (!title || !body) {
    return res.render('notifications', { stats: { total, withToken }, success: null, error: 'Titre et message requis.', sent: 0 });
  }

  if (!jwtClient || !projectId) {
    return res.render('notifications', { stats: { total, withToken }, success: null, error: 'Firebase non configuré (FIREBASE_SERVICE_ACCOUNT manquant).', sent: 0 });
  }

  const filter = { pushToken: { $ne: null } };
  if (segment === 'pro') filter.subscriptionStatus = 'pro';
  if (segment === 'free') filter.subscriptionStatus = 'free';

  const users = await User.find(filter).select('pushToken');
  let successCount = 0;

  const tokenData = await jwtClient.getAccessToken();
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  await Promise.all(users.map(async (u) => {
    try {
      await axios.post(fcmUrl, {
        message: {
          token: u.pushToken,
          notification: { title, body },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
          android: { notification: { sound: 'default', channelId: 'runiq_notifications' } }
        }
      }, {
        headers: { Authorization: `Bearer ${tokenData.token}`, 'Content-Type': 'application/json' }
      });
      successCount++;
    } catch (e) {
      if (e.response?.data?.error?.details?.some(d => d.errorCode === 'UNREGISTERED')) {
        await User.findByIdAndUpdate(u._id, { pushToken: null });
      }
    }
  }));

  res.render('notifications', {
    stats: { total, withToken },
    success: `Notification envoyée à ${successCount} utilisateur${successCount > 1 ? 's' : ''}.`,
    error: null,
    sent: successCount
  });
});

module.exports = router;
