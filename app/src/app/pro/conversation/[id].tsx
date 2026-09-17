import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { BackBar, IconButton, Screen, StateView } from '@/components/ui';
import type { CitedSession, PlannedSession } from '@/features/athlete/types';
import { ChatThread } from '@/features/chat/chat-thread';
import { useShareSession } from '@/features/chat/share-session';
import { CiteSessionModal, citedMeta } from '@/features/coach/cite-session-modal';
import { useAthleteConversation, useCoachPlannedSession } from '@/features/coach/queries';
import { SessionPreview } from '@/features/sessions/session-preview';
import { formatDayLong } from '@/lib/format';

export default function CoachConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const chat = useAthleteConversation(id);
  const shareSession = useShareSession();
  const { width } = useWindowDimensions();
  const [citing, setCiting] = useState(false);

  useFocusEffect(chat.markRead);

  // La bulle citée occupe 80 % de la largeur, moins les marges de la carte.
  const previewWidth = Math.round(width * 0.8) - 44;

  // Le déroulé d'une séance citée : chargé à l'affichage, pour ne pas figer les blocs dans le message.
  const CitedSessionBody = useMemo(
    () =>
      function CoachCitedSessionBody({ session }: { session: CitedSession }) {
        const { data } = useCoachPlannedSession(id, session.id);
        return data ? <SessionPreview session={data} width={previewWidth} /> : null;
      },
    [id, previewWidth],
  );

  const cite = async (session: PlannedSession) => {
    setCiting(false);
    await shareSession(id, `Séance du ${formatDayLong(session.date).toLowerCase()} : ${session.title}`, {
      kind: 'planned',
      id: session.id,
      sport: session.sport,
      title: session.title,
      date: session.date,
      meta: citedMeta(session),
    });
    chat.refetch();
  };

  if (!chat.peer) {
    return (
      <Screen>
        <BackBar />
        <StateView loading={chat.loading} error={chat.error ?? (chat.loading ? null : 'Conversation introuvable.')} onRetry={chat.refetch} />
      </Screen>
    );
  }

  return (
    <>
      <ChatThread
        chat={chat}
        offlineLabel="Hors ligne"
        onBack={() => router.back()}
        headerRight={<IconButton icon="user" size={44} glass accessibilityLabel="Voir la fiche athlète" onPress={() => router.push({ pathname: '/pro/athletes/[id]', params: { id } })} />}
        onCite={() => setCiting(true)}
        CitedSessionBody={CitedSessionBody}
        onOpenSession={(session) =>
          session.kind === 'run'
            ? router.push({ pathname: '/pro/athletes/[id]/sortie/[runId]', params: { id, runId: session.id } })
            : session.kind === 'strength'
              ? router.push({ pathname: '/pro/athletes/[id]/muscu/[sessionId]', params: { id, sessionId: session.id } })
              : router.push({ pathname: '/pro/athletes/[id]/seance/[planId]', params: { id, planId: session.id } })
        }
      />
      <CiteSessionModal athleteId={id} visible={citing} onClose={() => setCiting(false)} onPick={cite} />
    </>
  );
}
