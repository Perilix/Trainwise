import { useFocusEffect, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, IconButton, StateView, Text } from '@/components/ui';
import { useCoachChat } from '@/features/athlete/coach-chat';
import { ChatThread } from '@/features/chat/chat-thread';
import { useTheme } from '@/theme/theme-provider';

export default function CoachChatScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const chat = useCoachChat();

  useFocusEffect(chat.markRead);

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
      headerRight={<IconButton icon="calendar" accessibilityLabel="Ouvrir le planning" onPress={() => router.push('/planning')} />}
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
});
