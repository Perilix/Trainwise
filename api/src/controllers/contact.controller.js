const ContactMessage = require('../models/contactMessage.model');

const SUBJECTS = ['question', 'bug', 'compte', 'donnees', 'suggestion', 'autre'];

/**
 * POST /api/contact
 *
 * Ouvert sans compte : le site comme l'application y écrivent. Le message
 * atterrit dans le back-office ; rien n'est renvoyé de l'enregistrement, pour
 * ne pas faire de cette route un moyen de sonder la base.
 */
exports.createMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    await ContactMessage.create({
      name: String(name || '').trim(),
      email: String(email || '').trim(),
      subject: SUBJECTS.includes(subject) ? subject : 'question',
      message: String(message || '').trim(),
      user: req.user?._id || null,
      meta: {
        source: req.body.source === 'app' ? 'app' : 'site',
        platform: req.body.platform || null,
        appVersion: req.body.appVersion || null,
        userAgent: req.headers['user-agent'] || null
      }
    });

    res.status(201).json({ received: true });
  } catch (error) {
    // Les messages de validation du modèle sont lisibles : on les rend tels quels.
    const first = error.errors ? Object.values(error.errors)[0]?.message : null;
    res.status(400).json({ error: first || 'Envoi impossible.' });
  }
};
