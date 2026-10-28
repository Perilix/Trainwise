const express = require('express');
const path = require('path');
const router = express.Router();
const { requireBureau } = require('../middleware/auth');
const { ESPACES } = require('../config/prospectionDb');
const { AGENTS, Contact, Ordre, Journal, AgentEtat, Ronde } = require('../models/prospection');

// Express 4 ne rattrape pas les erreurs des handlers async : on les passe à next().
const a = fn => (req, res, next) => fn(req, res, next).catch(next);

// Chacun agit sur son bureau ; l'admin (Julien) peut agir sur les deux.
const peutAgir = (req, espace) => req.session.bureau.admin || req.session.bureau.espace === espace;

const frDate = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' }) : '';
const relance = c => c.relanceLe || (c.envoyeLe ? new Date(new Date(c.envoyeLe).getTime() + 5 * 864e5) : null);

// Même forme que les lignes du Sheet que la page lisait avant.
const versPage = c => ({
  id: c._id.toString(), onglet: c.onglet, ligne: c.ligne, statut: c.statut, nom: c.nom,
  structure: c.structure || '', ville: c.ville || '', canal: c.canal || '', specialite: c.specialite || '',
  outil: c.outil || '', contact: c.contact || '', instagram: c.instagram || '', notes: c.notes || '',
  envoye: frDate(c.envoyeLe), relance: frDate(relance(c)), ajoute: frDate(c.ajouteLe)
});

router.get('/', requireBureau, (req, res) => {
  res.sendFile(path.join(__dirname, '../bureau/bureau.html'));
});

router.get('/api/moi', requireBureau, (req, res) => {
  const { prenom, espace, admin } = req.session.bureau;
  res.json({ prenom, espace, admin, espaces: ESPACES });
});

router.get('/api/etat', requireBureau, a(async (req, res) => {
  const { espace } = req.query;
  if (!ESPACES[espace]) return res.status(400).json({ error: 'Bureau inconnu' });
  const [contacts, ordres, journal, agents, ronde] = await Promise.all([
    Contact.find({ espace }).sort({ onglet: 1, ligne: 1 }).lean(),
    Ordre.find({ espace }).sort({ creeLe: -1 }).limit(150).lean(),
    Journal.find({ espace }).sort({ quand: -1 }).limit(40).lean(),
    AgentEtat.find({ espace }).lean(),
    Ronde.findOne({ espace }).lean()
  ]);
  res.json({
    peutAgir: peutAgir(req, espace),
    contacts: contacts.map(versPage),
    ordres: ordres.map(o => ({
      _id: o._id.toString(), agent: o.agent, action: o.action, label: o.label, consigne: o.consigne || '',
      cibles: o.cibles || [], statut: o.statut, compte_rendu: o.compteRendu || '', cree_le: o.creeLe, maj_le: o.majLe
    })),
    journal: journal.map(j => ({ agent: j.agent, texte: j.texte, quand: j.quand })),
    agents: Object.fromEntries(agents.map(a => [a.agent, { etat: a.etat, tache: a.tache, progression: a.progression, etape: a.etape, maj_le: a.majLe }])),
    chef: ronde ? { derniere_ronde: ronde.derniereRonde } : null
  });
}));

router.post('/api/ordres', requireBureau, a(async (req, res) => {
  const { espace, agent, action, label, consigne, cibles } = req.body;
  if (!ESPACES[espace]) return res.status(400).json({ error: 'Bureau inconnu' });
  if (!peutAgir(req, espace)) return res.status(403).json({ error: "Ce n'est pas ton bureau." });
  if (!AGENTS[agent] || (action !== 'consigne' && !AGENTS[agent].includes(action))) return res.status(400).json({ error: 'Action inconnue' });

  // Les cibles doivent être des contacts de ce bureau.
  const ids = (Array.isArray(cibles) ? cibles : []).map(c => c.id).filter(Boolean);
  const contacts = await Contact.find({ _id: { $in: ids }, espace }).lean();
  const ordre = await Ordre.create({
    espace, agent, action, label: String(label || '').slice(0, 120), consigne: String(consigne || '').slice(0, 4000),
    cibles: contacts.map(c => ({ contactId: c._id, onglet: c.onglet, ligne: c.ligne, nom: c.nom, structure: c.structure })),
    auteur: req.session.bureau.prenom
  });
  res.status(201).json({ id: ordre._id.toString() });
}));

router.delete('/api/ordres/:id', requireBureau, a(async (req, res) => {
  const ordre = await Ordre.findById(req.params.id).catch(() => null);
  if (!ordre) return res.status(404).json({ error: 'Ordre introuvable' });
  if (!peutAgir(req, ordre.espace)) return res.status(403).json({ error: "Ce n'est pas ton bureau." });
  if (ordre.statut !== 'en_attente') return res.status(409).json({ error: 'Ordre déjà pris en charge' });
  await ordre.deleteOne();
  res.json({ ok: true });
}));

module.exports = router;
