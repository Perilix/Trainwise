export const environment = {
  production: false,
  /** Vide en dev : les appels passent par le proxy Angular (proxy.conf.json). */
  apiUrl: '',
  /** Back-office : il reçoit les demandes de démo de la page /demo (base de prospection). */
  adminUrl: 'http://localhost:4000',
  /** Identifiant client OAuth « Web » du projet Google (même projet que l'app mobile). */
  googleClientId: '1002254054572-jsf91rqbs3l57v3icof18gnrran0dsfd.apps.googleusercontent.com',
};
