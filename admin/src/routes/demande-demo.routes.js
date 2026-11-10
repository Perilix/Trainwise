const express = require('express');
const rateLimit = require('express-rate-limit');
const { Contact, Journal } = require('../models/prospection');

// Formulaire « Je veux une démo » de la page publique www.trainwise-app.com/demo.
// La demande entre dans la base de prospection du bureau de Julien (onglet « Demandes démo »),
// en « Répondu » : c'est le coach qui nous a écrit, à nous de le rappeler.

const router = express.Router();

const ORIGINES = ['https://www.trainwise-app.com', 'https://trainwise-app.com', 'http://localhost:4200'];
const ONGLET = 'Demandes démo';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.use((req, res, next) => {
  const origine = req.get('origin');
  if (ORIGINES.includes(origine)) {
    res.set('Access-Control-Allow-Origin', origine);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// La page appelle ce ping dès son ouverture : le serveur se réveille pendant que le visiteur remplit le formulaire.
router.get('/ping', (req, res) => res.json({ ok: true }));

const limite = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Trop de demandes. Réessayez dans quelques minutes.' })
});

const texte = (v, max) => String(v ?? '').trim().slice(0, max);

router.post('/', limite, async (req, res) => {
  // Champ piège invisible : un robot le remplit, un humain non.
  if (texte(req.body.site, 200)) return res.json({ ok: true });

  const nom = texte(req.body.nom, 120);
  const email = texte(req.body.email, 160).toLowerCase();
  const telephone = texte(req.body.telephone, 40);
  const athletes = texte(req.body.athletes, 40);
  const message = texte(req.body.message, 1500);
  if (!nom || !EMAIL.test(email)) return res.status(400).json({ error: 'Indiquez votre nom et un email valide.' });

  const quand = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' });
  const detail = [telephone && `tél. ${telephone}`, athletes && `${athletes} athlètes`, message && `« ${message} »`].filter(Boolean).join(' · ');
  const note = `${quand} : demande de démo via la page /demo${detail ? ` (${detail})` : ''}`;

  try {
    // Déjà dans la base (un coach qu'on a démarché, par exemple) : on le passe en « Répondu » plutôt que de le dupliquer.
    const existant = await Contact.findOne({ espace: 'julien', contact: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (existant) {
      existant.statut = 'Répondu';
      existant.reponseLe = new Date();
      existant.notes = existant.notes ? `${existant.notes} · ${note}` : note;
      await existant.save();
    } else {
      const dernier = await Contact.findOne({ espace: 'julien', onglet: ONGLET }).sort({ ligne: -1 }).select('ligne').lean();
      await Contact.create({
        espace: 'julien', onglet: ONGLET, ligne: dernier ? dernier.ligne + 1 : 2, statut: 'Répondu',
        nom, contact: email, canal: 'Email', source: 'Page /demo', notes: note, ajouteLe: new Date(), reponseLe: new Date()
      });
    }
    await Journal.create({ espace: 'julien', agent: 'allo', texte: `Demande de démo : ${nom} (${email})${detail ? ` · ${detail}` : ''}` });
    res.json({ ok: true });
  } catch (e) {
    console.error('Demande de démo :', e.message);
    res.status(500).json({ error: "La demande n'a pas pu être enregistrée." });
  }
});

module.exports = router;
