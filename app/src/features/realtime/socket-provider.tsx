import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';

import { useSession } from '@/features/auth/session';
import { API_URL, getAuthToken } from '@/lib/api';

const SocketContext = createContext<Socket | null>(null);

/**
 * Connexion temps réel à l'API, ouverte seulement quand l'app est au premier plan :
 * l'API considère l'utilisateur hors ligne dès que plus aucun socket n'est connecté et envoie alors des push.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const token = status === 'signedIn' ? getAuthToken() : null;
  const socket = useMemo(() => (token ? io(API_URL, { auth: { token }, transports: ['websocket'], autoConnect: false }) : null), [token]);

  useEffect(() => {
    if (!socket) return;
    if (AppState.currentState === 'active') socket.connect();
    const subscription = AppState.addEventListener('change', (state) => (state === 'active' ? socket.connect() : socket.disconnect()));
    return () => {
      subscription.remove();
      socket.disconnect();
    };
  }, [socket]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

/** Écoute un événement du serveur tant que le composant est monté. */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const socket = useSocket();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!socket) return;
    const listener = (payload: T) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
