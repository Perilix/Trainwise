import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { BackBar, Screen, StateView } from '@/components/ui';
import { ChatThread } from '@/features/chat/chat-thread';
import { useGroupChat } from '@/features/chat/group-chat';
import { useSocketEvent } from '@/features/realtime/socket-provider';

/**
 * La discussion d'un groupe, vue par l'athlète.
 *
 * Il ne peut pas la créer — c'est son coach qui rassemble le groupe — mais il
 * y écrit comme les autres, et voit les messages de tout le monde.
 */
export default function AthleteGroupChatScreen() {
  const router = useRouter();
  const { conversation, nom } = useLocalSearchParams<{ conversation: string; nom?: string }>();
  const chat = useGroupChat({ conversationId: conversation, name: nom ?? 'Groupe' });

  useFocusEffect(chat.markRead);

  // Retiré du groupe : la discussion se referme plutôt que de rester ouverte
  // sur un fil auquel on n'a plus accès.
  useSocketEvent<{ conversationId: string }>('conversation:removed', (payload) => {
    if (payload.conversationId === conversation) router.back();
  });

  if (!chat.peer) {
    return (
      <Screen>
        <BackBar title={nom ?? 'Groupe'} />
        <StateView loading={chat.loading} error={chat.error ?? (chat.loading ? null : 'Discussion indisponible.')} onRetry={chat.refetch} />
      </Screen>
    );
  }

  return <ChatThread chat={chat} offlineLabel="Groupe" showSenders onBack={() => router.back()} />;
}
