const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Le contenu du message est requis'],
    trim: true
  },
  type: {
    type: String,
    // 'system' : une ligne posée par l'app, pas par une personne — une arrivée
    // ou un départ dans une discussion de groupe.
    enum: ['text', 'image', 'document', 'session', 'system'],
    default: 'text'
  },
  // Séance citée dans le message (type 'session'). Figée à l'envoi : la carte
  // reste lisible même si la séance est ensuite modifiée ou supprimée.
  sessionRef: {
    kind: { type: String, enum: ['planned', 'run', 'strength'] },
    id: mongoose.Schema.Types.ObjectId,
    sport: String,
    title: String,
    date: Date,
    meta: String
  },
  attachment: {
    url: String,
    publicId: String,
    filename: String,
    mimeType: String,
    size: Number
  },
  readBy: {
    type: Map,
    of: Date,
    default: new Map()
  }
}, {
  timestamps: true
});

// Index for faster queries
messageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
