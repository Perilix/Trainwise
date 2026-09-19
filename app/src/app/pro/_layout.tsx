import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useAllChatUnreadCount } from '@/features/athlete/queries';
import { usePushNotifications } from '@/features/notifications/use-push-notifications';
import { SocketProvider, useSocketEvent } from '@/features/realtime/socket-provider';
import { CoachSidebar } from '@/features/shell/coach-sidebar';
import { onAppEvent } from '@/lib/app-events';
import { useIsDesktop } from '@/lib/use-layout';
import { useTheme } from '@/theme/theme-provider';

// Espace coach : onglets + écrans poussés par-dessus (fiche athlète, conversation, invitation…).
export default function CoachLayout() {
  usePushNotifications();

  return (
    <SocketProvider>
      <CoachShell />
    </SocketProvider>
  );
}

/** Le socket est au-dessus : la barre latérale peut compter les messages non lus. */
function CoachShell() {
  const { colors } = useTheme();
  const desktop = useIsDesktop();
  const { data: unreadMessages, refetch } = useAllChatUnreadCount();

  useSocketEvent('message:new', refetch);
  useEffect(() => onAppEvent('chat:read', refetch), [refetch]);

  const stack = <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
  if (!desktop) return stack;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
      <CoachSidebar unreadMessages={unreadMessages} />
      <View style={{ flex: 1 }}>{stack}</View>
    </View>
  );
}
