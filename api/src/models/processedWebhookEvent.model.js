const mongoose = require('mongoose');

// Trace des events RevenueCat déjà traités, pour garantir l'idempotence :
// RevenueCat peut relivrer le même event (retry), or créditer des coins est
// additif → sans ça, un retry doublerait le solde de l'utilisateur.
// Les enregistrements s'auto-suppriment après 90 jours (TTL) pour ne pas grossir sans fin.
const processedWebhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  type: { type: String },
  createdAt: { type: Date, default: Date.now, expires: '90d' },
});

module.exports = mongoose.model('ProcessedWebhookEvent', processedWebhookEventSchema);
