import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://trainwise-backend-rnd4.onrender.com').replace(/\/$/, '');

const TOKEN_KEY = 'trainwise.token';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Jeton de session : trousseau iOS / Keystore Android, localStorage sur le web.
const webStorage = () => (typeof localStorage === 'undefined' ? null : localStorage);

export const tokenStorage = {
  async get() {
    if (Platform.OS === 'web') return webStorage()?.getItem(TOKEN_KEY) ?? null;
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async set(token: string) {
    if (Platform.OS === 'web') webStorage()?.setItem(TOKEN_KEY, token);
    else await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  async clear() {
    if (Platform.OS === 'web') webStorage()?.removeItem(TOKEN_KEY);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

/** Appelé quand l'API rejette le jeton courant (expiré ou invalide). */
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Jeton explicite (ex. appel de déconnexion) : un 401 ne déclenche alors pas la déconnexion globale. */
  token?: string;
};

export async function api<T>(path: string, { method = 'GET', body, query, token: explicitToken }: RequestOptions = {}): Promise<T> {
  const token = explicitToken ?? authToken;
  const search = query
    ? Object.entries(query)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&')
    : '';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}${search ? `?${search}` : ''}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Impossible de joindre le serveur. Vérifie ta connexion.');
  }

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 && !explicitToken && authToken) unauthorizedHandler?.();
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : `Erreur ${response.status}`;
    throw new ApiError(response.status, message);
  }
  return data as T;
}

// Petit cache mémoire pour les lectures partagées entre écrans (liste des sorties, coach…).
const responseCache = new Map<string, { at: number; promise: Promise<unknown> }>();

export function cachedGet<T>(path: string, ttlMs = 30_000): Promise<T> {
  const hit = responseCache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise as Promise<T>;
  const promise = api<T>(path);
  responseCache.set(path, { at: Date.now(), promise });
  promise.catch(() => responseCache.delete(path));
  return promise;
}

export const invalidateApiCache = (path?: string) => (path ? responseCache.delete(path) : responseCache.clear());
