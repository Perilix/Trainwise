import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, getAuthToken, invalidateApiCache, onUnauthorized, setAuthToken, tokenStorage } from '@/lib/api';
import type { ApiUser, AuthResponse } from '@/lib/api-types';
import { clearQueryCache } from '@/lib/use-query';

const USER_KEY = 'trainwise.user';

/** Mode démo (données d'exemple, sans compte) : développement uniquement ou build explicite. */
export const DEMO_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_DEMO === '1';

const COACH_NOT_AVAILABLE = 'L’espace coach arrive bientôt dans l’app. Utilise la version web en attendant.';

const DEMO_USER: ApiUser = { id: 'demo', email: 'thomas.dubois@example.com', firstName: 'Thomas', lastName: 'Dubois', role: 'user' };

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn' | 'demo';

export type SignUpInput = { firstName: string; lastName: string; email: string; password: string };

type SessionValue = {
  status: SessionStatus;
  user: ApiUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  enterDemo: () => void;
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
        if (user.role === 'coach') return void signOut();
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
        if (!cancelled) setState({ status: 'signedIn', user });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return; // déconnexion déjà déclenchée
        if (!cancelled) setState(cached && cached.role !== 'coach' ? { status: 'signedIn', user: cached } : { status: 'signedOut', user: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  const startSession = useCallback(async ({ token, user }: AuthResponse) => {
    if (user.role === 'coach') throw new ApiError(403, COACH_NOT_AVAILABLE);
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

  const enterDemo = useCallback(() => {
    if (DEMO_ENABLED) setState({ status: 'demo', user: DEMO_USER });
  }, []);

  const value = useMemo(() => ({ ...state, signIn, signUp, signOut, enterDemo }), [state, signIn, signUp, signOut, enterDemo]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession doit être utilisé dans <SessionProvider>');
  return session;
}
