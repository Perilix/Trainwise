const mongoose = require('mongoose');

// Blocs structurés des séances de vélo et de natation, partagés par les séances types
// (SessionTemplate) et les séances planifiées (PlannedRun).
//
// L'intensité est stockée relative (% FTP, % CSS, % FC max) : les watts et les allures
// se calculent à l'affichage depuis la référence de l'athlète (PlannedRun.reference),
// comme les allures de course se calculent depuis la VMA.

const INTENSITY_MODES = [
  'ftp',   // vélo : % de la FTP
  'watts', // vélo : watts fixes
  'hr',    // vélo : % de la FC max
  'rpe',   // ressenti 1-10
  'css',   // natation : % de la vitesse CSS (100 = allure seuil)
  'pace'   // natation : allure fixe en secondes / 100 m
];

const STROKES = ['crawl', 'dos', 'brasse', 'papillon', '4n', 'choix', 'educ', 'jambes', 'bras'];
const EQUIPMENT = ['pull', 'plaquettes', 'palmes', 'tuba', 'planche'];

const sportStepFields = {
  role: { type: String, enum: ['warmup', 'main', 'cooldown'], default: 'main' },
  // Intitulé libre (« Éducatifs », « Bras seuls ») ; sinon le rôle sert de titre.
  label: { type: String, trim: true, default: '' },
  duration: { type: Number, default: null }, // secondes (vélo)
  distance: { type: Number, default: null }, // mètres (natation)
  intensityMode: { type: String, enum: [...INTENSITY_MODES, null], default: null },
  intensityLow: { type: Number, default: null },
  intensityHigh: { type: Number, default: null },
  // Vélo : progression continue de intensityLow à intensityHigh.
  ramp: { type: Boolean, default: false },
  cadence: { type: String, trim: true, default: '' },
  position: { type: String, enum: ['', 'assis', 'danseuse'], default: '' },
  stroke: { type: String, enum: [...STROKES, ''], default: '' },
  equipment: { type: [{ type: String, enum: EQUIPMENT }], default: [] },
  repetitions: { type: Number, default: 1, min: 1 },
  description: { type: String, trim: true, default: '' },
  // Récupération après chaque répétition : durée (vélo), repos au mur ou départ fixe (natation).
  recoveryMode: { type: String, enum: ['duration', 'rest', 'sendoff', null], default: null },
  recoverySeconds: { type: Number, default: null },
  recoveryIntensity: { type: Number, default: null }, // vélo : % FTP pendant la récup
  recoveryDescription: { type: String, trim: true, default: '' },
  order: { type: Number, default: 0 }
};

const sportStepSchema = new mongoose.Schema(sportStepFields, { _id: false });

// Un bloc de 1er niveau peut être un groupe « Répéter » : ses étapes `children`
// sont répétées `repetitions` fois (un seul niveau d'imbrication).
const sportBlockSchema = new mongoose.Schema({
  ...sportStepFields,
  children: { type: [sportStepSchema], default: undefined }
}, { _id: false });

module.exports = { sportBlockSchema, INTENSITY_MODES, STROKES, EQUIPMENT };
