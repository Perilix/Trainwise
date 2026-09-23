const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const LaunchTask = require('../models/launchTask.model');
const plan = require('../config/launchPlan');

router.get('/', requireAuth, async (req, res) => {
  const tasks = await LaunchTask.find({ done: true }).select('key').lean();
  const done = new Set(tasks.map(t => t.key));

  const launch = new Date(`${plan.LAUNCH_DATE}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToLaunch = Math.round((launch - today) / 86400000);

  res.render('launch', {
    ...plan,
    done,
    doneCount: plan.TASK_KEYS.filter(k => done.has(k)).length,
    daysToLaunch
  });
});

// Coche ou décoche une action ; appelé en fetch depuis la page.
router.post('/tasks/:key', requireAuth, async (req, res) => {
  const { key } = req.params;
  if (!plan.TASK_KEYS.includes(key)) return res.status(404).json({ error: 'Action inconnue' });
  const done = req.body.done === true;
  await LaunchTask.findOneAndUpdate(
    { key },
    { done, doneAt: done ? new Date() : null },
    { upsert: true }
  );
  res.json({ ok: true });
});

module.exports = router;
