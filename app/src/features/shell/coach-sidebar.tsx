import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { Avatar, BRAND, Icon, Text, type IconName } from '@/components/ui';
import { initialsOf } from '@/features/athlete/mappers';
import { useUnreadNotificationCount } from '@/features/athlete/queries';
import { useSession } from '@/features/auth/session';
import { useSocketEvent } from '@/features/realtime/socket-provider';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

type Entry = { href: string; label: string; icon: IconName; badge?: number };

/**
 * Navigation de l'espace coach sur grand écran : une colonne fixe à gauche, qui
 * remplace la barre d'onglets et reste en place d'un écran à l'autre.
 */
export function CoachSidebar({ unreadMessages }: { unreadMessages?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors, scheme } = useTheme();
  const { user } = useSession();
  const { data: unreadNotifications, refetch } = useUnreadNotificationCount();

  useSocketEvent('notification:new', refetch);

  const entries: Entry[] = [
    { href: '/pro', label: 'Accueil', icon: 'home' },
    { href: '/pro/bibliotheque', label: 'Bibliothèque', icon: 'folder' },
    { href: '/pro/stats', label: 'Stats', icon: 'chart' },
    { href: '/pro/messages', label: 'Messages', icon: 'message', badge: unreadMessages },
  ];

  // `/pro` est le préfixe de tout l'espace : il n'est actif que sur lui-même.
  const active = (href: string) => (href === '/pro' ? pathname === '/pro' : pathname.startsWith(href));

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
      <SvgXml xml={scheme === 'dark' ? BRAND.logoDark : BRAND.logoLight} width={96} height={45} accessibilityLabel="Trainwise" style={styles.logo} />

      <View style={styles.nav}>
        {entries.map((entry) => (
          <SidebarRow key={entry.href} entry={entry} active={active(entry.href)} onPress={() => router.navigate(entry.href as never)} />
        ))}
      </View>

      <View style={styles.bottom}>
        <SidebarRow
          entry={{ href: '/pro/notifications', label: 'Notifications', icon: 'bell', badge: unreadNotifications || undefined }}
          active={pathname.startsWith('/pro/notifications')}
          onPress={() => router.push('/pro/notifications')}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mon profil"
          onPress={() => router.navigate('/pro/profil')}
          style={({ pressed }) => [styles.account, { borderTopColor: colors.border }, pressed && { backgroundColor: colors.subtle }]}>
          <Avatar initials={initialsOf(user?.firstName, user?.lastName)} size={36} tone="violet" />
          <View style={styles.flex}>
            <Text variant="h3" numberOfLines={1}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              Espace coach
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function SidebarRow({ entry, active, onPress }: { entry: Entry; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const tint = active ? colors.ink : colors.text2;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, active && { backgroundColor: colors.subtle }, pressed && !active && { backgroundColor: colors.subtle }]}>
      <Icon name={entry.icon} size={20} color={tint} strokeWidth={active ? 2.2 : 2} />
      <Text style={{ flex: 1, color: tint, fontFamily: active ? fontFamily.bold : fontFamily.medium }}>{entry.label}</Text>
      {entry.badge ? (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Text style={styles.badgeLabel}>{entry.badge > 99 ? '99+' : entry.badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { width: layout.sidebarWidth, borderRightWidth: 1, paddingHorizontal: 12, paddingTop: 20, paddingBottom: 12 },
  logo: { marginLeft: 10, marginBottom: 24 },
  nav: { flex: 1, gap: 4 },
  bottom: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 44, paddingHorizontal: 12, borderRadius: radius.md },
  account: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, paddingTop: 12, paddingHorizontal: 8, paddingBottom: 4, borderTopWidth: 1 },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeLabel: { color: '#FFFFFF', fontSize: 11, lineHeight: 13, fontFamily: fontFamily.semibold },
});
