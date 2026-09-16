import { useCallback, useEffect, useRef, useState } from 'react';

import { initialsOf, mapMessages } from '@/features/athlete/mappers';
import type { ChatMessage } from '@/features/athlete/types';
import { useSession } from '@/features/auth/session';
import { useSessionQuery } from '@/features/auth/use-session-query';
import { useSocket, useSocketEvent } from '@/features/realtime/socket-provider';
import { api } from '@/lib/api';
import type { ApiConversation, ApiMessage, ApiSessionRef, ApiUserRef } from '@/lib/api-types';
import { emitAppEvent } from '@/lib/app-events';
import { formatTime } from '@/lib/format';

import { getConversations } from './conversations';

export type ChatPeer = { id: string; firstName: string; name: string; initials: string; online: boolean };

type ChatData = { peer: ChatPeer | null; conversationId: string | null; messages: ApiMessage[] };
type Pending = { localId: string; text: string; session?: ApiSessionRef };

type Options = {
  /** Clé de cache de la conversation. */
  key: string;
  /** Interlocuteur, à partir des conversations existantes (null : pas d'interlocuteur). */
  loadPeer: (conversations: ApiConversation[]) => Promise<ApiUserRef | null>;
  demo: () => { peer: ChatPeer | null; messages: ChatMessage[] };
};

const TYPING_IDLE_MS = 2500;

const senderIdOf = (message: ApiMessage) => (typeof message.sender === 'string' ? message.sender : message.sender._id);

/** Conversation directe : historique, messages en direct, envoi, « écrit… » et accusés de lecture. */
export function useDirectChat({ key, loadPeer, demo }: Options) {
  const { status, user } = useSession();
  const socket = useSocket();
  const myId = user?.id ?? '';

  const query = useSessionQuery<ChatData>(
    key,
    async () => {
      const conversations = await getConversations();
      const peer = await loadPeer(conversations);
      if (!peer) return { peer: null, conversationId: null, messages: [] };
      const conversation = conversations.find((item) => item.otherParticipant?._id === peer._id);
      const messages = conversation
        ? (await api<{ messages: ApiMessage[] }>(`/api/chat/conversations/${conversation._id}/messages`, { query: { limit: 50 } })).messages
        : [];
      return {
        peer: {
          id: peer._id,
          firstName: peer.firstName,
          name: `${peer.firstName} ${peer.lastName}`.trim(),
          initials: initialsOf(peer.firstName, peer.lastName),
          online: Boolean(conversation?.otherParticipant?.isOnline),
        },
        conversationId: conversation?._id ?? null,
        messages,
      };
    },
    () => ({ peer: demo().peer, conversationId: null, messages: [] }),
  );

  const [createdConversationId, setCreatedConversationId] = useState<string | null>(null);
  const [live, setLive] = useState<ApiMessage[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [demoSent, setDemoSent] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const typingSent = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const peer = query.data?.peer ?? null;
  const conversationId = query.data?.conversationId ?? createdConversationId;
  const { refetch } = query;

  const markRead = useCallback(() => {
    if (status !== 'signedIn' || !conversationId) return;
    api(`/api/chat/conversations/${conversationId}/read`, { method: 'PATCH' }).then(
      () => emitAppEvent('chat:read'),
      () => undefined,
    );
  }, [status, conversationId]);

  // Rejoindre la conversation (utile si elle vient d'être créée) et rattraper les messages manqués après une reconnexion.
  useEffect(() => {
    if (!socket || !conversationId) return;
    const join = () => socket.emit('conversation:join', { conversationId });
    const rejoin = () => {
      join();
      refetch();
    };
    if (socket.connected) join();
    socket.on('connect', rejoin);
    return () => {
      socket.off('connect', rejoin);
    };
  }, [socket, conversationId, refetch]);

  useSocketEvent<{ message: ApiMessage; conversationId: string }>('message:new', ({ message, conversationId: id }) => {
    if (id !== conversationId) return;
    setLive((current) => (current.some((item) => item._id === message._id) ? current : [...current, message]));
    if (senderIdOf(message) === myId) {
      setPending((current) => {
        const index = current.findIndex((item) => item.text === message.content);
        return index === -1 ? current : current.filter((_, i) => i !== index);
      });
    } else {
      setTyping(false);
      markRead();
    }
  });

  useSocketEvent<{ conversationId: string; userId: string }>('typing:start', (payload) => {
    if (payload.conversationId === conversationId && String(payload.userId) !== myId) setTyping(true);
  });

  useSocketEvent<{ conversationId: string }>('typing:stop', (payload) => {
    if (payload.conversationId === conversationId) setTyping(false);
  });

  useSocketEvent<{ message: string }>('error', (payload) => {
    setPending([]);
    setSendError(payload.message);
  });

  const stopTyping = () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = null;
    if (typingSent.current && socket && conversationId) socket.emit('typing:stop', { conversationId });
    typingSent.current = false;
  };

  const notifyTyping = () => {
    if (!socket || !conversationId) return;
    if (!typingSent.current) {
      socket.emit('typing:start', { conversationId });
      typingSent.current = true;
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  /**
   * Envoie un message, éventuellement accompagné d'une séance citée.
   * Renvoie true si le message est parti (le brouillon peut être vidé).
   */
  const send = async (text: string, session?: ApiSessionRef) => {
    const content = text.trim();
    if (!content) return false;
    setSendError(null);
    stopTyping();

    const cited = session ? { kind: session.kind, id: session.id, sport: session.sport, title: session.title || 'Séance', meta: session.meta } : undefined;

    if (status === 'demo') {
      setDemoSent((current) => [...current, { id: `demo-${current.length}`, fromMe: true, text: content, timeLabel: formatTime(new Date()), session: cited }]);
      return true;
    }
    if (!peer || !socket) return false;

    let id = conversationId;
    if (!id) {
      const created = await api<ApiConversation>(`/api/chat/conversations/with/${peer.id}`, { method: 'POST' });
      id = created._id;
      setCreatedConversationId(id);
      socket.emit('conversation:join', { conversationId: id });
    }
    setPending((current) => [...current, { localId: `local-${Date.now()}`, text: content, session }]);
    // Hors connexion, socket.io garde l'envoi en file et le transmet à la reconnexion.
    socket.emit('message:send', { conversationId: id, content, type: session ? 'session' : 'text', sessionRef: session });
    return true;
  };

  const history = query.data?.messages ?? [];
  const merged = [...history, ...live.filter((message) => !history.some((item) => item._id === message._id))].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const messages: ChatMessage[] =
    status === 'demo'
      ? [...demo().messages, ...demoSent]
      : [...mapMessages(merged, myId, new Date()), ...pending.map((item) => ({ id: item.localId, fromMe: true, text: item.text, sending: true }))];

  return {
    peer,
    messages,
    loading: query.loading,
    error: query.error,
    refetch,
    typing,
    sendError,
    send,
    notifyTyping,
    markRead,
  };
}

export type DirectChat = ReturnType<typeof useDirectChat>;
