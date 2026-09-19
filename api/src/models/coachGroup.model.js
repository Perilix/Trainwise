const mongoose = require('mongoose');

/**
 * Groupe d'athlètes d'un coach.
 *
 * C'est une étiquette, pas un dossier : un athlète peut appartenir à plusieurs
 * groupes, et retirer un athlète d'un groupe ne touche pas au suivi. Le groupe
 * sert à filtrer la liste, à agir sur plusieurs athlètes d'un coup, et à
 * rassembler ceux qui visent la même course.
 */
const coachGroupSchema = new mongoose.Schema(
  {
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: [true, 'Le nom du groupe est requis'],
      trim: true,
      maxlength: [40, 'Le nom du groupe ne peut pas dépasser 40 caractères']
    },
    // Course visée par le groupe, facultative : c'est elle qui donne l'échéance.
    race: {
      name: { type: String, trim: true, default: null },
      date: { type: Date, default: null }
    },
    // Repère visuel choisi par le coach. Les teintes sont pastel : elles
    // étiquettent, elles ne signalent pas — de quoi cohabiter avec le code
    // couleur de l'app sans s'y confondre.
    //
    // Les quatre dernières valeurs sont l'ancienne palette : elles restent
    // acceptées pour les groupes déjà en base, mais ne sont plus proposées.
    color: {
      type: String,
      enum: ['rouge', 'bleu', 'vert', 'jaune', 'orange', 'violet', 'rose', 'indigo', 'turquoise', 'sable', 'ardoise'],
      default: 'bleu'
    },
    athletes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    // Conversation de groupe, créée à la première discussion. Elle survit aux
    // changements de membres : on ajuste ses participants, on n'en refait pas.
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null
    }
  },
  { timestamps: true }
);

// Deux groupes du même nom chez le même coach ne se distingueraient pas.
coachGroupSchema.index({ coach: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('CoachGroup', coachGroupSchema);
