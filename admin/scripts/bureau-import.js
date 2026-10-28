/**
 * Importe les onglets de semaine du Sheet « Prospection Trainwise – Coachs » dans la base de prospection.
 * Entrée : un JSON { "S42": [[en-têtes…], [ligne…], …], "S45 · Alsace": [...] } (export du Sheet, hors dépôt :
 * ce sont des données personnelles). Relançable : un contact déjà importé (même onglet + ligne) est mis à jour.
 * Usage : PROSPECTION_MONGODB_URI=... node scripts/bureau-import.js chemin/export.json
 */

require('dotenv').config({ quiet: true });
const fs = require('fs');
const { conn } = require('../src/config/prospectionDb');
const { Contact, STATUTS } = require('../src/models/prospection');

const fichier = process.argv[2];
if (!fichier) {
  process.stderr.write('Usage : node scripts/bureau-import.js chemin/export.json\n');
  process.exit(1);
}

const COLONNES = {
  'Statut': 'statut', 'Nom': 'nom', 'Structure': 'structure', 'Ville': 'ville', 'Zone': 'zone',
  'Spécialité': 'specialite', 'Outil actuel': 'outil', 'Canal': 'canal', 'Contact': 'contact',
  'Instagram': 'instagram', 'Envoyé le': 'envoyeLe', 'Relance le': 'relanceLe', 'Notes': 'notes',
  'Source': 'source', 'Semaine': 'semaine', 'Ajouté le': 'ajouteLe'
};
const DATES = ['envoyeLe', 'relanceLe', 'ajouteLe'];

// « 16/10/2026 » → midi heure de Paris, pour ne pas glisser d'un jour selon le fuseau.
function date(v) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v || '').trim());
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 11)) : undefined;
}

(async () => {
  const onglets = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  let total = 0;
  for (const [onglet, valeurs] of Object.entries(onglets)) {
    if (!/^S\d+/.test(onglet) || !valeurs?.length) continue;
    const espace = /Alsace/i.test(onglet) ? 'hugo' : 'julien';
    const tete = valeurs[0].map(h => String(h || '').trim());
    const ops = [];
    valeurs.slice(1).forEach((ligne, i) => {
      const c = { espace, onglet, ligne: i + 2 };
      tete.forEach((h, k) => {
        // La colonne A est toujours le statut, même quand son en-tête a été écrasé (c'est arrivé sur S42).
        const champ = k === 0 ? 'statut' : COLONNES[h]; if (!champ) return;
        const v = ligne[k];
        c[champ] = DATES.includes(champ) ? date(v) : (v === undefined ? undefined : String(v).trim());
      });
      if (!c.nom) return;
      if (!STATUTS.includes(c.statut)) c.statut = 'À envoyer';
      ops.push({ updateOne: { filter: { espace, onglet, ligne: c.ligne }, update: { $set: c }, upsert: true } });
    });
    if (ops.length) await Contact.bulkWrite(ops);
    process.stdout.write(`${onglet} → bureau ${espace} : ${ops.length} contacts\n`);
    total += ops.length;
  }
  process.stdout.write(`Import terminé : ${total} contacts.\n`);
  await conn.close();
})().catch(async err => {
  process.stderr.write(`Erreur : ${err.message}\n`);
  await conn.close();
  process.exit(1);
});
