const Anthropic = require('@anthropic-ai/sdk');
const { ESPACES } = require('../config/prospectionDb');
const { Contact, Depense, STATUTS } = require('../models/prospection');

// Les agents qui réfléchissent : Radar (recherche de coachs sur le web), Allô (fiches d'appel),
// Messager (messages pour formulaires et Instagram) et le Scribe (statuts à partir d'un récit).
// Chaque appel est compté dans la dépense du mois, et le bureau s'arrête au plafond.

// Radar fait beaucoup de recherches : Haiku, trois fois moins cher à qualité suffisante (testé le 28/10).
// Fiches d'appel, messages et Scribe : Sonnet, peu d'appels mais plus de finesse.
const MODELES = { recherche: process.env.BUREAU_MODELE_RECHERCHE || 'claude-haiku-5-5', redaction: process.env.BUREAU_MODELE || 'claude-sonnet-5-5' };
const PLAFOND = Number(process.env.BUREAU_BUDGET_MENSUEL_USD) || 25;
// Dollars par million de tokens : entrée, sortie, lecture de cache. Recherche web : 10 $ les 1 000.
// Haiku passe à 0,50 / 2,50 $ au-delà de 100 000 tokens d'entrée par requête.
const TARIFS = { 'claude-sonnet-5-5': [2, 10, 0.2], 'claude-opus-5-5': [4, 20, 0.2], 'claude-haiku-5-5': [0.1, 0.5, 0.01] };
const tarif = (modele, usage) => {
  const entree = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  return modele === 'claude-haiku-5-5' && entree > 100000 ? [0.5, 2.5, 0.05] : TARIFS[modele] || TARIFS['claude-sonnet-5-5'];
};

const configure = () => !!process.env.ANTHROPIC_API_KEY;
let client;
const claude = () => (client ||= new Anthropic());
const visible = message => Object.assign(new Error(message), { visible: true });
const mois = () => new Date().toISOString().slice(0, 7);

async function depenseDuMois() {
  const d = await Depense.findOne({ mois: mois() }).lean();
  return d?.dollars || 0;
}
async function compter(modele, usage) {
  const [entree, sortie, cache] = tarif(modele, usage);
  const recherches = usage.server_tool_use?.web_search_requests || 0;
  const dollars = ((usage.input_tokens || 0) * entree + (usage.cache_creation_input_tokens || 0) * entree * 1.25
    + (usage.cache_read_input_tokens || 0) * cache + (usage.output_tokens || 0) * sortie) / 1e6 + recherches * 0.01;
  await Depense.updateOne({ mois: mois() }, { $inc: { dollars, appels: 1, recherches } }, { upsert: true });
}

