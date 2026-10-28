const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { conn, ESPACES } = require('../../config/prospectionDb');

const espace = { type: String, enum: Object.keys(ESPACES), required: true };

const STATUTS = ['À envoyer', 'Programmé', 'Envoyé', 'Relancé', 'Répondu', 'Démo prévue', 'Inscrit', 'Pas intéressé', 'Non', 'Injoignable'];
const AGENTS = {
  radar: ['chercher'],
  facteur: ['programmer'],
  messager: ['contacter'],
  echo: ['relancer'],
  allo: ['relever', 'preparer_appel'],
  scribe: ['raconter']
};

// Compte du bureau pour qui n'est pas admin du back-office (Hugo) : il n'ouvre que le bureau.
const bureauUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  prenom: { type: String, required: true },
  espace
}, { timestamps: true });
bureauUserSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
});
bureauUserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Un coach démarché. onglet + ligne gardent la trace du Sheet d'origine (« S43 », ligne 12).
const contactSchema = new mongoose.Schema({
  espace,
  onglet: { type: String, required: true },
  ligne: { type: Number, required: true },
  statut: { type: String, enum: STATUTS, default: 'À envoyer' },
  nom: { type: String, required: true },
  structure: String,
  ville: String,
  zone: String,
  specialite: String,
  outil: String,
  canal: String,
  contact: String,
  instagram: String,
  envoyeLe: Date,
  relanceLe: Date,
  notes: String,
  source: String,
  semaine: String,
  ajouteLe: Date,
  relanceEnvoyeeLe: Date,
  reponseLe: Date
}, { timestamps: true });
contactSchema.index({ espace: 1, onglet: 1, ligne: 1 }, { unique: true });

// Ordre donné à un agent depuis le bureau, exécuté par le chef de bureau.
const ordreSchema = new mongoose.Schema({
  espace,
  agent: { type: String, enum: Object.keys(AGENTS), required: true },
  action: { type: String, required: true },
  label: String,
  cibles: [{ contactId: mongoose.Schema.Types.ObjectId, onglet: String, ligne: Number, nom: String, structure: String }],
  consigne: String,
  statut: { type: String, enum: ['en_attente', 'en_cours', 'fait', 'erreur'], default: 'en_attente' },
  compteRendu: String,
  auteur: String,
  majLe: Date
}, { timestamps: { createdAt: 'creeLe', updatedAt: false } });
ordreSchema.index({ espace: 1, creeLe: -1 });

const journalSchema = new mongoose.Schema({
  espace,
  agent: String,
  texte: String,
  quand: { type: Date, default: Date.now }
});
journalSchema.index({ espace: 1, quand: -1 });

// Ce que fait un agent en ce moment, pour l'animer en direct sur la page.
const agentEtatSchema = new mongoose.Schema({
  espace,
  agent: { type: String, required: true },
  etat: { type: String, enum: ['au_travail', 'pause'], default: 'pause' },
  tache: String,
  progression: String,
  etape: Number,
  majLe: Date
});
agentEtatSchema.index({ espace: 1, agent: 1 }, { unique: true });

// La boîte Zoho d'un bureau, connectée par son titulaire (OAuth). Le jeton de rafraîchissement est chiffré.
const boiteSchema = new mongoose.Schema({
  espace: { ...espace, unique: true },
  email: String,
  accountId: String,
  accountsServer: String,
  mailApi: String,
  refreshToken: String,
  dossiers: { inbox: String, sent: String },
  dernierReleve: Date,
  connecteeLe: Date
});

const rondeSchema = new mongoose.Schema({
  espace: { ...espace, unique: true },
  derniereRonde: Date
});

module.exports = {
  STATUTS,
  AGENTS,
  BureauUser: conn.model('BureauUser', bureauUserSchema),
  Contact: conn.model('Contact', contactSchema),
  Ordre: conn.model('Ordre', ordreSchema),
  Journal: conn.model('Journal', journalSchema),
  AgentEtat: conn.model('AgentEtat', agentEtatSchema),
  Boite: conn.model('Boite', boiteSchema),
  Ronde: conn.model('Ronde', rondeSchema)
};
