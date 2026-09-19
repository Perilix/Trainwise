/**
 * Promote a user to admin role.
 * Usage: MONGODB_URI=... node scripts/make-admin.js your@email.com
 */

require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const email = process.argv[2];
if (!email) {
  process.stderr.write(`Usage: node scripts/make-admin.js your@email.com\n`);
  process.exit(1);
}

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trainwise';

mongoose.connect(uri).then(async () => {
  const result = await mongoose.connection.collection('users').updateOne(
    { email: email.toLowerCase().trim() },
    { $set: { role: 'admin' } }
  );

  if (result.matchedCount === 0) {
    process.stderr.write(`Aucun utilisateur trouvé avec l'email : ${email}\n`);
  } else {
    process.stdout.write(`${email} est maintenant admin.\n`);
  }

  await mongoose.disconnect();
  process.exit(0);
}).catch(err => {
  console.error('Connexion MongoDB échouée :', err.message);
  process.exit(1);
});