// Boucle d'agent : outils serveur (recherche web) et outils du bureau, reprise après pause_turn,
// plafond de dépense vérifié avant chaque appel.
async function boucle({ modele = MODELES.redaction, system, contenu, outils, executer = async () => '', tours = 14, effort = 'medium', maxTokens = 16000 }) {
  const messages = [{ role: 'user', content: contenu }];
  for (let i = 0; i < tours; i++) {
    const depense = await depenseDuMois();
    if (depense >= PLAFOND) throw visible(`Plafond du mois atteint (${depense.toFixed(2)} $ sur ${PLAFOND} $) : le bureau reprendra le mois prochain, ou relève BUREAU_BUDGET_MENSUEL_USD.`);
    // Repli côté serveur si un filtre de sécurité refuse la demande (« default » : le modèle de repli est choisi par l'API).
    const rep = await claude().beta.messages.create({ model: modele, max_tokens: maxTokens, system, messages, tools: outils,
      output_config: { effort }, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
    await compter(modele, rep.usage);
    messages.push({ role: 'assistant', content: rep.content });
    if (rep.stop_reason === 'refusal') throw visible("Claude a refusé cette demande. Reformule la consigne.");
    if (rep.stop_reason === 'pause_turn') continue;
    const appels = rep.content.filter(b => b.type === 'tool_use');
    if (!appels.length) return rep.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    const resultats = [];
    for (const a of appels) {
      try { resultats.push({ type: 'tool_result', tool_use_id: a.id, content: String(await executer(a.name, a.input)) }) }
      catch (e) { resultats.push({ type: 'tool_result', tool_use_id: a.id, content: e.message, is_error: true }) }
    }
    messages.push({ role: 'user', content: resultats });
  }
  throw visible('Le travail a pris trop d\'étapes : réessaie avec une consigne plus précise.');
}

const web = (recherches, lectures) => [
  { type: 'web_search_20260209', name: 'web_search', max_uses: recherches },
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: lectures }
].filter(o => o.max_uses > 0);

/* --- Radar : chercher des coachs dans le secteur du bureau --- */

const ZONES = {
  julien: ['Bordeaux et Gironde', 'Landes et Pays basque', 'Charente-Maritime et Charente', 'Dordogne et Lot-et-Garonne', 'Poitou (Vienne, Deux-Sèvres) et Limousin'],
  hugo: ['Strasbourg et Bas-Rhin', 'Colmar, Mulhouse et Haut-Rhin', 'Moselle (Metz) et Vosges', 'Territoire de Belfort, Montbéliard et Nancy']
};
const SYSTEME_RADAR = `Tu cherches des coachs d'endurance français pour Trainwise, une app de suivi d'entraînement pour coachs et athlètes (planning, bibliothèque de séances, messagerie, synchro Strava, suivi muscu, forme des athlètes).

Cibles, par priorité : (a) coachs indépendants de course à pied, trail, triathlon, vélo, natation qui suivent des athlètes à distance (souvent sur Nolio, TrainingPeaks, Optitrainer, un Google Sheet) ; (b) préparateurs physiques et coachs Hyrox qui suivent des sportifs avec un programme ; (c) en dernier recours, des clubs (athlé hors stade, trail, triathlon) via leur email. Jamais de plateforme concurrente (Nolio, TrainingPeaks, Opentri… en tant qu'entreprises).

Priorité aux contacts avec un email public : cherche-le dans la page contact, les mentions légales, le profil Malt ou LinkedIn. N'invente jamais un email et ne le devine pas d'après un motif : il doit apparaître sur une page publique, que tu indiques en source. Sans email, donne le lien du formulaire, du profil Nolio ou de l'Instagram (canal Formulaire ou Instagram), au plus un contact sur cinq. Vérifie que le coach est bien dans la zone. Aucun doublon avec la liste d'exclusion.

Enregistre tes trouvailles avec l'outil enregistrer_coachs, par lots de 5 à 10, au fur et à mesure. Les notes donnent une phrase utile pour personnaliser le mail (outil utilisé, profil hybride course + muscu, tarifs) et signalent tout doute avec ⚠️. Quand tu as atteint le nombre demandé ou que la zone est épuisée, arrête-toi et termine par une phrase de bilan.`;

const CHAMPS_COACH = ['nom', 'structure', 'ville', 'zone', 'specialite', 'outil', 'canal', 'contact', 'instagram', 'notes', 'source'];
const OUTIL_ENREGISTRER = {
  name: 'enregistrer_coachs', strict: true,
  description: 'Ajoute des coachs trouvés au fichier de prospection du bureau. Renvoie combien ont été ajoutés et lesquels étaient des doublons.',
  input_schema: { type: 'object', additionalProperties: false, required: ['coachs'], properties: { coachs: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: CHAMPS_COACH,
    properties: {
      nom: { type: 'string', description: 'Prénom et nom du coach, ou nom du club' },
      structure: { type: 'string' }, ville: { type: 'string' },
      zone: { type: 'string', description: 'Une des zones du secteur' },
      specialite: { type: 'string' }, outil: { type: 'string', description: 'Outil de suivi utilisé, « ? » si inconnu' },
      canal: { type: 'string', enum: ['Email', 'Formulaire', 'Instagram'] },
      contact: { type: 'string', description: "L'email, ou l'URL du formulaire ou du profil" },
      instagram: { type: 'string', description: 'URL Instagram, ou vide' },
      notes: { type: 'string' }, source: { type: 'string', description: 'URL de la page où figure le contact' }
    } } } } }
};

function semaineIso(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), jour = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - jour);
  return { annee: t.getUTCFullYear(), numero: Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7) };
}
const cle = v => String(v || '').toLowerCase().trim().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

