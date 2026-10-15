// Supprime les relations coach-athlète dont le coach ou l'athlète n'existe plus
// (compte effacé à la main depuis le back-office, par exemple). Ces relations
// cassaient la liste des athlètes et comptaient dans la limite du plan.
//
// Par défaut, le script liste sans rien supprimer. Ajouter --apply pour supprimer :
//
//   node src/scripts/cleanOrphanRelations.js
//   node src/scripts/cleanOrphanRelations.js --apply
//
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const User = require('../models/user.model');
const CoachAthlete = require('../models/coachAthlete.model');

async function main() {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trainwise');

  const relations = await CoachAthlete.find().select('coach athlete status').lean();
  const ids = [...new Set(relations.flatMap(r => [r.coach, r.athlete]).filter(Boolean).map(String))];
  const existing = new Set((await User.find({ _id: { $in: ids } }).select('_id').lean()).map(u => String(u._id)));

  const orphans = relations.filter(r => !existing.has(String(r.coach)) || !existing.has(String(r.athlete)));
  for (const r of orphans) {
    const missing = !existing.has(String(r.coach)) ? 'coach supprimé' : 'athlète supprimé';
    process.stdout.write(`${r._id}  ${r.status.padEnd(9)}  coach ${r.coach}  athlète ${r.athlete}  (${missing})\n`);
  }
  process.stdout.write(`${orphans.length} relation(s) orpheline(s) sur ${relations.length}.\n`);

  if (apply && orphans.length) {
    const { deletedCount } = await CoachAthlete.deleteMany({ _id: { $in: orphans.map(r => r._id) } });
    process.stdout.write(`${deletedCount} supprimée(s).\n`);
  } else if (orphans.length) {
    process.stdout.write('Rien n\'a été supprimé. Relancer avec --apply pour les supprimer.\n');
  }

  await mongoose.disconnect();
}

main().catch(err => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
