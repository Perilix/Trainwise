import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, throwError, timer } from 'rxjs';

import { environment } from '../../environments/environment';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl.replace(/\/$/, '');

  /** Cache mémoire court, pour les lectures partagées entre plusieurs blocs d'un même écran. */
  private readonly cache = new Map<string, { at: number; value$: Observable<unknown> }>();

  get<T>(path: string, query?: Query): Observable<T> {
    return this.http.get<T>(this.base + path, { params: toParams(query) }).pipe(catchError(toApiError));
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<T>(this.base + path, body ?? {}).pipe(catchError(toApiError));
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http.put<T>(this.base + path, body ?? {}).pipe(catchError(toApiError));
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http.patch<T>(this.base + path, body ?? {}).pipe(catchError(toApiError));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.base + path).pipe(catchError(toApiError));
  }

  /** GET partagé : un seul appel réseau tant que le TTL n'est pas écoulé. */
  cachedGet<T>(path: string, ttlMs = 30_000): Observable<T> {
    const hit = this.cache.get(path);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value$ as Observable<T>;
    const value$ = this.get<T>(path).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.cache.set(path, { at: Date.now(), value$ });
    value$.subscribe({ error: () => this.cache.delete(path) });
    return value$;
  }

  /** GET qui renvoie une valeur de repli plutôt qu'une erreur (ressource optionnelle : coach, Strava…). */
  getOr<T>(path: string, fallback: T, query?: Query): Observable<T> {
    return this.get<T>(path, query).pipe(catchError(() => of(fallback)));
  }

  invalidate(prefix?: string) {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    for (const key of [...this.cache.keys()]) if (key.startsWith(prefix)) this.cache.delete(key);
  }
}

function toParams(query?: Query): HttpParams {
  let params = new HttpParams();
  if (!query) return params;
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params = params.set(key, String(value));
  }
  return params;
}

function toApiError(error: unknown) {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { error?: string; message?: string } | null;
    const message =
      error.status === 0
        ? 'Impossible de joindre le serveur. Vérifie ta connexion.'
        : body?.error || body?.message || `Erreur ${error.status}`;
    return throwError(() => new ApiError(error.status, message));
  }
  return throwError(() => new ApiError(0, 'Erreur inattendue'));
}

/** Petit utilitaire de debounce pour les recherches. */
export const debounceInput = (ms = 250) => timer(ms).pipe(map(() => undefined));
