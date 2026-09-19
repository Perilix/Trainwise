import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, avatarToneFor, Card, Icon, Text } from '@/components/ui';
import type { ConversationRow } from '@/features/chat/conversations';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

type Props = {
  rows: ConversationRow[];
  onOpen: (row: ConversationRow) => void;
};

/** La liste des discussions : les directes et les groupes, dans le même style. */
export function ConversationList({ rows, onOpen }: Props) {
  const { colors } = useTheme();

  return (
    <Card padding={0} style={styles.list}>
      {rows.map((row, index) => {
        const unread = row.unread > 0;
        return (
          <Pressable
            key={row.conversationId}
            accessibilityRole="button"
            accessibilityLabel={`${row.name}${unread ? `, ${row.unread} non lus` : ''}. ${row.preview}`}
            onPress={() => onOpen(row)}
            style={[styles.row, index > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : null]}>
            <View>
              <Avatar initials={row.initials} size={44} tone={row.kind === 'group' ? 'primary' : avatarToneFor(row.peerId)} />
              {row.online ? <View style={[styles.online, { backgroundColor: colors.success, borderColor: colors.surface }]} /> : null}
            </View>
            <View style={styles.text}>
              <View style={styles.titleRow}>
                {row.kind === 'group' ? <Icon name="users" size={14} color={colors.danger} /> : null}
                <Text variant="h3" numberOfLines={1} style={styles.flex}>
                  {row.name}
                </Text>
                <Text variant="caption" color={unread ? 'accentInk' : 'text3'}>
                  {row.timeLabel}
                </Text>
              </View>
              <View style={styles.titleRow}>
                <Text variant="small" numberOfLines={1} style={[styles.flex, unread && { color: colors.ink, fontFamily: fontFamily.medium }]}>
                  {row.preview}
                </Text>
                {unread ? (
                  <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                    <Text style={[styles.badgeText, { color: colors.onBrand }]}>{row.unread}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  list: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  text: { flex: 1, gap: 3, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  online: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 15 },
});
