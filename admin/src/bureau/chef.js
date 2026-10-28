const { ESPACES } = require('../config/prospectionDb');
const { Contact, Ordre, Journal, AgentEtat, Ronde, Boite } = require('../models/prospection');
const zoho = require('./zoho');
const modeles = require('./modeles');
const ia = require('./ia');

// Le chef de bureau : il exécute les ordres dès qu'ils arrivent, en deux files pour qu'une longue recherche
// ne retarde jamais un mail. File mail (Zoho) : Facteur, Écho, relève d'Allô. File IA (Claude) : Radar,
// fiches d'appel d'Allô, Messager, Scribe. Il relève aussi les boîtes toutes les 10 minutes, passe en
// « Envoyé » les mails programmés partis et lance la recherche de coachs chaque lundi matin.

const TZ = 'Europe/Paris';
const MIN = 60000;
const PAS = 20 * MIN;
// Fenêtre des premiers mails, heure de Paris, en semaine. Boîte d'Hugo neuve : 15 envois par jour au plus (8 h → 12 h 40).
const FENETRES = { julien: [8 * 60, 18 * 60 + 20], hugo: [8 * 60, 12 * 60 + 40] };
const RELEVE = 10 * MIN;
const EXECUTES = [{ agent: 'facteur', action: 'programmer' }, { agent: 'echo', action: 'relancer' }, { agent: 'allo', action: 'relever' }];
const NOMS = { facteur: 'Facteur', echo: 'Écho', allo: 'Allô', radar: 'Radar', messager: 'Messager', scribe: 'Scribe' };
const EXECUTES_IA = [{ agent: 'radar', action: { $in: ['chercher', 'consigne'] } }, { agent: 'allo', action: 'preparer_appel' },
  { agent: 'messager', action: 'contacter' }, { agent: 'scribe', action: 'raconter' }];
// Une consigne libre donnée à un autre agent n'a pas d'exécutant : on le dit plutôt que de la laisser en attente.
const SANS_EXECUTANT = { action: 'consigne', agent: { $ne: 'radar' } };

/* --- Heure de Paris --- */
function heureParis(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(d).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month, j: +p.day, h: +p.hour, mi: +p.minute, wd: p.weekday };
}
function dateParis(y, m, j, h, mi) {
  let t = Date.UTC(y, m - 1, j, h, mi);
  for (let i = 0; i < 2; i++) { const p = heureParis(new Date(t)); t -= Date.UTC(p.y, p.m - 1, p.j, p.h, p.mi) - Date.UTC(y, m - 1, j, h, mi) }
  return new Date(t);
}
const z2 = n => String(n).padStart(2, '0');
const horaireZoho = d => { const p = heureParis(d); return `${z2(p.m)}/${z2(p.j)}/${p.y} ${z2(p.h)}:${z2(p.mi)}:00` };
const jourFr = d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: TZ });
const heureFr = d => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const ouvre = p => p.wd !== 'Sat' && p.wd !== 'Sun';

// Les n prochains créneaux libres du bureau : un toutes les 20 min, après le dernier mail déjà programmé.
async function creneaux(espace, n) {
  const dernier = await Contact.findOne({ espace, statut: 'Programmé', envoyeLe: { $gte: new Date() } }).sort({ envoyeLe: -1 }).select('envoyeLe').lean();
  let t = Math.max(Date.now() + 15 * MIN, dernier ? +dernier.envoyeLe + PAS : 0);
  const [debut, fin] = FENETRES[espace], out = [];
  while (out.length < n) {
    const p = heureParis(new Date(t)), min = p.h * 60 + p.mi;
    if (!ouvre(p) || min > fin) {
      const demain = heureParis(new Date(+dateParis(p.y, p.m, p.j, 12, 0) + 24 * 3600e3));
      t = +dateParis(demain.y, demain.m, demain.j, Math.floor(debut / 60), debut % 60);
    } else if (min < debut) {
      t = +dateParis(p.y, p.m, p.j, Math.floor(debut / 60), debut % 60);
    } else { out.push(new Date(t)); t += PAS }
  }
  return out;
}
// Une relance part tout de suite en journée ouvrée (8 h-19 h), sinon au prochain matin à 8 h 30.
function quandRelancer() {
  const p = heureParis(new Date()), min = p.h * 60 + p.mi;
  if (ouvre(p) && min >= 8 * 60 && min < 19 * 60) return null;
  let d = min >= 19 * 60 || !ouvre(p) ? heureParis(new Date(+dateParis(p.y, p.m, p.j, 12, 0) + 24 * 3600e3)) : p;
  while (!ouvre(d)) d = heureParis(new Date(+dateParis(d.y, d.m, d.j, 12, 0) + 24 * 3600e3));
  return dateParis(d.y, d.m, d.j, 8, 30);
}

