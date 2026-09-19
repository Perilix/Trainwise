import { useDirectChat } from '@/features/chat/use-direct-chat';
import { api } from '@/lib/api';
import type { ApiMessage } from '@/lib/api-types';

type Params = {
  /** Groupe du coach : la conversation est créée ou retrouvée à l'ouverture. */
  groupId?: string;
  /** Conversation déjà connue — c'est le cas depuis la liste des messages. */
  conversationId?: string;
  name: string;
};

/**
 * La discussion d'un groupe : une vraie conversation à plusieurs.
 *
 * Le coach l'ouvre depuis la carte du groupe — le serveur la crée à la
 * première fois, puis la garde alignée sur les membres. Tout le monde,
 * athlètes compris, la rouvre ensuite depuis la liste des messages.
 */
export function useGroupChat({ groupId, conversationId, name }: Params) {
  return useDirectChat({
    key: `group-chat:${conversationId ?? groupId ?? 'inconnu'}`,
    loadPeer: async () => null,
    loadConversation: async () => {
      const id =
        conversationId ??
        (await api<{ conversationId: string }>(`/api/coach/groups/${encodeURIComponent(groupId ?? '')}/conversation`, { method: 'POST' })).conversationId;
      const { messages } = await api<{ messages: ApiMessage[] }>(`/api/chat/conversations/${id}/messages`, { query: { limit: 50 } });
      return {
        // Le « peer » d'un groupe, c'est le groupe lui-même : un nom et des initiales.
        peer: { id, firstName: name, name, initials: name.slice(0, 2).toUpperCase(), online: false },
        conversationId: id,
        messages,
      };
    },
    demo: () => ({ peer: null, messages: [] }),
  });
}
