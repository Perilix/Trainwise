import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Card, Screen, Section, StateView, Text } from '@/components/ui';
import type { ConversationRow } from '@/features/chat/conversations';
import { useCoachConversations } from '@/features/coach/queries';
import { useSocketEvent } from '@/features/realtime/socket-provider';
import { MainAppBar } from '@/features/shell/main-app-bar';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

export default function CoachMessagesScreen() {
  const router = useRouter();
  const { data, loading, error, refetch } = useCoachConversations();

  useFocusEffect(refetch);
  useSocketEvent('message:new', refetch);

  return (
    <Screen>
      <MainAppBar />
      <Section style={styles.heading}>
        <Text variant="h1">Messages</Text>
      </Section>

      {data ? (
        <Section>
          {data.length ? (
            <Card padding={0} style={styles.list}>
              {data.map((conversation, index) => (
                <ConversationItem
                  key={conversation.peerId}
                  conversation={conversation}
                  divided={index > 0}
                  onPress={() => router.push({ pathname: '/pro/conversation/[id]', params: { id: conversation.peerId } })}
                />
              ))}
            </Card>
          ) : (
            <Card>
              <Text variant="body2">Aucune conversation pour l’instant. Écrivez à un athlète depuis sa fiche.</Text>
            </Card>
          )}
        </Section>
      ) : (
        <StateView loading={loading} error={error} onRetry={refetch} />
      )}
    </Screen>
  );
}

function ConversationItem({ conversation, divided, onPress }: { conversation: ConversationRow; divided: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const unread = conversation.unread > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${conversation.name}${unread ? `, ${conversation.unread} non lus` : ''}. ${conversation.preview}`}
      onPress={onPress}
      style={[styles.item, divided && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <View>
        <Avatar initials={conversation.initials} size={44} tone="accent" />
        {conversation.online ? <View style={[styles.online, { backgroundColor: colors.success, borderColor: colors.surface }]} /> : null}
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text variant="h3" numberOfLines={1} style={styles.name}>
            {conversation.name}
          </Text>
          <Text variant="caption" color={unread ? 'accentInk' : 'text3'}>
            {conversation.timeLabel}
          </Text>
        </View>
        <View style={styles.titleRow}>
          <Text variant="small" numberOfLines={1} style={[styles.name, unread && { color: colors.ink, fontFamily: fontFamily.medium }]}>
            {conversation.preview}
          </Text>
          {unread ? (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={[styles.badgeText, { color: colors.onBrand }]}>{conversation.unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { paddingTop: 4, paddingBottom: 14 },
  list: { paddingHorizontal: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  online: { position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  text: { flex: 1, gap: 2, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, minWidth: 0 },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 14 },
});
