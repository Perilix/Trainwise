const mongoose = require('mongoose');

// Champs d'une étape running (réutilisés pour les blocs de 1er niveau ET les
// enfants d'un bloc « Répéter » multi-étapes via `children`).
const runBlockStepFields = {
  role: { type: String, enum: ['warmup', 'main', 'cooldown'], default: 'main' },
  mode: { type: String, enum: ['distance', 'duration'], default: 'distance' },
  distance: { type: Number, default: null }, // km, si mode='distance'
  duration: { type: Number, default: null }, // minutes, si mode='duration'
  pace: { type: String, default: null }, // "mm:ss" /km — valeur finale affichée à l'athlète
  repetitions: { type: Number, default: 1, min: 1 },
  description: { type: String, default: '' },
  recoveryMode: { type: String, enum: ['distance', 'duration', null], default: null },
  recoveryDistance: { type: Number, default: null }, // km
  recoveryDuration: { type: String, default: null }, // texte libre, ex: "1min30"
  recoveryPace: { type: String, default: null }, // "mm:ss" /km, optionnel
  recoveryDescription: { type: String, default: '' },
  order: { type: Number, default: 0 },
  paceSource: {
    mode: { type: String, enum: ['absolute', 'vmaPercent', 'zone', null], default: null },
    zone: { type: String, default: null },
    vmaPercent: { type: Number, default: null },
    resolvedFromVma: { type: Number, default: null },
    overridden: { type: Boolean, default: false }
  },
  recoveryPaceSource: {
    mode: { type: String, enum: ['absolute', 'vmaPercent', 'zone', null], default: null },
    zone: { type: String, default: null },
    vmaPercent: { type: Number, default: null },
    resolvedFromVma: { type: Number, default: null },
    overridden: { type: Boolean, default: false }
  }
};

const plannedRunSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  // Type d'activité : running (défaut pour backward compat) ou strength
  activityType: {
    type: String,
    enum: ['running', 'strength'],
    default: 'running'
  },
  sessionType: {
    type: String,
    enum: [
      // Running types
      'endurance', 'fractionne', 'tempo', 'recuperation', 'sortie_longue', 'cotes', 'fartlek',
      // Strength types
      'upper_body', 'lower_body', 'full_body', 'push', 'pull', 'legs', 'core', 'hiit'
    ],
    required: true
  },
  targetDistance: {
    type: Number, // en km
    default: null
  },
  targetDuration: {
    type: Number, // en minutes
    default: null
  },
  targetPace: {
    type: String, // format "5:30"
    default: null
  },
  // Titre court de la séance (ex: "Fractionné court 8×400m")
  title: {
    type: String,
    trim: true,
    default: null
  },
  description: {
    type: String, // conseils IA pour la séance
    trim: true
  },
  warmup: {
    type: String, // description échauffement
    trim: true
  },
  mainWorkout: {
    type: String, // description corps de séance
    trim: true
  },
  cooldown: {
    type: String, // description retour au calme
    trim: true
  },

  // Champs spécifiques musculation (pour séances planifiées)
  strengthPlan: {
    exercises: [{
      exercise: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exercise'
      },
      targetSets: Number,
      targetReps: String, // "8-12" format
      targetWeight: Number, // kg (optionnel)
      targetRest: String,  // texte libre (ex: "60s", "1min30", "2 min")
      notes: String
    }],
    // Bloc Circuit — exos répétés en boucle (HIIT, condition physique)
    circuit: {
      name: String,
      rounds: { type: Number, default: 3 },
      restBetweenRounds: { type: Number, default: 60 }, // secondes
      exercises: [{
        exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
        targetSets: Number,
        targetReps: String,
        targetWeight: Number,
        targetRest: String,
        notes: String
      }]
    },
    // Bloc Super-set — paires d'exos enchaînés sans repos
    superset: {
      name: String,
      sets: { type: Number, default: 4 },
      restBetweenSets: { type: Number, default: 90 }, // secondes
      pairs: [{
        a: {
          exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
          targetSets: Number,
          targetReps: String,
          targetWeight: Number,
          targetRest: String,
          notes: String
        },
        b: {
          exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
          targetSets: Number,
          targetReps: String,
          targetWeight: Number,
          targetRest: String,
          notes: String
        }
      }]
    },
    estimatedDuration: Number // minutes
  },

  // Blocs running structurés (échauffement, corps de séance répétés, retour au calme).
  // Un bloc peut être un groupe « Répéter » multi-étapes via `children`.
  runBlocks: [{
    ...runBlockStepFields,
    // Étapes enfants d'un bloc « Répéter » (ex: 3×(400/500/600/500/400)).
    // Si non vide, le bloc est un groupe : ces étapes sont répétées `repetitions` fois.
    children: { type: [runBlockStepFields], default: undefined }
  }],

  // Référence vers le template d'origine (si la séance a été créée depuis la bibliothèque)
  templateRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SessionTemplate',
    default: null
  },

  status: {
    type: String,
    enum: ['planned', 'completed', 'skipped'],
    default: 'planned'
  },
  // true si la séance a été marquée sautée automatiquement par le job quotidien
  // (date passée sans activité). Un import tardif peut encore la matcher.
  autoSkipped: {
    type: Boolean,
    default: false
  },
  linkedRun: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Run',
    default: null
  },
  linkedStrengthSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StrengthSession',
    default: null
  },
  weekNumber: {
    type: Number // numéro de semaine dans le plan
  },
  feeling: {
    type: Number,
    min: 1,
    max: 10,
    default: null
  },
  generatedBy: {
    type: String,
    enum: ['ai', 'manual', 'coach'],
    default: 'ai'
  },
  // Qui a créé cette séance (null = l'athlète lui-même)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Index pour récupérer efficacement les séances d'un utilisateur
plannedRunSchema.index({ user: 1, date: 1 });
plannedRunSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('PlannedRun', plannedRunSchema);
