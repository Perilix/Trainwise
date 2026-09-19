import { useFocusEffect, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button, Icon, IconButton, StateView, Text } from '@/components/ui';
import { useCoachChat } from '@/features/athlete/coach-chat';
import { useAthleteGroupConversations, usePlannedSession } from '@/features/athlete/queries';
import type { CitedSession } from '@/features/athlete/types';
import { ChatThread } from '@/features/chat/chat-thread';
import { SessionPreview } from '@/features/sessions/session-preview';
import { useTheme } from '@/theme/theme-provider';

import { useHideTabBar } from './_layout';

export default function CoachChatScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const chat = useCoachChat();
  const { data: groups } = useAthleteGroupConversations();
  const { width } = useWindowDimensions();

  useFocusEffect(chat.markRead);
  // Le fil prend tout l'écran : la barre d'onglets s'efface, on revient par la flèche.
  useHideTabBar(Boolean(chat.peer));

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

  return (
    <ChatThread
      chat={chat}
      offlineLabel="Ton coach"
      onBack={() => router.navigate('/')}
      peerRole="coach"
      headerRight={<IconButton icon="calendar" size={44} glass accessibilityLabel="Ouvrir le planning" onPress={() => router.push('/planning')} />}
      above={
        groups && groups.length ? (
          <View style={styles.groups}>
            {groups.map((group) => (
              <Pressable
                key={group.conversationId}
                accessibilityRole="button"
                accessibilityLabel={`Discussion ${group.name}${group.unread ? `, ${group.unread} non lus` : ''}`}
                onPress={() => router.push({ pathname: '/discussion', params: { conversation: group.conversationId, nom: group.name } })}
                style={[styles.groupChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Avatar initials={group.initials} size={24} tone="primary" />
                <Text variant="small" numberOfLines={1}>
                  {group.name}
                </Text>
                {group.unread ? <View style={[styles.dot, { backgroundColor: colors.danger }]} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null
      }
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
  groups: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  groupChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingRight: 12, paddingLeft: 6, borderRadius: 999, borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