/* --- Outils --- */
const emailDe = c => /@/.test(c.contact || '') ? c.contact.trim().toLowerCase() : null;
const ajouterNote = (c, texte) => (c.notes ? `${c.notes} · ` : '') + `${jourFr(new Date())} : ${texte}`;
const etat = (espace, agent, data) => AgentEtat.findOneAndUpdate({ espace, agent }, { ...data, majLe: new Date() }, { upsert: true });
const journal = (espace, agent, texte) => Journal.create({ espace, agent, texte: texte.slice(0, 200) });
// « 2 mails programmés » : chaque mot de l'expression prend le pluriel.
const pluriel = (n, expr) => `${n} ${n > 1 ? expr.split(' ').map(m => m + 's').join(' ') : expr}`;
const visible = message => Object.assign(new Error(message), { visible: true });

/* --- Facteur : premiers mails programmés --- */
async function programmer(ordre, boite, avancer) {
  const contacts = await Contact.find({ _id: { $in: ordre.cibles.map(c => c.contactId) }, espace: ordre.espace }).lean();
  const sautes = [], faits = [];
  const cibles = contacts.filter(c => {
    if (c.statut !== 'À envoyer') { sautes.push(`${c.nom} (déjà ${c.statut.toLowerCase()})`); return false }
    if (!emailDe(c)) { sautes.push(`${c.nom} (pas d'email)`); return false }
    return true;
  });
  const slots = await creneaux(ordre.espace, cibles.length);
  for (const [i, c] of cibles.entries()) {
    await avancer(i, cibles.length, 3, `Programme ${c.nom}`);
    const m = modeles.premierMail(ordre.espace, c);
    try {
      await zoho.api(boite, 'post', '/messages', { body: { fromAddress: boite.email, toAddress: emailDe(c), subject: m.sujet, content: m.html,
        mailFormat: 'html', isSchedule: true, scheduleType: 6, timeZone: TZ, scheduleTime: horaireZoho(slots[faits.length]) } });
    } catch (e) { sautes.push(`${c.nom} (${erreurZoho(e)})`); continue }
    const quand = slots[faits.length];
    await Contact.updateOne({ _id: c._id }, { statut: 'Programmé', envoyeLe: quand, relanceLe: new Date(+quand + 5 * 864e5),
      notes: ajouterNote(c, `premier mail programmé le ${jourFr(quand)} à ${heureFr(quand)}`) });
    faits.push(quand);
  }
  if (!faits.length && sautes.length) throw visible(`Aucun mail programmé. ${sautes.join(', ')}.`);
  const plage = faits.length === 1 ? ` pour le ${jourFr(faits[0])} à ${heureFr(faits[0])}`
    : faits.length ? `, du ${jourFr(faits[0])} ${heureFr(faits[0])} au ${jourFr(faits.at(-1))} ${heureFr(faits.at(-1))}` : '';
  return `${pluriel(faits.length, 'mail programmé')}${plage}.${sautes.length ? ` Sautés : ${sautes.join(', ')}.` : ''}`;
}

