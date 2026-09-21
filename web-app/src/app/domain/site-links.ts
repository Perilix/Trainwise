/**
 * Les pages publiques du site, telles que les profils y renvoient.
 *
 * Avec le `www` : le domaine nu redirige vers lui, autant éviter le détour.
 * Les mêmes adresses que l'application mobile (app/src/lib/site.ts).
 */
const SITE = 'https://www.trainwise-app.com';

export const SITE_LINKS = [
  { label: 'À propos de Trainwise', icon: 'info', href: `${SITE}/a-propos` },
  { label: 'Support et questions fréquentes', icon: 'help', href: `${SITE}/support` },
  { label: 'Politique de confidentialité', icon: 'shield', href: `${SITE}/confidentialite` },
  { label: 'Nous contacter', icon: 'mail', href: `${SITE}/contact` },
] as const;
