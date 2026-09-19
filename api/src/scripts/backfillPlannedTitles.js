// Rattrape les séances planifiées depuis la bibliothèque avant que le nom du
// modèle ne soit copié : elles s'affichaient sous le libellé de leur type
// (« Tempo ») au lieu du nom donné par le coach (« Seuil 2x12' r=2' »).
//
// Usage :
//   node src/scripts/backfillPlannedTitles.js          → aperçu, n'écrit rien
//   node src/scripts/backfillPlannedTitles.js --apply  → applique
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const PlannedRun = require('../models/plannedRun.model');
const SessionTemplate = require('../models/sessionTemplate.model');

const apply = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const planned = await PlannedRun.find({
    templateRef: { $ne: null },
    $or: [{ title: null }, { title: '' }]
  })
    .select('_id templateRef date')
    .lean();

  if (!planned.length) {
    process.stdout.write(`Rien à rattraper.\n`);
    await mongoose.disconnect();
    return;
  }

  const templates = await SessionTemplate.find({ _id: { $in: planned.map((item) => item.templateRef) } })
    .select('_id name')
    .lean();
  const nameById = new Map(templates.map((template) => [template._id.toString(), template.name]));

  let updated = 0;
  for (const item of planned) {
    const name = nameById.get(item.templateRef.toString());
    if (!name) continue;
    process.stdout.write(`${new Date(item.date).toISOString().slice(0, 10)} → « ${name} »\n`);
    if (apply) {
      await PlannedRun.updateOne({ _id: item._id }, { title: name });
      updated++;
    }
  }

  process.stdout.write(`${apply ? `\n${updated} séance(s) renommée(s).` : `\n${planned.length} séance(s) concernée(s). Relancer avec --apply pour écrire.`}\n`);
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