/* --- Écho : relance J+5, en réponse au premier mail --- */
async function envoyes(boite) {
  const { sent } = await zoho.dossiers(boite), tous = [];
  for (let start = 1; start <= 801; start += 200) {
    const page = await zoho.api(boite, 'get', '/messages/view', { params: { folderId: sent, start, limit: 200 } }) || [];
    tous.push(...page);
    if (page.length < 200) break;
  }
  return tous.map(m => ({ ...m, a: String(m.toAddress || '').replace(/&lt;|&gt;/g, ' ').toLowerCase() }));
}
async function relancer(ordre, boite, avancer) {
  const contacts = await Contact.find({ _id: { $in: ordre.cibles.map(c => c.contactId) }, espace: ordre.espace }).lean();
  const sautes = [], faits = [];
  const cibles = contacts.filter(c => {
    if (c.statut !== 'Envoyé' || c.relanceEnvoyeeLe) { sautes.push(`${c.nom} (${c.relanceEnvoyeeLe ? 'déjà relancé' : c.statut.toLowerCase()})`); return false }
    if (!emailDe(c)) { sautes.push(`${c.nom} (pas d'email)`); return false }
    return true;
  });
  const liste = cibles.length ? await envoyes(boite) : [];
  const plus_tard = quandRelancer();
  for (const [i, c] of cibles.entries()) {
    await avancer(i, cibles.length, 2, `Relance ${c.nom}`);
    const original = liste.find(m => m.a.includes(emailDe(c)) && !/^re\s*:/i.test(m.subject || ''));
    if (!original) { sautes.push(`${c.nom} (premier mail introuvable dans Envoyés)`); continue }
    const body = { fromAddress: boite.email, toAddress: emailDe(c), action: 'reply', subject: `Re: ${original.subject}`,
      content: modeles.relance(ordre.espace, c), mailFormat: 'html' };
    if (plus_tard) Object.assign(body, { isSchedule: true, scheduleType: 6, timeZone: TZ, scheduleTime: horaireZoho(plus_tard) });
    try { await zoho.api(boite, 'post', `/messages/${original.messageId}`, { body }) } catch (e) { sautes.push(`${c.nom} (${erreurZoho(e)})`); continue }
    await Contact.updateOne({ _id: c._id }, { statut: 'Relancé', relanceEnvoyeeLe: plus_tard || new Date(),
      notes: ajouterNote(c, plus_tard ? `relance programmée le ${jourFr(plus_tard)} à ${heureFr(plus_tard)}` : 'relance envoyée') });
    faits.push(c.nom);
  }
  if (!faits.length && sautes.length) throw visible(`Aucune relance partie. ${sautes.join(', ')}.`);
  return `${pluriel(faits.length, 'relance')} ${plus_tard ? `programmée${faits.length > 1 ? 's' : ''} pour le ${jourFr(plus_tard)} à ${heureFr(plus_tard)}` : `partie${faits.length > 1 ? 's' : ''}`}.${sautes.length ? ` Sautés : ${sautes.join(', ')}.` : ''}`;
}