async function radar(ordre, avancer) {
  const espace = ordre.espace, secteur = ESPACES[espace].secteur;
  const voulu = Math.min(50, Number((ordre.consigne || '').match(/\b(\d{1,2})\b/)?.[1]) || 20);
  const { annee, numero } = semaineIso(), onglet = `S${numero} · ${secteur}`;
  const ajoutes = [], doublons = [];
  let bilan = '';
  // Par lots de 20 au plus, chacun avec une conversation neuve et la liste d'exclusion à jour.
  for (let lot = 0; ajoutes.length < voulu && lot < 4; lot++) {
    const existants = await Contact.find({}).select('nom contact').lean();
    const vus = new Set(existants.flatMap(c => [cle(c.contact), cle(c.nom)]).filter(Boolean));
    const cible = Math.min(20, voulu - ajoutes.length), avant = ajoutes.length;
    await avancer(ajoutes.length, voulu, 2, `Cherche des coachs (${secteur})`);
    bilan = await boucle({
      modele: MODELES.recherche, system: SYSTEME_RADAR, outils: [...web(25, 15), OUTIL_ENREGISTRER],
      contenu: `Secteur ${secteur}. Zones, dans l'ordre (passe à la suivante quand une zone ne donne plus de contacts avec email) :\n${ZONES[espace].map((z, i) => `${i + 1}. ${z}`).join('\n')}\n\nConsigne : ${ordre.consigne || 'aucune'}\nNombre de nouveaux coachs à trouver : ${cible}\n\nListe d'exclusion (déjà dans le fichier) :\n${existants.map(c => [c.nom, c.contact].filter(Boolean).join(' | ')).join('\n')}`,
      executer: async (nom, entree) => {
        if (nom !== 'enregistrer_coachs') throw new Error(`Outil inconnu : ${nom}`);
        const dernier = await Contact.findOne({ espace, onglet }).sort({ ligne: -1 }).select('ligne').lean();
        let ligne = dernier ? dernier.ligne : 1;
        const nouveaux = [];
        for (const c of entree.coachs || []) {
          const k = [cle(c.contact), cle(c.nom)].filter(Boolean);
          if (!c.nom || k.some(x => vus.has(x))) { doublons.push(c.nom); continue }
          k.forEach(x => vus.add(x));
          const email = /@/.test(c.contact);
          nouveaux.push({ ...Object.fromEntries(CHAMPS_COACH.map(f => [f, String(c[f] || '').trim()])), canal: email ? 'Email' : c.canal,
            espace, onglet, ligne: ++ligne, statut: 'À envoyer', semaine: `${annee}-S${numero}`, ajouteLe: new Date() });
        }
        if (nouveaux.length) await Contact.insertMany(nouveaux);
        ajoutes.push(...nouveaux.map(c => c.nom));
        await avancer(ajoutes.length, voulu, 4, `Ajoute des coachs (${ajoutes.length}/${voulu})`);
        return `${nouveaux.length} ajoutés (${ajoutes.length}/${voulu} au total).${doublons.length ? ` Doublons ignorés : ${doublons.slice(-10).join(', ')}.` : ''}`;
      }
    });
    if (ajoutes.length === avant) break;   // la zone ne donne plus rien
  }
  const emails = await Contact.countDocuments({ espace, onglet, nom: { $in: ajoutes }, canal: 'Email' });
  if (!ajoutes.length) throw visible(`Aucun nouveau coach trouvé. ${bilan}`.trim());
  return `${ajoutes.length} coachs ajoutés dans « ${onglet} », dont ${emails} avec un email. ${bilan}`.trim();
}

/* --- Allô : fiche d'appel --- */
const fiche = c => ['Nom', c.nom, 'Structure', c.structure, 'Ville', c.ville, 'Spécialité', c.specialite, 'Outil actuel', c.outil,
  'Contact', c.contact, 'Source', c.source, 'Notes', c.notes].reduce((t, v, i, a) => i % 2 ? t : t + (a[i + 1] ? `${v} : ${a[i + 1]}\n` : ''), '');

async function ficheAppel(ordre, avancer) {
  const contacts = await Contact.find({ _id: { $in: ordre.cibles.map(c => c.contactId) }, espace: ordre.espace }).limit(5).lean();
  if (!contacts.length) throw visible('Aucun contact à préparer.');
  const fiches = [];
  for (const [i, c] of contacts.entries()) {
    await avancer(i, contacts.length, 3, `Prépare l'appel avec ${c.nom}`);
    const texte = await boucle({
      system: `Tu prépares un appel de démo de Trainwise (app de suivi d'entraînement pour coachs d'endurance : planning, bibliothèque de séances, messagerie, synchro Strava, suivi muscu avec charges et séries, vue de la forme des athlètes). L'offre : -50 % pendant deux mois sur le plan Coach (jusqu'à 15 athlètes) avec le code FOULEE-DOREE-50, puis 29 €/mois sans engagement. Tu peux lire la page source du coach pour compléter. Rends une fiche courte en texte brut, sans markdown : qui il est (2 lignes), son outil actuel et ce qui lui manque probablement, ce que Trainwise lui apporte en plus (3 points), trois questions à poser, et l'offre. Français, phrases courtes, rien d'inventé.`,
      outils: web(0, 2), effort: 'low', maxTokens: 4000,
      contenu: `Coach :\n${fiche(c)}${ordre.consigne ? `\nContexte de l'appel : ${ordre.consigne}` : ''}`
    });
    fiches.push(`— ${c.nom} —\n${texte}`);
  }
  return fiches.join('\n\n');
}

