import { Linking } from 'react-native';

/**
 * Le site public : les pages qui se lisent sans compte.
 *
 * Avec le `www` : le domaine nu redirige vers lui, autant éviter le détour.
 */
const SITE = 'https://www.trainwise-app.com';

export const SITE_LINKS = {
  about: `${SITE}/a-propos`,
  support: `${SITE}/support`,
  privacy: `${SITE}/confidentialite`,
  contact: `${SITE}/contact`,
} as const;

/** L'adresse à laquelle on nous écrit, la même que sur le site. */
export const CONTACT_EMAIL = 'contact@trainwise-app.com';

/** Ouvre une adresse hors de l'app, sans casser si aucune application ne la gère. */
export const openLink = (url: string) => {
  void Linking.openURL(url).catch(() => undefined);
};