/* --- Allô : relève de la boîte, réponses et adresses en échec --- */
const DEJA_CLASSE = ['Répondu', 'Démo prévue', 'Inscrit', 'Pas intéressé', 'Non', 'Injoignable'];
async function relever(espace, boite) {
  const { inbox } = await zoho.dossiers(boite);
  const depuis = +(boite.dernierReleve || 0);
  const messages = await zoho.api(boite, 'get', '/messages/view', { params: { folderId: inbox, limit: 100 } }) || [];
  const nouveaux = messages.filter(m => +m.receivedTime > depuis).sort((a, b) => a.receivedTime - b.receivedTime);
  const contacts = await Contact.find({ espace, contact: /@/ }).lean();
  const parEmail = new Map(contacts.map(c => [c.contact.trim().toLowerCase(), c]));
  const reponses = [], rebonds = [];
  for (const m of nouveaux) {
    const de = (String(m.fromAddress || '').match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [''])[0].toLowerCase();
    const resume = String(m.summary || m.subject || '').replace(/\s+/g, ' ').trim();
    if (/mailer-daemon|postmaster/.test(de) || /undeliver|non distribu|delivery status|échec de (la )?remise/i.test(m.subject || '')) {
      const cible = [...parEmail.keys()].find(e => resume.toLowerCase().includes(e));
      const c = cible && parEmail.get(cible);
      if (c && c.statut !== 'Injoignable') {
        await Contact.updateOne({ _id: c._id }, { statut: 'Injoignable', notes: ajouterNote(c, 'mail revenu : adresse inexistante') });
        await journal(espace, 'allo', `Mail revenu pour ${c.nom} : adresse inexistante`);
        rebonds.push(c.nom);
      }
      continue;
    }
    const c = parEmail.get(de);
    if (!c || DEJA_CLASSE.includes(c.statut)) continue;
    await Contact.updateOne({ _id: c._id }, { statut: 'Répondu', reponseLe: new Date(+m.receivedTime),
      notes: ajouterNote(c, `réponse reçue : « ${resume.slice(0, 160)} »`) });
    await journal(espace, 'allo', `${c.nom} a répondu`);
    reponses.push(c.nom);
  }
  const plusRecent = Math.max(depuis, ...messages.map(m => +m.receivedTime || 0));
  await Boite.updateOne({ espace }, { dernierReleve: new Date(plusRecent || Date.now()) });
  return { reponses, rebonds, lus: nouveaux.length };
}
const resumeReleve = r => [
  r.reponses.length ? `${pluriel(r.reponses.length, 'réponse')} : ${r.reponses.join(', ')}` : 'Aucune nouvelle réponse',
  r.rebonds.length ? `${pluriel(r.rebonds.length, 'adresse')} en échec : ${r.rebonds.join(', ')}` : ''
].filter(Boolean).join('. ') + '.';

function erreurZoho(e) {
  const d = e.response?.data;
  return d?.data?.moreInfo || d?.data?.errorCode || d?.status?.description || e.message;
}

/* --- Un ordre --- */
async function executer(ordre) {
  const { espace, agent } = ordre;
  const avancer = (i, n, etape, tache) => etat(espace, agent, { etat: 'au_travail', tache: tache || ordre.label, progression: `${i}/${n}`, etape });
  try {
    await etat(espace, agent, { etat: 'au_travail', tache: ordre.label, progression: `0/${ordre.cibles.length || 1}`, etape: 1 });
    let compteRendu;
    if (ordre.action === 'consigne' && agent !== 'radar') {
      throw visible(`${NOMS[agent]} ne sait pas encore suivre une consigne libre : utilise un de ses boutons d'action.`);
    } else if (['radar', 'messager', 'scribe'].includes(agent) || ordre.action === 'preparer_appel') {
      if (!ia.configure()) throw visible("L'API Claude n'est pas configurée sur le serveur (ANTHROPIC_API_KEY).");
      compteRendu = agent === 'radar' ? await ia.radar(ordre, avancer)
        : agent === 'messager' ? await ia.messages(ordre, avancer)
        : agent === 'scribe' ? await ia.scribe(ordre, avancer)
        : await ia.ficheAppel(ordre, avancer);
    } else {
      const boite = await Boite.findOne({ espace }).lean();
      if (!boite) throw visible(`La boîte ${ESPACES[espace].email} n'est pas connectée : ouvre la fiche de ${NOMS[agent]} et clique sur « Connecter la boîte Zoho ».`);
      compteRendu = agent === 'facteur' ? await programmer(ordre, boite, avancer)
        : agent === 'echo' ? await relancer(ordre, boite, avancer)
        : resumeReleve(await relever(espace, boite));
    }
    await Ordre.updateOne({ _id: ordre._id }, { statut: 'fait', compteRendu, majLe: new Date() });
    await journal(espace, agent, compteRendu);
  } catch (e) {
    const message = e.visible ? e.message : e.response ? `Zoho a répondu : ${erreurZoho(e)}` : `Erreur : ${e.message}`;
    console.error(`Ordre ${ordre._id} (${agent}) :`, message);
    await Ordre.updateOne({ _id: ordre._id }, { statut: 'erreur', compteRendu: message, majLe: new Date() });
    await journal(espace, agent, `Bloqué : ${message}`);
  } finally {
    await etat(espace, agent, { etat: 'pause', tache: '', progression: '', etape: 0 });
  }
}

