import { Stack } from 'expo-router';

import { usePushNotifications } from '@/features/notifications/use-push-notifications';
import { SocketProvider } from '@/features/realtime/socket-provider';
import { useTheme } from '@/theme/theme-provider';

// Espace coach : onglets + écrans poussés par-dessus (fiche athlète, conversation, invitation…).
export default function CoachLayout() {
  const { colors } = useTheme();
  usePushNotifications();

  return (
    <SocketProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </SocketProvider>
  );
}
