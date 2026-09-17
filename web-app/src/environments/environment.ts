// Développement uniquement — remplacé par environment.prod.ts / .staging.ts au build.
// URLs vides = même origine que `ng serve`, qui relaie /api et /socket.io vers le
// backend (proxy.conf.json). On échappe ainsi à la liste CORS de l'API, qui ne
// connaît que le port 4200 : le front tourne désormais sur n'importe quel port.
export const environment = {
  production: false,
  apiUrl: '',
  socketUrl: '',
  revenueCatAppleApiKey: 'appl_JLaKtBAiYzdaNfDEFQwTFKEMlzI',
  revenueCatGoogleApiKey: 'goog_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  mapboxToken: ''
};