/* --- La recherche du lundi : 30 coachs par bureau (BUREAU_RECHERCHE_LUNDI), chaque lundi vers 6 h --- */
const RECHERCHE_LUNDI = Number(process.env.BUREAU_RECHERCHE_LUNDI) || 30;
async function rechercheDuLundi() {
  const p = heureParis(new Date());
  if (p.wd !== 'Mon' || p.h < 6 || !ia.configure()) return;
  const { annee, numero } = ia.semaineIso(), semaine = `${annee}-S${numero}`;
  for (const espace of Object.keys(ESPACES)) {
    const r = await Ronde.findOneAndUpdate({ espace, rechercheSemaine: { $ne: semaine } }, { rechercheSemaine: semaine }, { upsert: false });
    if (!r) continue;
    await Ordre.create({ espace, agent: 'radar', action: 'chercher', label: 'Recherche du lundi', auteur: 'Chef de bureau',
      consigne: `Recherche hebdomadaire : ${RECHERCHE_LUNDI} nouveaux coachs dans le secteur ${ESPACES[espace].secteur}.` });
  }
}

/* --- La file IA (Claude) --- */
let iaEnCours = false;
async function rondeIA() {
  if (iaEnCours) return;
  iaEnCours = true;
  try {
    let ordre;
    while ((ordre = await Ordre.findOneAndUpdate({ statut: 'en_attente', $or: [...EXECUTES_IA, SANS_EXECUTANT] }, { statut: 'en_cours', majLe: new Date() },
      { sort: { creeLe: 1 }, new: true }))) await executer(ordre);
  } catch (e) {
    console.error('Chef de bureau (IA) :', e.message);
  } finally { iaEnCours = false }
}

/* --- La ronde --- */
let enCours = false, encore = false;
const derniereReleve = {};
async function ronde() {
  if (enCours) { encore = true; return }
  enCours = true;
  try {
    await rechercheDuLundi();
    rondeIA();
    // Les mails programmés dont l'heure est passée sont partis.
    await Contact.updateMany({ statut: 'Programmé', envoyeLe: { $lt: new Date(Date.now() - 5 * MIN) } }, { statut: 'Envoyé' });
    for (const espace of Object.keys(ESPACES)) {
      const boite = await Boite.findOne({ espace }).lean();
      if (!boite || Date.now() - (derniereReleve[espace] || 0) < RELEVE) continue;
      derniereReleve[espace] = Date.now();
      try { await relever(espace, boite) } catch (e) { console.error(`Relève ${espace} :`, erreurZoho(e)) }
    }
    let ordre;
    while ((ordre = await Ordre.findOneAndUpdate({ statut: 'en_attente', $or: EXECUTES }, { statut: 'en_cours', majLe: new Date() },
      { sort: { creeLe: 1 }, new: true }))) await executer(ordre);
    await Promise.all(Object.keys(ESPACES).map(espace => Ronde.updateOne({ espace }, { derniereRonde: new Date() }, { upsert: true })));
  } catch (e) {
    console.error('Chef de bureau :', e.message);
  } finally {
    enCours = false;
    if (encore) { encore = false; setImmediate(ronde) }
  }
}

function demarrer() {
  if (!zoho.configure()) process.stdout.write('Chef de bureau : ZOHO_CLIENT_ID absent, les agents mail restent en pause.\n');
  if (!ia.configure()) process.stdout.write('Chef de bureau : ANTHROPIC_API_KEY absent, Radar, Messager, Scribe et les fiches d\'appel restent en pause.\n');
  // Un ordre resté « en cours » (redémarrage pendant l'exécution) repart.
  Ordre.updateMany({ statut: 'en_cours', majLe: { $lt: new Date(Date.now() - 15 * MIN) } }, { statut: 'en_attente' }).catch(() => {});
  setInterval(ronde, 20000);
  ronde();
  process.stdout.write('Chef de bureau : en service.\n');
}
// Appelé quand un ordre arrive : il part tout de suite, sans attendre la prochaine ronde.
const reveiller = () => setImmediate(ronde);

module.exports = { demarrer, reveiller, creneaux, heureParis };
