const express = require('express');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const { requireBureau } = require('../middleware/auth');
const { ESPACES } = require('../config/prospectionDb');
const { AGENTS, STATUTS, Contact, Ordre, Journal, AgentEtat, Ronde, Boite } = require('../models/prospection');
const zoho = require('../bureau/zoho');
const chef = require('../bureau/chef');

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
  const [contacts, ordres, journal, agents, ronde, boite] = await Promise.all([
    Contact.find({ espace }).sort({ onglet: 1, ligne: 1 }).lean(),
    Ordre.find({ espace }).sort({ creeLe: -1 }).limit(150).lean(),
    Journal.find({ espace }).sort({ quand: -1 }).limit(40).lean(),
    AgentEtat.find({ espace }).lean(),
    Ronde.findOne({ espace }).lean(),
    Boite.findOne({ espace }).select('email connecteeLe').lean()
  ]);
  res.json({
    peutAgir: peutAgir(req, espace),
    boite: { connectee: !!boite, email: ESPACES[espace].email, zoho: zoho.configure() },
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

// Pouls du bureau : une signature légère de ce qui a bougé. La page la consulte toutes les 2,5 s
// et ne recharge tout l'état que lorsqu'elle change.
router.get('/api/pouls', requireBureau, a(async (req, res) => {
  const { espace } = req.query;
  if (!ESPACES[espace]) return res.status(400).json({ error: 'Bureau inconnu' });
  const dernier = (Modele, champ) => Modele.findOne({ espace }).sort({ [champ]: -1 }).select(champ).lean().then(d => +new Date(d?.[champ] || 0));
  const parts = await Promise.all([dernier(Contact, 'updatedAt'), dernier(Ordre, 'creeLe'), dernier(Ordre, 'majLe'), dernier(Journal, 'quand'),
    dernier(AgentEtat, 'majLe'), dernier(Ronde, 'derniereRonde'), Contact.countDocuments({ espace }), Ordre.countDocuments({ espace })]);
  res.json({ v: parts.join('.') });
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
  chef.reveiller();
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

/* --- Contacts : le fichier de prospection en tableau, avec ses graphiques --- */
router.get('/contacts', requireBureau, a(async (req, res) => {
  const contacts = await Contact.find().sort({ ajouteLe: -1, onglet: -1, ligne: 1 }).lean();
  res.render('prospects', {
    contacts: contacts.map(c => ({ ...versPage(c), espace: c.espace, zone: c.zone || '', source: c.source || '', modifiable: peutAgir(req, c.espace) })),
    statuts: STATUTS, espaces: ESPACES, bureauSeul: !req.session.bureau.admin
  });
}));

router.post('/api/contacts/:id/statut', requireBureau, a(async (req, res) => {
  const { statut } = req.body;
  if (!STATUTS.includes(statut)) return res.status(400).json({ error: 'Statut inconnu' });
  const c = await Contact.findById(req.params.id).catch(() => null);
  if (!c) return res.status(404).json({ error: 'Contact introuvable' });
  if (!peutAgir(req, c.espace)) return res.status(403).json({ error: "Ce n'est pas ton bureau." });
  const avant = c.statut;
  c.statut = statut;
  if (statut === 'Envoyé' && !c.envoyeLe) c.envoyeLe = new Date();
  c.notes = (c.notes ? `${c.notes} · ` : '') + `${frDate(new Date()).slice(0, 5)} : ${avant} → ${statut} (${req.session.bureau.prenom})`;
  await c.save();
  res.json({ ok: true, contact: versPage(c) });
}));

// Export du fichier au format CSV (point-virgule, pour Excel en français).
router.get('/contacts.csv', requireBureau, a(async (req, res) => {
  const contacts = await Contact.find().sort({ espace: 1, onglet: 1, ligne: 1 }).lean();
  const cols = [['Bureau', c => ESPACES[c.espace].secteur], ['Onglet', c => c.onglet], ['Statut', c => c.statut], ['Nom', c => c.nom],
    ['Structure', c => c.structure], ['Ville', c => c.ville], ['Zone', c => c.zone], ['Spécialité', c => c.specialite], ['Outil actuel', c => c.outil],
    ['Canal', c => c.canal], ['Contact', c => c.contact], ['Instagram', c => c.instagram], ['Envoyé le', c => frDate(c.envoyeLe)],
    ['Relance le', c => frDate(relance(c))], ['Notes', c => c.notes], ['Source', c => c.source], ['Ajouté le', c => frDate(c.ajouteLe)]];
  const cellule = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.map(([t]) => cellule(t)).join(';'), ...contacts.map(c => cols.map(([, f]) => cellule(f(c))).join(';'))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="prospection-trainwise-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('\uFEFF' + csv);   // BOM : Excel reconnaît l'UTF-8 et les accents
}));

/* --- Connecter la boîte Zoho d'un bureau (chaque titulaire connecte la sienne) --- */
const redirectUri = req => `${process.env.BUREAU_URL || `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`}/bureau/zoho/callback`;

router.get('/zoho/connecter', requireBureau, (req, res) => {
  const espace = String(req.query.espace || req.session.bureau.espace);
  if (!ESPACES[espace] || !peutAgir(req, espace)) return res.status(403).send("Ce n'est pas ton bureau.");
  if (!zoho.configure()) return res.status(503).send('Zoho n\'est pas encore configuré sur le serveur (ZOHO_CLIENT_ID).');
  const state = crypto.randomBytes(16).toString('hex');
  req.session.zoho = { state, espace };
  res.redirect(zoho.urlAutorisation(redirectUri(req), state));
});

router.get('/zoho/callback', requireBureau, a(async (req, res) => {
  const attendu = req.session.zoho;
  delete req.session.zoho;
  if (!attendu || req.query.state !== attendu.state) return res.redirect('/bureau?zoho=expire');
  if (req.query.error || !req.query.code) return res.redirect('/bureau?zoho=refuse');
  try {
    await zoho.connecter({ code: String(req.query.code), accountsServer: String(req.query['accounts-server'] || ''),
      redirectUri: redirectUri(req), espace: attendu.espace, emailAttendu: ESPACES[attendu.espace].email });
  } catch (e) {
    console.error('Connexion Zoho :', e.response?.data || e.message);
    return res.redirect('/bureau?zoho=' + encodeURIComponent(e.visible ? e.message : 'echec'));
  }
  chef.reveiller();
  res.redirect('/bureau?zoho=ok');
}));

module.exports = router;
