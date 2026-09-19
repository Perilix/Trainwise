import { DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

import { ApiError } from './api.service';
import { RefreshService } from './refresh.service';

export type Loaded<T> = {
  data: ReturnType<typeof signal<T | null>>;
  loading: ReturnType<typeof signal<boolean>>;
  error: ReturnType<typeof signal<string>>;
  /** Relance la requête ; `silent` garde les données à l'écran pendant le rechargement. */
  reload: (silent?: boolean) => void;
  set: (value: T) => void;
};

/**
 * Petit chargeur de données pour un écran : trois signaux (données, chargement, erreur)
 * et un `reload`. L'abonnement se coupe avec le composant.
 */
export function load<T>(factory: () => Observable<T>): Loaded<T> {
  const destroyRef = inject(DestroyRef);
  const refresh = inject(RefreshService);
  const data = signal<T | null>(null);
  const loading = signal(true);
  const error = signal('');
  let subscription: Subscription | null = null;

  const reload = (silent = false) => {
    subscription?.unsubscribe();
    if (!silent) loading.set(true);
    error.set('');
    subscription = factory().subscribe({
      next: (value) => {
        data.set(value);
        loading.set(false);
      },
      error: (err: unknown) => {
        loading.set(false);
        error.set(err instanceof ApiError ? err.message : 'Chargement impossible.');
      },
    });
  };

  destroyRef.onDestroy(() => subscription?.unsubscribe());

  // Premier chargement déclenché après la construction du composant : les entrées
  // d'un écran routé (`input.required`, liées par withComponentInputBinding) ne
  // sont posées qu'ensuite, et les lire ici lèverait NG0950 — l'écran ne
  // s'affichait alors pas du tout. La seule dépendance suivie est le battement
  // global : le reste du rechargement reste explicite.
  effect(() => {
    const beat = refresh.tick();
    untracked(() => reload(beat > 0));
  });

  return { data, loading, error, reload, set: (value: T) => data.set(value) };
}
