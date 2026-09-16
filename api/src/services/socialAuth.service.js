// Vérification des jetons d'identité Google et Apple (connexion sociale).
//
// Les deux fournisseurs signent un JWT avec une clé publique publiée en JWKS.
// On vérifie la signature localement (pas d'appel réseau à chaque connexion :
// les clés sont mises en cache une heure) puis l'émetteur et l'audience.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const APPLE_JWKS = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map(); // url → { keys, fetchedAt }

const fetchKeys = async (url, { force = false } = {}) => {
  const cached = cache.get(url);
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.keys;

  const { data } = await axios.get(url, { timeout: 8000 });
  const keys = data.keys || [];
  cache.set(url, { keys, fetchedAt: Date.now() });
  return keys;
};

// Une clé peut avoir tourné depuis la mise en cache : on retente une fois sans cache.
const publicKeyFor = async (url, kid) => {
  for (const force of [false, true]) {
    const keys = await fetchKeys(url, { force });
    const jwk = keys.find((key) => key.kid === kid);
    if (jwk) return crypto.createPublicKey({ key: jwk, format: 'jwk' });
    if (force) break;
  }
  throw new Error('Clé de signature introuvable');
};

const verify = async ({ token, jwksUrl, issuers, audiences }) => {
  if (!token) throw new Error('Jeton manquant');
  if (!audiences.length) throw new Error('Audience non configurée côté serveur');

  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header?.kid) throw new Error('Jeton illisible');

  const key = await publicKeyFor(jwksUrl, decoded.header.kid);
  return jwt.verify(token, key, { algorithms: ['RS256'], issuer: issuers, audience: audiences });
};

const listEnv = (value) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/** Vérifie un id_token Google et renvoie { providerId, email, firstName, lastName, picture }. */
exports.verifyGoogleToken = async (idToken) => {
  const payload = await verify({
    token: idToken,
    jwksUrl: GOOGLE_JWKS,
    issuers: GOOGLE_ISSUERS,
    audiences: listEnv(process.env.GOOGLE_CLIENT_IDS)
  });

  if (payload.email_verified === false) throw new Error('Adresse Google non vérifiée');

  return {
    providerId: payload.sub,
    email: payload.email,
    firstName: payload.given_name,
    lastName: payload.family_name,
    picture: payload.picture
  };
};

/** Vérifie un identityToken Apple. Le nom n'est transmis qu'à la première connexion, côté app. */
exports.verifyAppleToken = async (identityToken) => {
  const payload = await verify({
    token: identityToken,
    jwksUrl: APPLE_JWKS,
    issuers: [APPLE_ISSUER],
    audiences: listEnv(process.env.APPLE_CLIENT_IDS)
  });

  return {
    providerId: payload.sub,
    email: payload.email,
    // `true` quand Apple relaie vers une adresse privée : on ne s'en sert que pour l'affichage.
    isPrivateEmail: payload.is_private_email === 'true' || payload.is_private_email === true
  };
};
