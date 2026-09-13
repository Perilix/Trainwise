// Gestion de l'abonnement webhook Strava (une seule subscription par application).
//
// Usage :
//   node src/scripts/stravaWebhook.js view     → afficher l'abonnement actuel
//   node src/scripts/stravaWebhook.js create   → créer l'abonnement
//   node src/scripts/stravaWebhook.js delete   → supprimer l'abonnement
//
// Variables d'env requises : STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET,
// STRAVA_WEBHOOK_VERIFY_TOKEN, et BACKEND_URL (publique, en https) pour `create`.
// ⚠️ Pour `create`, le backend doit déjà être déployé avec la route
// GET /api/strava/webhook et le même STRAVA_WEBHOOK_VERIFY_TOKEN : Strava
// appelle cette route immédiatement pour valider l'abonnement.
require('dotenv').config();
const axios = require('axios');

const SUBSCRIPTIONS_URL = 'https://www.strava.com/api/v3/push_subscriptions';

const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
const backendUrl = process.env.BACKEND_URL;

const command = process.argv[2];

async function view() {
  const { data } = await axios.get(SUBSCRIPTIONS_URL, {
    params: { client_id: clientId, client_secret: clientSecret }
  });
  if (data.length === 0) {
    console.log('Aucun abonnement webhook actif.');
  } else {
    console.log('Abonnement actif :', JSON.stringify(data, null, 2));
  }
  return data;
}

async function create() {
  if (!verifyToken) throw new Error('STRAVA_WEBHOOK_VERIFY_TOKEN manquant');
  if (!backendUrl || !backendUrl.startsWith('https://')) {
    throw new Error(`BACKEND_URL doit être une URL publique en https (actuel: ${backendUrl})`);
  }

  const callbackUrl = `${backendUrl}/api/strava/webhook`;
  console.log(`Création de l'abonnement → ${callbackUrl}`);

  const { data } = await axios.post(SUBSCRIPTIONS_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    callback_url: callbackUrl,
    verify_token: verifyToken
  });

  console.log('✅ Abonnement créé :', JSON.stringify(data, null, 2));
}

async function remove() {
  const subs = await view();
  for (const sub of subs) {
    await axios.delete(`${SUBSCRIPTIONS_URL}/${sub.id}`, {
      params: { client_id: clientId, client_secret: clientSecret }
    });
    console.log(`✅ Abonnement ${sub.id} supprimé`);
  }
}

(async () => {
  if (!clientId || !clientSecret) throw new Error('STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET manquants');

  if (command === 'view') await view();
  else if (command === 'create') await create();
  else if (command === 'delete') await remove();
  else {
    console.log('Usage: node src/scripts/stravaWebhook.js <view|create|delete>');
    process.exitCode = 1;
  }
})().catch(e => {
  console.error('Erreur :', e.response?.data || e.message);
  process.exitCode = 1;
});
