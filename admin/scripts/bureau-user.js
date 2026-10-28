/**
 * Crée (ou remet à zéro le mot de passe d') un compte du bureau de prospection.
 * Ce compte n'ouvre que le bureau, pas le reste du back-office.
 * Usage : PROSPECTION_MONGODB_URI=... node scripts/bureau-user.js hugo@trainwise-app.com 'motdepasse' Hugo hugo
 */

require('dotenv').config({ quiet: true });
const { conn } = require('../src/config/prospectionDb');
const { BureauUser } = require('../src/models/prospection');

const [email, password, prenom, espace] = process.argv.slice(2);
if (!email || !password || !prenom || !espace) {
  process.stderr.write("Usage : node scripts/bureau-user.js <email> <mot de passe> <prénom> <julien|hugo>\n");
  process.exit(1);
}

(async () => {
  let user = await BureauUser.findOne({ email: email.toLowerCase().trim() });
  if (!user) user = new BureauUser({ email });
  Object.assign(user, { password, prenom, espace });
  await user.save();
  process.stdout.write(`Compte du bureau prêt : ${user.email} (${prenom}, bureau ${espace}).\n`);
  await conn.close();
})().catch(async err => {
  process.stderr.write(`Erreur : ${err.message}\n`);
  await conn.close();
  process.exit(1);
});
