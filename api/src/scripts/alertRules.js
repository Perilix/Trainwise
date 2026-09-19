/**
 * Vérifie les seuils d'alerte d'un coach — lecture seule.
 *
 *   npm run alerts:check                 → le premier coach trouvé
 *   npm run alerts:check julien@x.fr     → ce coach
 *
 * Affiche, pour chacun de ses athlètes, le statut calculé avec ses seuils, le
 * même calcul avec les seuils par défaut, et un troisième avec des seuils
 * volontairement sévères. Si la troisième colonne ne bouge pas, c'est que les
 * seuils ne sont pas pris en compte.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/user.model');
const CoachAthlete = require('../models/coachAthlete.model');
const { computeAthleteStatus, DEFAULT_RULES } = require('../services/athleteStatus.service');
const { planOf } = require('../services/coachPlan.service');

const PILLS = { green: '🟢 vert', orange: '🟠 orange', red: '🔴 rouge' };

// Des seuils volontairement sévères : tout le monde devrait bouger.
const STRICT = { ...DEFAULT_RULES, inactivityOrange: 1, inactivityRed: 2, skippedOrange: 1, skippedRed: 1, feelingOrange: 10, feelingRed: 9 };

const pad = (value, width) => String(value).padEnd(width);

async function main() {
  const email = process.argv[2];
  await mongoose.connect(process.env.MONGODB_URI);

  const coach = email
    ? await User.findOne({ email: email.toLowerCase(), role: 'coach' })
    : await User.findOne({ role: 'coach' });

  if (!coach) {
    process.stdout.write(email ? `Aucun coach avec l'adresse ${email}.\n` : 'Aucun coach dans la base.\n');
    return;
  }

  const plan = planOf(coach);
  const rules = coach.coachAlertRules?.toObject?.() || {};

  process.stdout.write(`\nCoach : ${coach.firstName || ''} ${coach.lastName || ''} <${coach.email}>\n`);
  process.stdout.write(`Plan  : ${plan.name}${plan.limits.customAlerts ? ' (alertes sur mesure incluses)' : ' (seuils par défaut imposés)'}\n\n`);

  process.stdout.write('Seuils enregistrés sur le compte :\n');
  for (const key of Object.keys(DEFAULT_RULES)) {
    const value = rules[key];
    const isDefault = value === undefined || value === DEFAULT_RULES[key];
    process.stdout.write(`  ${pad(key, 20)} ${pad(value === undefined ? DEFAULT_RULES[key] : value, 8)}${isDefault ? '(défaut)' : '← modifié'}\n`);
  }

  const relations = await CoachAthlete.find({ coach: coach._id, status: 'accepted' })
    .populate('athlete', 'firstName lastName email')
    .lean();

  if (!relations.length) {
    process.stdout.write('\nCe coach n\'a aucun athlète accepté : rien à calculer.\n');
    return;
  }

  process.stdout.write(`\n${pad('Athlète', 24)}${pad('ses seuils', 12)}${pad('par défaut', 12)}${pad('très sévères', 14)}détail\n`);
  process.stdout.write(`${'-'.repeat(96)}\n`);

  let moved = 0;
  for (const relation of relations) {
    if (!relation.athlete) continue;
    const name = `${relation.athlete.firstName || ''} ${relation.athlete.lastName || ''}`.trim() || relation.athlete.email;

    const [mine, byDefault, strict] = await Promise.all([
      computeAthleteStatus(relation.athlete._id, new Date(), coach.coachAlertRules),
      computeAthleteStatus(relation.athlete._id, new Date(), null),
      computeAthleteStatus(relation.athlete._id, new Date(), STRICT)
    ]);

    if (strict.status !== byDefault.status) moved++;

    const detail = `${mine.daysSinceActivity ?? '—'} j sans activité · ${mine.skippedCount} sautée(s) · ressenti ${mine.avgFeeling ?? '—'}`;
    process.stdout.write(`${pad(name.slice(0, 22), 24)}${pad(PILLS[mine.status], 12)}${pad(PILLS[byDefault.status], 12)}${pad(PILLS[strict.status], 14)}${detail}\n`);
  }

  process.stdout.write(`\n${moved} athlète(s) changent de statut avec des seuils sévères.\n`);
  process.stdout.write(
    moved > 0
      ? 'Les seuils sont bien pris en compte par le calcul.\n\n'
      : "Aucun changement : soit les athlètes n'ont aucune donnée, soit les seuils ne sont pas appliqués.\n\n"
  );
}

main()
  .catch((error) => process.stdout.write(`Erreur : ${error.message}\n`))
  .finally(() => mongoose.disconnect());
