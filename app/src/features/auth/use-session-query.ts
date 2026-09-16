import type { ApiUser } from '@/lib/api-types';
import { useQuery, type QueryResult } from '@/lib/use-query';

import { useSession } from './session';

const noop = () => {};

/**
 * Requête liée au compte connecté (clé préfixée par l'utilisateur).
 * En mode démo, `demo` fournit les données d'exemple à la place de l'API.
 */
export function useSessionQuery<T>(key: string, fetcher: (user: ApiUser) => Promise<T>, demo: () => T | undefined): QueryResult<T> {
  const { status, user } = useSession();
  const query = useQuery(`${user?.id ?? 'anonyme'}:${key}`, () => fetcher(user as ApiUser), { enabled: status === 'signedIn' && user !== null });
  if (status === 'demo') return { data: demo(), loading: false, error: null, refetch: noop };
  return query;
}
