// Citer une séance dans la conversation, depuis n'importe quel écran de séance.
import { useSession } from '@/features/auth/session';
import { useSocket } from '@/features/realtime/socket-provider';
import { api } from '@/lib/api';
import type { ApiConversation, ApiSessionRef } from '@/lib/api-types';

/**
 * Envoie un message citant une séance à un interlocuteur, en réutilisant la
 * conversation existante s'il y en a une. Sans connexion temps réel, l'envoi
 * échoue plutôt que de laisser croire au coach que l'athlète l'a reçu.
 */
export function useShareSession() {
  const { status } = useSession();
  const socket = useSocket();

  return async (peerId: string, content: string, session: ApiSessionRef) => {
    if (status === 'demo') return;
    if (!socket) throw new Error('Connexion au chat indisponible.');
    const conversation = await api<ApiConversation>(`/api/chat/conversations/with/${encodeURIComponent(peerId)}`, { method: 'POST' });
    socket.emit('conversation:join', { conversationId: conversation._id });
    socket.emit('message:send', { conversationId: conversation._id, content, type: 'session', sessionRef: session });
  };
}
