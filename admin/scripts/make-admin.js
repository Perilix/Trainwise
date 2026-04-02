/**
 * Promote a user to admin role.
 * Usage: MONGODB_URI=... node scripts/make-admin.js your@email.com
 */

require('dotenv').config();
const mongoose = require('mongoose');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/make-admin.js your@email.com');
  process.exit(1);
}

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trainwise';

mongoose.connect(uri).then(async () => {
  const result = await mongoose.connection.collection('users').updateOne(
    { email: email.toLowerCase().trim() },
    { $set: { role: 'admin' } }
  );

  if (result.matchedCount === 0) {
    console.error(`❌ Aucun utilisateur trouvé avec l'email : ${email}`);
  } else {
    console.log(`✅ ${email} est maintenant admin.`);
  }

  await mongoose.disconnect();
  process.exit(0);
}).catch(err => {
  console.error('Connexion MongoDB échouée :', err.message);
  process.exit(1);
});