/* --- Messager : messages prêts à coller --- */
async function messages(ordre, avancer) {
  const contacts = await Contact.find({ _id: { $in: ordre.cibles.map(c => c.contactId) }, espace: ordre.espace }).limit(15).lean();
  if (!contacts.length) throw visible('Aucun contact sélectionné.');
  await avancer(0, contacts.length, 3, `Rédige ${contacts.length} message${contacts.length > 1 ? 's' : ''}`);
  const e = ESPACES[ordre.espace];
  return boucle({
    system: `Tu rédiges des messages courts de prospection pour Trainwise, à coller dans un formulaire de contact ou en message Instagram. Trainwise : app de suivi d'entraînement pour coachs d'endurance (planning, séances, messagerie, Strava, suivi muscu et forme des athlètes), sortie sur l'App Store. Offre : -50 % pendant deux mois sur le plan Coach avec le code FOULEE-DOREE-50, puis 29 €/mois sans engagement. Propose 15 minutes de démo. Signe « ${e.prenom}, Trainwise » et donne ${e.email} et www.trainwise-app.com. 4 à 6 phrases, vouvoiement, une accroche personnalisée tirée des infos du coach, rien d'inventé. Pour chaque coach, rends un bloc en texte brut : « — Nom — », puis « Où : » suivi du lien à utiliser, puis le message.`,
    outils: [], effort: 'low', maxTokens: 8000,
    contenu: `${ordre.consigne ? `Consigne : ${ordre.consigne}\n\n` : ''}Coachs :\n\n${contacts.map(fiche).join('\n')}`
  });
}

/* --- Scribe : mettre les statuts à jour d'après un récit --- */
const OUTIL_MAJ = {
  name: 'mettre_a_jour', strict: true,
  description: 'Applique les changements de statut et les notes déduits du récit.',
  input_schema: { type: 'object', additionalProperties: false, required: ['maj', 'doute'], properties: {
    maj: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['numero', 'statut', 'note'], properties: {
      numero: { type: 'integer', description: 'Le numéro du coach dans la liste' },
      statut: { type: 'string', enum: STATUTS }, note: { type: 'string', description: 'Note courte et factuelle, vide si rien à ajouter' }
    } } },
    doute: { type: 'string', description: 'Coachs cités introuvables ou ambigus, en une phrase ; vide sinon' }
  } }
};
const jourFr = () => new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' });

async function scribe(ordre, avancer) {
  const contacts = await Contact.find({ espace: ordre.espace }).sort({ onglet: 1, ligne: 1 }).lean();
  await avancer(0, 1, 2, 'Retrouve les coachs du récit');
  const faits = [];
  let doute = '';
  await boucle({
    system: `Tu tiens à jour un fichier de prospection de coachs sportifs. Statuts, dans l'ordre du parcours : ${STATUTS.join(', ')}. « Envoyé » = premier message parti (email, formulaire ou Instagram) ; « Relancé » = relance partie ; « Répondu » = le coach a répondu sans suite décidée ; « Démo prévue » = appel ou démo calé ; « Inscrit » = a créé son compte ; « Pas intéressé » ou « Non » = refus ; « Injoignable » = adresse invalide. Le titulaire raconte ce qu'il a fait : retrouve chaque coach cité (noms approximatifs, sans accent, prénom seul ou structure), déduis le nouveau statut et une note courte et factuelle (date de démo, objection, outil, nombre d'athlètes). Si le statut ne change pas, remets le statut actuel. N'invente rien. Appelle une fois l'outil mettre_a_jour, puis termine.`,
    outils: [OUTIL_MAJ], effort: 'medium', maxTokens: 4000,
    contenu: `Coachs (numéro | nom | structure | ville | statut actuel) :\n${contacts.map((c, i) => `${i} | ${c.nom} | ${c.structure || ''} | ${c.ville || ''} | ${c.statut}`).join('\n')}\n\nRécit de ${ESPACES[ordre.espace].prenom} :\n<<<\n${ordre.consigne}\n>>>`,
    executer: async (nom, entree) => {
      if (nom !== 'mettre_a_jour') throw new Error(`Outil inconnu : ${nom}`);
      doute = entree.doute || '';
      for (const m of entree.maj || []) {
        const c = contacts[m.numero];
        if (!c) continue;
        const set = {};
        if (m.statut && m.statut !== c.statut) set.statut = m.statut;
        if (m.statut === 'Envoyé' && !c.envoyeLe) set.envoyeLe = new Date();
        if (m.note) set.notes = (c.notes ? `${c.notes} · ` : '') + `${jourFr()} : ${m.note}`;
        if (!Object.keys(set).length) continue;
        await Contact.updateOne({ _id: c._id }, set);
        faits.push(`${c.nom}${set.statut ? ` → ${set.statut}` : ' : note ajoutée'}`);
      }
      return `${faits.length} coach(s) mis à jour.`;
    }
  });
  if (!faits.length) throw visible(`Aucun coach mis à jour. ${doute}`.trim());
  return `${faits.join(' ; ')}.${doute ? ` ⚠️ ${doute}` : ''}`;
}

module.exports = { configure, radar, ficheAppel, messages, scribe, depenseDuMois, PLAFOND, semaineIso, ESPACES_ZONES: ZONES };
