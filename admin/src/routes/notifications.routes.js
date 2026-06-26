const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const User = require('../models/user.model');
const NotificationLog = require('../models/notificationLog.model');
const ReengagementLog = require('../models/reengagementLog.model');
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

// Charge les données communes de la page (stats, historique, liste des appareils ciblables)
async function loadPageData() {
  const [total, withToken, logs, tokenUsers] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ pushToken: { $ne: null } }),
    NotificationLog.find().sort({ sentAt: -1 }).limit(20),
    User.find({ pushToken: { $ne: null } })
      .select('_id email firstName lastName subscriptionStatus')
      .sort({ firstName: 1 })
      .lean()
  ]);
  return { stats: { total, withToken }, logs, tokenUsers };
}

router.get('/', requireAuth, async (req, res) => {
  const data = await loadPageData();
  res.render('notifications', { ...data, success: null, error: null });
});

router.post('/', requireAuth, async (req, res) => {
  const { title, body, segment } = req.body;
  // Les checkboxes renvoient soit une string (1 sélectionné) soit un array
  let userIds = req.body.userIds || [];
  if (!Array.isArray(userIds)) userIds = [userIds];

  const data = await loadPageData();

  if (!title || !body) {
    return res.render('notifications', { ...data, success: null, error: 'Titre et message requis.' });
  }

  if (!jwtClient || !projectId) {
    return res.render('notifications', { ...data, success: null, error: 'Firebase non configuré (FIREBASE_SERVICE_ACCOUNT manquant).' });
  }

  const filter = { pushToken: { $ne: null } };
  if (segment === 'pro') filter.subscriptionStatus = 'pro';
  if (segment === 'free') filter.subscriptionStatus = 'free';
  if (segment === 'custom') {
    const validIds = userIds.filter(id => /^[0-9a-fA-F]{24}$/.test(id));
    if (!validIds.length) {
      return res.render('notifications', { ...data, success: null, error: 'Sélectionnez au moins un utilisateur.' });
    }
    filter._id = { $in: validIds };
  }

  const users = await User.find(filter).select('pushToken _id email firstName');
  let successCount = 0;
  let failCount = 0;
  const recipients = [];

  const tokenData = await jwtClient.getAccessToken();
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  await Promise.all(users.map(async (u) => {
    let status = 'sent';
    try {
      await axios.post(fcmUrl, {
        message: {
          token: u.pushToken,
          notification: { title, body },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
          android: { notification: { sound: 'default', channelId: 'trainwise_notifications' } }
        }
      }, { headers: { Authorization: `Bearer ${tokenData.token}`, 'Content-Type': 'application/json' } });
      successCount++;
    } catch (e) {
      status = 'failed';
      failCount++;
      if (e.response?.data?.error?.details?.some(d => d.errorCode === 'UNREGISTERED')) {
        await User.findByIdAndUpdate(u._id, { pushToken: null });
      }
    }
    recipients.push({ user: u._id, email: u.email, firstName: u.firstName, status });
  }));

  await NotificationLog.create({
    title,
    body,
    segment: segment || 'all',
    sent: successCount,
    failed: failCount,
    createdBy: req.session.adminId,
    createdByName: req.session.adminName,
    targetCount: users.length,
    recipients
  });

  const freshLogs = await NotificationLog.find().sort({ sentAt: -1 }).limit(20);

  res.render('notifications', {
    stats: data.stats,
    tokenUsers: data.tokenUsers,
    logs: freshLogs,
    success: `Envoyée à ${successCount} appareil${successCount > 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} échec${failCount > 1 ? 's' : ''})` : ''}.`,
    error: null
  });
});

// ── Journal des relances automatiques (ré-engagement) ──────────────────────
router.get('/reengagement', requireAuth, async (req, res) => {
  const { type, status, q } = req.query;

  const filter = {};
  if (type && ['inactive', 'streak', 'recap', 'onboarding'].includes(type)) filter.type = type;
  if (status && ['sent', 'failed', 'no_token'].includes(status)) filter.status = status;
  if (q && q.trim()) filter.email = { $regex: q.trim(), $options: 'i' };

  const [logs, counts] = await Promise.all([
    ReengagementLog.find(filter).sort({ sentAt: -1 }).limit(200).lean(),
    ReengagementLog.aggregate([
      { $group: { _id: '$type', total: { $sum: 1 }, sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } } } }
    ])
  ]);

  const byType = {};
  counts.forEach(c => { byType[c._id] = c; });

  res.render('reengagement', {
    logs,
    byType,
    filters: { type: type || '', status: status || '', q: q || '' }
  });
});

// ── Détail d'une campagne manuelle (destinataires, contenu, créateur) ──────
router.get('/:id', requireAuth, async (req, res) => {
  if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) return res.redirect('/notifications');

  const log = await NotificationLog.findById(req.params.id).lean();
  if (!log) return res.redirect('/notifications');

  res.render('notification-detail', { log });
});

module.exports = router;
