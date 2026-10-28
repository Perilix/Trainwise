const mongoose = require('mongoose');

// Base de la prospection, séparée de celle de l'app : les coachs démarchés et les comptes
// du bureau (Hugo) ne côtoient jamais les comptes et les données des utilisateurs Trainwise.
// dbName forcé : même si l'adresse ne précise pas de base, on n'écrit jamais ailleurs que dans trainwise-prospection.
const conn = mongoose.createConnection(
  process.env.PROSPECTION_MONGODB_URI || 'mongodb://localhost:27017/trainwise-prospection',
  { dbName: 'trainwise-prospection' }
);
conn.on('error', err => console.error('Prospection MongoDB error:', err.message));

// Les deux bureaux : chacun a son secteur, sa boîte mail et sa signature.
const ESPACES = {
  julien: { prenom: 'Julien', secteur: 'Bordeaux', email: 'julien@trainwise-app.com' },
  hugo: { prenom: 'Hugo', secteur: 'Alsace', email: 'hugo@trainwise-app.com' }
};

module.exports = { conn, ESPACES };
