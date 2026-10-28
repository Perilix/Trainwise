const crypto = require('crypto');
const axios = require('axios');
const { Boite } = require('../models/prospection');

// Client Zoho Mail d'un bureau. Chaque titulaire connecte sa propre boîte (OAuth, « Server-based Application »
// créée dans la console API Zoho) : le serveur ne garde que le jeton de rafraîchissement, chiffré.

const SCOPES = 'ZohoMail.messages.ALL,ZohoMail.accounts.READ,ZohoMail.folders.READ';
// Seuls les serveurs de comptes Zoho sont acceptés pour l'échange du code (le paramètre vient de l'URL de retour).
const SERVEURS = /^https:\/\/accounts\.zoho\.(eu|com|in|com\.au|jp|ca|sa)$/;

const configure = () => !!(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET);
const accountsDefaut = () => process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.eu';

// Chiffrement du jeton : AES-256-GCM, clé dérivée de SESSION_SECRET.
const cle = () => crypto.scryptSync(process.env.SESSION_SECRET || 'admin-secret-change-me', 'bureau-zoho', 32);
function chiffrer(texte) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', cle(), iv);
  const donnees = Buffer.concat([c.update(texte, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), donnees].map(b => b.toString('base64')).join('.');
}
function dechiffrer(paquet) {
  const [iv, tag, donnees] = paquet.split('.').map(s => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', cle(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(donnees), d.final()]).toString('utf8');
}

function urlAutorisation(redirectUri, state) {
  const q = new URLSearchParams({ scope: SCOPES, client_id: process.env.ZOHO_CLIENT_ID, response_type: 'code',
    access_type: 'offline', prompt: 'consent', redirect_uri: redirectUri, state });
  return `${accountsDefaut()}/oauth/v2/auth?${q}`;
}

// Code reçu au retour de Zoho → jeton, puis compte Zoho correspondant à l'adresse attendue du bureau.
async function connecter({ code, accountsServer, redirectUri, espace, emailAttendu }) {
  const serveur = SERVEURS.test(accountsServer || '') ? accountsServer : accountsDefaut();
  const { data: jeton } = await axios.post(`${serveur}/oauth/v2/token`, new URLSearchParams({
    code, grant_type: 'authorization_code', client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET, redirect_uri: redirectUri
  }));
  if (!jeton.refresh_token) throw new Error(jeton.error || 'Zoho n\'a pas renvoyé de jeton de rafraîchissement');
  const mailApi = serveur.replace('accounts.', 'mail.');
  const { data } = await axios.get(`${mailApi}/api/accounts`, { headers: { Authorization: `Zoho-oauthtoken ${jeton.access_token}` } });
  const compte = (data.data || []).find(a => (a.primaryEmailAddress || '').toLowerCase() === emailAttendu);
  if (!compte) {
    const vu = (data.data || []).map(a => a.primaryEmailAddress).join(', ') || 'aucun compte';
    throw Object.assign(new Error(`Tu es connecté à Zoho avec ${vu}. Il faut te connecter avec ${emailAttendu}.`), { visible: true });
  }
  await Boite.findOneAndUpdate({ espace }, {
    espace, email: emailAttendu, accountId: String(compte.accountId), accountsServer: serveur, mailApi,
    refreshToken: chiffrer(jeton.refresh_token), dossiers: {}, connecteeLe: new Date(), dernierReleve: new Date()
  }, { upsert: true });
  caches.delete(espace);
}

// Jetons d'accès en mémoire (valables une heure).
const caches = new Map();
async function jeton(boite) {
  const c = caches.get(boite.espace);
  if (c && c.expire > Date.now() + 60000) return c.token;
  const { data } = await axios.post(`${boite.accountsServer}/oauth/v2/token`, new URLSearchParams({
    refresh_token: dechiffrer(boite.refreshToken), grant_type: 'refresh_token',
    client_id: process.env.ZOHO_CLIENT_ID, client_secret: process.env.ZOHO_CLIENT_SECRET
  }));
  if (!data.access_token) throw new Error(`Zoho refuse le jeton (${data.error || 'inconnu'}) : reconnecte la boîte ${boite.email}.`);
  caches.set(boite.espace, { token: data.access_token, expire: Date.now() + (data.expires_in || 3600) * 1000 });
  return data.access_token;
}

async function api(boite, method, chemin, { params, body } = {}) {
  const { data } = await axios({ method, url: `${boite.mailApi}/api/accounts/${boite.accountId}${chemin}`, params, data: body,
    headers: { Authorization: `Zoho-oauthtoken ${await jeton(boite)}` } });
  return data.data;
}

// Dossiers Boîte de réception, Envoyés et Boîte d'envoi (mails programmés), mémorisés sur la boîte.
async function dossiers(boite) {
  if (boite.dossiers?.inbox && boite.dossiers?.sent && boite.dossiers?.outbox) return boite.dossiers;
  const liste = await api(boite, 'get', '/folders');
  const trouve = type => String((liste.find(f => f.folderType === type) || {}).folderId || '');
  boite.dossiers = { inbox: trouve('Inbox'), sent: trouve('Sent'), outbox: trouve('Outbox') };
  await Boite.updateOne({ _id: boite._id }, { dossiers: boite.dossiers });
  return boite.dossiers;
}

module.exports = { configure, urlAutorisation, connecter, api, dossiers };
