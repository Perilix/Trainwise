import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { BackBar, Screen, StateView } from '@/components/ui';
import { ChatThread } from '@/features/chat/chat-thread';
import { useGroupChat } from '@/features/coach/queries';

/**
 * La discussion d'un groupe d'athlètes.
 *
 * C'est une conversation à plusieurs : tout le monde voit les messages de tout
 * le monde. Pas de séance citée ici — une séance appartient à un athlète, pas
 * à un groupe.
 */
export default function CoachGroupChatScreen() {
  const router = useRouter();
  const { id, nom } = useLocalSearchParams<{ id: string; nom?: string }>();
  const chat = useGroupChat(id, nom ?? 'Groupe');

  useFocusEffect(chat.markRead);

  if (!chat.peer) {
    return (
      <Screen>
        <BackBar title={nom ?? 'Groupe'} />
        <StateView loading={chat.loading} error={chat.error ?? (chat.loading ? null : 'Discussion indisponible.')} onRetry={chat.refetch} />
      </Screen>
    );
  }

  return <ChatThread chat={chat} offlineLabel="Groupe" onBack={() => router.back()} />;
}
