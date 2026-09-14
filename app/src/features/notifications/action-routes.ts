import type { Href } from 'expo-router';

// Les liens des notifications (actionUrl) pointent vers les routes du web : on les traduit vers l'app.
export function routeForActionUrl(actionUrl?: string): Href | null {
  if (!actionUrl) return null;
  if (actionUrl.startsWith('/chat')) return '/coach';
  if (actionUrl.startsWith('/planning')) return '/planning';
  if (actionUrl.startsWith('/sorties')) return '/sorties';
  const run = actionUrl.match(/^\/run\/([^/?#]+)/);
  return run ? { pathname: '/sortie/[id]', params: { id: run[1] } } : null;
}
