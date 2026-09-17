import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BackBar, Button, Chip, Icon, Screen, Section, Segmented, StateView, Text, type IconName } from '@/components/ui';
import { useAthleteActions, useNotifications } from '@/features/athlete/queries';
import type { AthleteNotification, NotificationCategory, NotificationKind } from '@/features/athlete/types';
import { isCoach, useSession } from '@/features/auth/session';
import { useTheme } from '@/theme/theme-provider';
import { radius, type Palette } from '@/theme/tokens';

import { routeForActionUrl } from './action-routes';

// Trois sections plutôt qu'un fil chronologique : ce qui vient du coach d'abord,
// l'entraînement ensuite, le compte en dernier.
const SECTIONS: { key: NotificationCategory; label: string }[] = [
  { key: 'priority', label: 'Prioritaires' },
  { key: 'training', label: 'Entraînements' },
  { key: 'account', label: 'Compte' },
];

const KIND_STYLE: Record<NotificationKind, { icon: IconName; background: keyof Palette; foreground: keyof Palette }> = {
  'session-updated': { icon: 'pen', background: 'violetSoft', foreground: 'violetInk' },
  'session-planned': { icon: 'calendar', background: 'violetSoft', foreground: 'violetInk' },
  'week-published': { icon: 'calendar', background: 'violetSoft', foreground: 'violetInk' },
  'session-reminder': { icon: 'bell', background: 'accentSoft', foreground: 'accentInk' },
  feedback: { icon: 'quote', background: 'accentSoft', foreground: 'accentInk' },
  message: { icon: 'message', background: 'accentSoft', foreground: 'accentInk' },
  'strava-import': { icon: 'activity', background: 'stravaSoft', foreground: 'stravaInk' },
  'session-done': { icon: 'check', background: 'successSoft', foreground: 'successInk' },
  'friend-request': { icon: 'users', background: 'subtle', foreground: 'text2' },
  invitation: { icon: 'user', background: 'violetSoft', foreground: 'violetInk' },
  record: { icon: 'trophy', background: 'successSoft', foreground: 'successInk' },
  competition: { icon: 'flag', background: 'warningSoft', foreground: 'warningInk' },
  subscription: { icon: 'shield', background: 'subtle', foreground: 'text2' },
  alert: { icon: 'warning', background: 'dangerSoft', foreground: 'danger' },
  other: { icon: 'bell', background: 'subtle', foreground: 'text2' },
};

/** Centre de notifications, commun aux espaces athlète et coach. */
export function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useSession();
  const { data, loading, error, refetch } = useNotifications();
  const { markNotificationRead, markAllNotificationsRead } = useAthleteActions();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const coach = isCoach(user);

  const notifications = data ?? [];
  const unreadCount = notifications.filter((item) => item.unread).length;
  const visible = filter === 'unread' ? notifications.filter((item) => item.unread) : notifications;

  const markAll = async () => {
    await markAllNotificationsRead().catch(() => undefined);
    refetch();
  };

  const open = (item: AthleteNotification) => {
    if (item.unread) markNotificationRead(item.id).then(refetch, () => undefined);
    const route = routeForActionUrl(item.actionUrl, coach);
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

          {visible.length ? (
            SECTIONS.map((section) => {
              const items = visible.filter((item) => item.category === section.key);
              if (!items.length) return null;
              const unread = items.filter((item) => item.unread).length;
              return (
                <Section key={section.key} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <Text variant="sectionTitle">{section.label}</Text>
                    {unread ? <Chip label={String(unread)} tone="danger" /> : null}
                  </View>
                  <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {items.map((item, index) => (
                      <NotificationRow key={item.id} item={item} divided={index > 0} onPress={() => open(item)} />
                    ))}
                  </View>
                </Section>
              );
            })
          ) : (
            <Section>
              <Text variant="body2">{filter === 'unread' ? 'Tout est lu, aucune notification en attente.' : 'Aucune notification pour le moment.'}</Text>
            </Section>
          )}
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
          <View style={[styles.unreadDot, { backgroundColor: item.unread ? colors.danger : 'transparent' }]} />
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
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  list: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  tile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  body: { marginTop: 2 },
});
