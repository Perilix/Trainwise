import { useFocusEffect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, IconButton, Screen, Section, Segmented, StateView, Text } from '@/components/ui';
import { useCoachChat } from '@/features/athlete/coach-chat';
import { useAthleteConversations, usePlannedSession } from '@/features/athlete/queries';
import type { CitedSession } from '@/features/athlete/types';
import { ConversationList } from '@/features/chat/conversation-list';
import { ChatThread } from '@/features/chat/chat-thread';
import { SessionPreview } from '@/features/sessions/session-preview';
import { useTheme } from '@/theme/theme-provider';

import { useHideTabBar } from './_layout';

const FILTERS = [
  { value: 'tous', label: 'Tous' },
  { value: 'coach', label: 'Mon coach' },
  { value: 'groupes', label: 'Groupes' },
] as const;

export default function CoachChatScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const chat = useCoachChat();
  const { data: conversations, refetch: refetchConversations } = useAthleteConversations();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('tous');
  /** Le fil du coach, ouvert depuis la liste. */
  const [coachOpen, setCoachOpen] = useState(false);

  const groups = (conversations ?? []).filter((row) => row.kind === 'group');
  // Tant qu'il n'appartient à aucun groupe, l'athlète n'a qu'une discussion :
  // la liste ne lui apprendrait rien, on l'envoie droit à son coach.
  const showList = groups.length > 0 && !coachOpen;

  useFocusEffect(chat.markRead);
  useFocusEffect(refetchConversations);
  // Le fil prend tout l'écran : la barre d'onglets s'efface, on revient par la flèche.
  useHideTabBar(Boolean(chat.peer) && !showList);

  // La bulle citée occupe 80 % de la largeur, moins les marges de la carte.
  const previewWidth = Math.round(width * 0.8) - 44;
  const CitedSessionBody = useMemo(
    () =>
      function AthleteCitedSessionBody({ session }: { session: CitedSession }) {
        const { data } = usePlannedSession(session.id);
        return data ? <SessionPreview blocks={data.blocks} segments={data.segments} width={previewWidth} /> : null;
      },
    [previewWidth],
  );

  if (!chat.peer) {
    return (
      <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
        {chat.loading || chat.error ? (
          <StateView loading={chat.loading} error={chat.error} onRetry={chat.refetch} />
        ) : (
          <View style={[styles.flex, styles.empty]}>
            <Icon name="users" size={28} color={colors.text3} />
            <Text variant="h2">Pas encore de coach</Text>
            <Text variant="body2" style={styles.centered}>
              Rejoins un coach avec son code d’invitation pour échanger avec lui ici.
            </Text>
            <Button label="Rejoindre un coach" icon="users" onPress={() => router.push('/rejoindre-coach')} style={styles.joinButton} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  if (showList) {
    const rows = (conversations ?? []).filter((row) => (filter === 'tous' ? true : filter === 'groupes' ? row.kind === 'group' : row.kind === 'direct'));
    return (
      <Screen tabs>
        <Section style={styles.heading}>
          <Text variant="h1">Messages</Text>
        </Section>
        <Section style={styles.tight}>
          <Segmented options={FILTERS} value={filter} onChange={setFilter} />
        </Section>
        <Section>
          {rows.length ? (
            <ConversationList
              rows={rows}
              onOpen={(row) =>
                row.kind === 'group'
                  ? router.push({ pathname: '/discussion', params: { conversation: row.conversationId, nom: row.name } })
                  : setCoachOpen(true)
              }
            />
          ) : (
            <Text variant="body2">Aucune discussion pour l’instant.</Text>
          )}
        </Section>
      </Screen>
    );
  }

  return (
    <ChatThread
      chat={chat}
      offlineLabel="Ton coach"
      onBack={() => (groups.length ? setCoachOpen(false) : router.navigate('/'))}
      peerRole="coach"
      headerRight={<IconButton icon="calendar" size={44} glass accessibilityLabel="Ouvrir le planning" onPress={() => router.push('/planning')} />}
      CitedSessionBody={CitedSessionBody}
      onOpenSession={(session) =>
        session.kind === 'run'
          ? router.push({ pathname: '/sortie/[id]', params: { id: session.id } })
          : router.push({ pathname: '/seance/[id]', params: { id: session.id } })
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 32 },
  centered: { textAlign: 'center' },
  joinButton: { marginTop: 14 },
  heading: { gap: 2, paddingTop: 4, paddingBottom: 14 },
  tight: { paddingBottom: 12 },
});
