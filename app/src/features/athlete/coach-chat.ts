import { useCallback, useEffect, useRef, useState } from 'react';

import { useSession } from '@/features/auth/session';
import { useSocket, useSocketEvent } from '@/features/realtime/socket-provider';
import { api } from '@/lib/api';
import type { ApiConversation, ApiMessage } from '@/lib/api-types';
import { emitAppEvent, onAppEvent } from '@/lib/app-events';
import { formatTime } from '@/lib/format';

import { initialsOf, mapMessages } from './mappers';
import { getCoach, getConversations, useAthleteQuery } from './queries';
import { sampleCoachThread, sampleHome } from './sample-data';
import type { ChatMessage, CoachSummary } from './types';

type ChatCoach = CoachSummary & { id: string; firstName: string };
type ChatData = { coach: ChatCoach | null; conversationId: string | null; messages: ApiMessage[] };
type Pending = { localId: string; text: string };

const TYPING_IDLE_MS = 2500;

const senderIdOf = (message: ApiMessage) => (typeof message.sender === 'string' ? message.sender : message.sender._id);

/** Conversation avec le coach : historique, messages en direct, envoi, « écrit… » et accusés de lecture. */
export function useCoachChat() {
  const { status, user } = useSession();
  const socket = useSocket();
  const myId = user?.id ?? '';

  const query = useAthleteQuery<ChatData>(
    'coach-chat',
    async () => {
      const [coach, conversations] = await Promise.all([getCoach(), getConversations()]);
      if (!coach) return { coach: null, conversationId: null, messages: [] };
      const conversation = conversations.find((item) => item.otherParticipant?._id === coach._id);
      const messages = conversation
        ? (await api<{ messages: ApiMessage[] }>(`/api/chat/conversations/${conversation._id}/messages`, { query: { limit: 50 } })).messages
        : [];
      return {
        coach: {
          id: coach._id,
          firstName: coach.firstName,
          name: `${coach.firstName} ${coach.lastName}`.trim(),
          initials: initialsOf(coach.firstName, coach.lastName),
          online: Boolean(conversation?.otherParticipant?.isOnline),
        },
        conversationId: conversation?._id ?? null,
        messages,
      };
    },
    () => ({ coach: sampleHome.coach ? { ...sampleHome.coach, id: 'demo-coach', firstName: 'Camille' } : null, conversationId: null, messages: [] }),
  );

  const [createdConversationId, setCreatedConversationId] = useState<string | null>(null);
  const [live, setLive] = useState<ApiMessage[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [demoSent, setDemoSent] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const typingSent = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const coach = query.data?.coach ?? null;
  const conversationId = query.data?.conversationId ?? createdConversationId;
  const { refetch } = query;

  useEffect(() => onAppEvent('coach:changed', refetch), [refetch]);

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

  /** Renvoie true si le message est parti (le brouillon peut être vidé). */
  const send = async (text: string) => {
    const content = text.trim();
    if (!content) return false;
    setSendError(null);
    stopTyping();

    if (status === 'demo') {
      setDemoSent((current) => [...current, { id: `demo-${current.length}`, fromMe: true, text: content, timeLabel: formatTime(new Date()) }]);
      return true;
    }
    if (!coach || !socket) return false;

    let id = conversationId;
    if (!id) {
      const created = await api<ApiConversation>(`/api/chat/conversations/with/${coach.id}`, { method: 'POST' });
      id = created._id;
      setCreatedConversationId(id);
      socket.emit('conversation:join', { conversationId: id });
    }
    setPending((current) => [...current, { localId: `local-${Date.now()}`, text: content }]);
    // Hors connexion, socket.io garde l'envoi en file et le transmet à la reconnexion.
    socket.emit('message:send', { conversationId: id, content, type: 'text' });
    return true;
  };

  const history = query.data?.messages ?? [];
  const merged = [...history, ...live.filter((message) => !history.some((item) => item._id === message._id))].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const messages: ChatMessage[] =
    status === 'demo'
      ? [...sampleCoachThread, ...demoSent]
      : [...mapMessages(merged, myId, new Date()), ...pending.map((item) => ({ id: item.localId, fromMe: true, text: item.text, sending: true }))];

  return {
    coach,
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
