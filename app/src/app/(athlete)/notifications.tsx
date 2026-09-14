import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BackBar, Button, Icon, Screen, Section, Segmented, StateView, Text, type IconName } from '@/components/ui';
import { useAthleteActions, useNotifications } from '@/features/athlete/queries';
import type { AthleteNotification, NotificationKind } from '@/features/athlete/types';
import { routeForActionUrl } from '@/features/notifications/action-routes';
import { useTheme } from '@/theme/theme-provider';
import { radius, type Palette } from '@/theme/tokens';

const GROUPS: { key: AthleteNotification['group']; label: string }[] = [
  { key: 'today', label: 'Aujourd’hui' },
  { key: 'yesterday', label: 'Hier' },
  { key: 'week', label: 'Cette semaine' },
  { key: 'older', label: 'Plus ancien' },
];

const KIND_STYLE: Record<NotificationKind, { icon: IconName; background: keyof Palette; foreground: keyof Palette }> = {
  'session-updated': { icon: 'pen', background: 'violetSoft', foreground: 'violetInk' },
  message: { icon: 'message', background: 'accentSoft', foreground: 'accentInk' },
  'sessions-planned': { icon: 'calendar', background: 'violetSoft', foreground: 'violetInk' },
  'strava-import': { icon: 'activity', background: 'stravaSoft', foreground: 'stravaInk' },
  'friend-request': { icon: 'users', background: 'subtle', foreground: 'text2' },
  invitation: { icon: 'user', background: 'violetSoft', foreground: 'violetInk' },
  record: { icon: 'trophy', background: 'successSoft', foreground: 'successInk' },
  competition: { icon: 'flag', background: 'warningSoft', foreground: 'warningInk' },
  other: { icon: 'bell', background: 'subtle', foreground: 'text2' },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data, loading, error, refetch } = useNotifications();
  const { markNotificationRead, markAllNotificationsRead } = useAthleteActions();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const notifications = data ?? [];
  const unreadCount = notifications.filter((item) => item.unread).length;
  const visible = filter === 'unread' ? notifications.filter((item) => item.unread) : notifications;

  const markAll = async () => {
    await markAllNotificationsRead().catch(() => undefined);
    refetch();
  };

  const open = (item: AthleteNotification) => {
    if (item.unread) markNotificationRead(item.id).then(refetch, () => undefined);
    const route = routeForActionUrl(item.actionUrl);
    if (route) router.push(route);
  };

  return (
    <Screen>
      <BackBar title="Notifications" right={unreadCount ? <Button label="Tout lire" variant="ghost" size="sm" onPress={markAll} /> : undefined} />

      {data ? (
        <>
          <Section style={styles.filter}>
            <Segmented
              options={[
                { value: 'all', label: `Toutes · ${notifications.length}` },
                { value: 'unread', label: `Non lues · ${unreadCount}` },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </Section>

          {GROUPS.map((group) => {
            const items = visible.filter((item) => item.group === group.key);
            if (!items.length) return null;
            return (
              <Section key={group.key} style={styles.group}>
                <Text variant="overline" style={styles.groupLabel}>
                  {group.label}
                </Text>
                <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {items.map((item, index) => (
                    <NotificationRow key={item.id} item={item} divided={index > 0} onPress={() => open(item)} />
                  ))}
                </View>
              </Section>
            );
          })}

          {!visible.length ? (
            <Section>
              <Text variant="body2">{filter === 'unread' ? 'Tu es à jour, aucune notification non lue.' : 'Aucune notification pour le moment.'}</Text>
            </Section>
          ) : null}
        </>
      ) : (
        <StateView loading={loading} error={error} onRetry={refetch} />
      )}
    </Screen>
  );
}

function NotificationRow({ item, divided, onPress }: { item: AthleteNotification; divided: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const kind = KIND_STYLE[item.kind];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.unread ? 'Non lue. ' : ''}${item.title}. ${item.body}. ${item.timeLabel}`}
      onPress={onPress}
      style={[styles.row, divided && { borderTopWidth: 1, borderTopColor: colors.border }, item.unread && { backgroundColor: `${colors.accentSoft}66` }]}>
      <View style={[styles.tile, { backgroundColor: colors[kind.background] }]}>
        <Icon name={kind.icon} size={20} color={colors[kind.foreground]} />
      </View>
      <View style={styles.flex}>
        <View style={styles.titleRow}>
          <Text variant="h3" style={styles.flex}>
            {item.title}
          </Text>
          <Text variant="caption" color="text3">
            {item.timeLabel}
          </Text>
          <View style={[styles.unreadDot, { backgroundColor: item.unread ? colors.accent : 'transparent' }]} />
        </View>
        <Text variant="small" style={styles.body}>
          {item.body}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filter: { paddingBottom: 16 },
  group: { paddingBottom: 16 },
  groupLabel: { marginBottom: 8 },
  list: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  tile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  body: { marginTop: 2 },
});
