// Gestion de l'abonnement webhook Strava (une seule subscription par application).
//
// Usage :
//   npm run strava:webhook view     afficher l'abonnement actuel
//   npm run strava:webhook create   créer l'abonnement
//   npm run strava:webhook delete   supprimer l'abonnement
//
// Variables d'env requises : STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET,
// STRAVA_WEBHOOK_VERIFY_TOKEN, et BACKEND_URL (publique, en https) pour `create`.
// Pour `create`, le backend doit déjà être déployé avec la route
// GET /api/strava/webhook et le même STRAVA_WEBHOOK_VERIFY_TOKEN : Strava
// appelle cette route immédiatement pour valider l'abonnement.
require('dotenv').config({ quiet: true });
const axios = require('axios');

const SUBSCRIPTIONS_URL = 'https://www.strava.com/api/v3/push_subscriptions';

const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
const backendUrl = process.env.BACKEND_URL;

const command = process.argv[2];

const say = (line = '') => process.stdout.write(`${line}\n`);
const fail = (line) => process.stderr.write(`${line}\n`);

async function view() {
  const { data } = await axios.get(SUBSCRIPTIONS_URL, {
    params: { client_id: clientId, client_secret: clientSecret }
  });

  if (data.length === 0) {
    say('Aucun abonnement actif : Strava n\'envoie rien à Trainwise.');
    say('Lancer « npm run strava:webhook create » pour le créer.');
    return data;
  }

  // Le cas le plus courant après un changement d'hébergement : l'abonnement
  // existe toujours, mais il appelle l'ancienne URL.
  const expected = backendUrl ? `${backendUrl}/api/strava/webhook` : null;
  for (const sub of data) {
    say(`Abonnement ${sub.id} : ${sub.callback_url}`);
    if (!expected) {
      say('BACKEND_URL absent : impossible de vérifier que cette URL est la bonne.');
    } else if (sub.callback_url === expected) {
      say('URL conforme, la synchronisation automatique est en place.');
    } else {
      say(`URL attendue : ${expected}`);
      say('Lancer « npm run strava:webhook delete » puis « create ».');
    }
  }
  return data;
}

async function create() {
  if (!verifyToken) throw new Error('STRAVA_WEBHOOK_VERIFY_TOKEN manquant.');
  if (!backendUrl || !backendUrl.startsWith('https://')) {
    throw new Error(`BACKEND_URL doit être une URL publique en https (valeur actuelle : ${backendUrl || 'absente'}).`);
  }

  const callbackUrl = `${backendUrl}/api/strava/webhook`;
  say(`Création de l'abonnement vers ${callbackUrl}`);

  const { data } = await axios.post(SUBSCRIPTIONS_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    callback_url: callbackUrl,
    verify_token: verifyToken
  });

  say(`Abonnement ${data.id} créé.`);
}

async function remove() {
  const subs = await view();
  for (const sub of subs) {
    await axios.delete(`${SUBSCRIPTIONS_URL}/${sub.id}`, {
      params: { client_id: clientId, client_secret: clientSecret }
    });
    say(`Abonnement ${sub.id} supprimé.`);
  }
}

(async () => {
  if (!clientId || !clientSecret) throw new Error('STRAVA_CLIENT_ID et STRAVA_CLIENT_SECRET sont requis.');

  if (command === 'view') await view();
  else if (command === 'create') await create();
  else if (command === 'delete') await remove();
  else {
    say('Usage : npm run strava:webhook <view|create|delete>');
    process.exitCode = 1;
  }
})().catch(e => {
  const detail = e.response?.data;
  // Strava détaille le refus dans `errors` (ressource, champ, code) : c'est là
  // qu'on lit « callback url / GET to callback URL does not return 200 ».
  const details = (detail?.errors ?? []).map(error => [error.resource, error.field, error.code].filter(Boolean).join(' '));
  fail(`Échec : ${details.join(', ') || detail?.message || e.message}`);
  process.exitCode = 1;
});
