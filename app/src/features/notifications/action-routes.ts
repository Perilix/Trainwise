import type { Href } from 'expo-router';

// Les liens des notifications (actionUrl) pointent vers les routes du web : on les traduit vers l'app.
export function routeForActionUrl(actionUrl: string | undefined, coach = false): Href | null {
  if (!actionUrl) return null;

  if (coach) {
    const athlete = actionUrl.match(/^\/coach\/athletes\/([^/?#]+)/);
    if (athlete) return { pathname: '/pro/athletes/[id]', params: { id: athlete[1] } };
    if (actionUrl.startsWith('/chat')) return '/pro/messages';
    if (actionUrl.startsWith('/profile')) return '/pro/profil';
    if (actionUrl.startsWith('/coach')) return '/pro';
    return null;
  }

  if (actionUrl.startsWith('/chat')) return '/coach';
  if (actionUrl.startsWith('/profile')) return '/profil';
  if (actionUrl.startsWith('/planning')) return '/planning';
  if (actionUrl.startsWith('/sorties')) return '/sorties';
  const run = actionUrl.match(/^\/run\/([^/?#]+)/);
  return run ? { pathname: '/sortie/[id]', params: { id: run[1] } } : null;
}
