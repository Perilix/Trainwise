import { useCallback, useEffect, useState } from 'react';

export type QueryResult<T> = {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

// Dernière valeur connue par clé : un écran revisité s'affiche tout de suite puis se rafraîchit.
const lastValues = new Map<string, unknown>();

export const clearQueryCache = () => lastValues.clear();

// `request` identifie la requête terminée (clé + numéro de rafraîchissement) : le chargement s'en déduit.
type State<T> = { key: string; request: string | null; data: T | undefined; error: string | null };

export function useQuery<T>(key: string, fetcher: () => Promise<T>, { enabled = true } = {}): QueryResult<T> {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<State<T>>(() => ({ key, request: null, data: lastValues.get(key) as T | undefined, error: null }));
  const request = `${key}#${version}`;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (cancelled) return;
        lastValues.set(key, data);
        setState({ key, request, data, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Erreur inattendue';
        setState((current) => ({ key, request, data: current.key === key ? current.data : undefined, error: message }));
      });
    return () => {
      cancelled = true;
    };
    // La clé identifie la requête : le fetcher change à chaque rendu sans changer de sens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, enabled]);

  const refetch = useCallback(() => setVersion((value) => value + 1), []);
  const cached = lastValues.get(key) as T | undefined;

  return {
    data: state.key === key ? (state.data ?? cached) : cached,
    loading: enabled && state.request !== request,
    error: state.request === request ? state.error : null,
    refetch,
  };
}
