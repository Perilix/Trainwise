import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, getAuthToken, invalidateApiCache, onUnauthorized, setAuthToken, tokenStorage } from '@/lib/api';
import type { ApiUser, AuthResponse } from '@/lib/api-types';
import { clearQueryCache } from '@/lib/use-query';

const USER_KEY = 'trainwise.user';

/** Mode démo (données d'exemple, sans compte) : développement uniquement ou build explicite. */
export const DEMO_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_DEMO === '1';

export type DemoRole = 'athlete' | 'coach';

const DEMO_USERS: Record<DemoRole, ApiUser> = {
  athlete: { id: 'demo', email: 'thomas.dubois@example.com', firstName: 'Thomas', lastName: 'Dubois', role: 'user', vma: 16.5 },
  coach: {
    id: 'demo-coach',
    email: 'camille.roux@example.com',
    firstName: 'Camille',
    lastName: 'Roux',
    role: 'coach',
    disciplines: ['running', 'marathon', 'trail'],
    diplomas: ['bpjeps', 'ffa'],
    experience: 8,
    bio: 'Coach running depuis 2018, spécialisée marathon et trail. J’accompagne des coureurs de tous niveaux vers leurs objectifs.',
  },
};

/** Un compte coach ouvre l'espace coach ; tout autre rôle, l'espace athlète. */
export const isCoach = (user: ApiUser | null) => user?.role === 'coach';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn' | 'demo';

export type SignUpInput = { firstName: string; lastName: string; email: string; password: string };

type SessionValue = {
  status: SessionStatus;
  user: ApiUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  enterDemo: (role?: DemoRole) => void;
  /** Remplace le profil en mémoire (après une modification du profil). */
  updateUser: (user: ApiUser) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: SessionStatus; user: ApiUser | null }>({ status: 'loading', user: null });

  // `unregisterPush` : l'appareil ne doit plus recevoir les notifications du compte (inutile si le jeton est déjà rejeté).
  const endSession = useCallback(async (unregisterPush: boolean) => {
    const token = getAuthToken();
    setAuthToken(null);
    invalidateApiCache();
    clearQueryCache();
    setState({ status: 'signedOut', user: null });
    if (unregisterPush && token) api('/api/users/push-token', { method: 'DELETE', token }).catch(() => undefined);
    await Promise.all([tokenStorage.clear(), AsyncStorage.removeItem(USER_KEY)]);
  }, []);

  const signOut = useCallback(() => endSession(true), [endSession]);

  useEffect(() => onUnauthorized(() => void endSession(false)), [endSession]);

  // Reprise de session : jeton stocké, puis profil rafraîchi (profil en cache si hors ligne).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await tokenStorage.get().catch(() => null);
      if (!token) {
        if (!cancelled) setState({ status: 'signedOut', user: null });
        return;
      }
      setAuthToken(token);
      const cached = await AsyncStorage.getItem(USER_KEY)
        .then((value) => (value ? (JSON.parse(value) as ApiUser) : null))
        .catch(() => null);
      try {
        const user = await api<ApiUser>('/api/auth/me');
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
        if (!cancelled) setState({ status: 'signedIn', user });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return; // déconnexion déjà déclenchée
        if (!cancelled) setState(cached ? { status: 'signedIn', user: cached } : { status: 'signedOut', user: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startSession = useCallback(async ({ token, user }: AuthResponse) => {
    setAuthToken(token);
    await Promise.all([tokenStorage.set(token), AsyncStorage.setItem(USER_KEY, JSON.stringify(user))]);
    setState({ status: 'signedIn', user });
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) =>
      startSession(await api<AuthResponse>('/api/auth/login', { method: 'POST', body: { email: email.trim(), password } })),
    [startSession],
  );

  const signUp = useCallback(
    async ({ firstName, lastName, email, password }: SignUpInput) =>
      startSession(
        await api<AuthResponse>('/api/auth/register', {
          method: 'POST',
          body: { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password },
        }),
      ),
    [startSession],
  );

  const enterDemo = useCallback((role: DemoRole = 'athlete') => {
    if (DEMO_ENABLED) setState({ status: 'demo', user: DEMO_USERS[role] });
  }, []);

  const updateUser = useCallback((user: ApiUser) => {
    setState((current) => (current.user ? { ...current, user } : current));
    if (getAuthToken()) AsyncStorage.setItem(USER_KEY, JSON.stringify(user)).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ ...state, signIn, signUp, signOut, enterDemo, updateUser }), [state, signIn, signUp, signOut, enterDemo, updateUser]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession doit être utilisé dans <SessionProvider>');
  return session;
}
