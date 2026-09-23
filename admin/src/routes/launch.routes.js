const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const LaunchTask = require('../models/launchTask.model');
const plan = require('../config/launchPlan');

const ASSIGNEES = { julien: 'Julien', hugo: 'Hugo' };

router.get('/', requireAuth, async (req, res) => {
  const tasks = await LaunchTask.find().select('key done assignee').lean();
  const done = new Set(tasks.filter(t => t.done).map(t => t.key));
  const assignees = Object.fromEntries(tasks.map(t => [t.key, t.assignee || '']));

  const launch = new Date(`${plan.LAUNCH_DATE}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToLaunch = Math.round((launch - today) / 86400000);

  res.render('launch', {
    ...plan,
    done,
    assignees,
    assigneeOptions: ASSIGNEES,
    doneCount: plan.TASK_KEYS.filter(k => done.has(k)).length,
    daysToLaunch
  });
});

// Coche une action ou change son responsable ; appelé en fetch depuis la page.
router.post('/tasks/:key', requireAuth, async (req, res) => {
  const { key } = req.params;
  if (!plan.TASK_KEYS.includes(key)) return res.status(404).json({ error: 'Action inconnue' });

  const update = {};
  if (typeof req.body.done === 'boolean') {
    update.done = req.body.done;
    update.doneAt = req.body.done ? new Date() : null;
  }
  if ('assignee' in req.body) {
    if (req.body.assignee !== '' && !Object.hasOwn(ASSIGNEES, req.body.assignee)) {
      return res.status(400).json({ error: 'Responsable inconnu' });
    }
    update.assignee = req.body.assignee;
  }
  if (!Object.keys(update).length) return res.status(400).json({ error: 'Rien à modifier' });

  await LaunchTask.findOneAndUpdate({ key }, update, { upsert: true });
  res.json({ ok: true });
});

module.exports = router;
