// Remplit User.lastActivityAt à partir de la dernière activité réelle
// (Run ou StrengthSession) de chaque utilisateur.
//
// À lancer UNE FOIS après déploiement, avant d'activer le cron, pour éviter
// de relancer des utilisateurs déjà actifs.
//
//   node src/scripts/backfillLastActivity.js
//
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Run = require('../models/run.model');
const StrengthSession = require('../models/strengthSession.model');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trainwise');
  console.log('Connecté à MongoDB');

  const users = await User.find().select('_id').lean();
  console.log(`${users.length} utilisateurs à traiter…`);

  let updated = 0;
  for (const u of users) {
    const [lastRun, lastSession] = await Promise.all([
      Run.findOne({ user: u._id }).sort({ date: -1 }).select('date').lean(),
      StrengthSession.findOne({ user: u._id }).sort({ date: -1 }).select('date').lean()
    ]);

    const dates = [lastRun?.date, lastSession?.date].filter(Boolean).map(d => new Date(d));
    if (!dates.length) continue;

    const last = new Date(Math.max(...dates.map(d => d.getTime())));
    await User.updateOne({ _id: u._id }, { $set: { lastActivityAt: last } });
    updated++;
  }

  console.log(`✅ Backfill terminé : ${updated} utilisateurs mis à jour.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Erreur backfill:', err);
  process.exit(1);
});
