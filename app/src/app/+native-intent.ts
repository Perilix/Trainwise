// Liens par lesquels le système rouvre l'app sans qu'un écran leur corresponde :
// retour de la connexion Google (`<bundle>:/oauthredirect`) et de l'autorisation Strava (`trainwise://strava`).
// La session d'authentification les lit de son côté ; le routeur, lui, ne doit pas chercher d'écran.
const SYSTEM_RETURNS = /(^|\/)(oauthredirect|strava)(\?|#|$)/;

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return SYSTEM_RETURNS.test(path) ? '/' : path;
  } catch {
    return '/';
  }
}
