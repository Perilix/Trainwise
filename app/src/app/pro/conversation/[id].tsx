import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { BackBar, IconButton, Screen, StateView } from '@/components/ui';
import { ChatThread } from '@/features/chat/chat-thread';
import { useAthleteConversation } from '@/features/coach/queries';

export default function CoachConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const chat = useAthleteConversation(id);

  useFocusEffect(chat.markRead);

  if (!chat.peer) {
    return (
      <Screen>
        <BackBar />
        <StateView loading={chat.loading} error={chat.error ?? (chat.loading ? null : 'Conversation introuvable.')} onRetry={chat.refetch} />
      </Screen>
    );
  }

  return (
    <ChatThread
      chat={chat}
      offlineLabel="Hors ligne"
      onBack={() => router.back()}
      headerRight={<IconButton icon="user" accessibilityLabel="Voir la fiche athlète" onPress={() => router.push({ pathname: '/pro/athletes/[id]', params: { id } })} />}
      onOpenSession={(session) =>
        session.kind === 'run'
          ? router.push({ pathname: '/pro/athletes/[id]/sortie/[runId]', params: { id, runId: session.id } })
          : session.kind === 'strength'
            ? router.push({ pathname: '/pro/athletes/[id]/muscu/[sessionId]', params: { id, sessionId: session.id } })
            : router.push({ pathname: '/pro/athletes/[id]/seance/[planId]', params: { id, planId: session.id } })
      }
    />
  );
}
