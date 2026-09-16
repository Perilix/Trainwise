import { Stack } from 'expo-router';

import { usePushNotifications } from '@/features/notifications/use-push-notifications';
import { SocketProvider } from '@/features/realtime/socket-provider';
import { useTheme } from '@/theme/theme-provider';

// Espace athlète : onglets + écrans poussés par-dessus (détail de sortie, profil, notifications).
export default function AthleteLayout() {
  const { colors } = useTheme();
  usePushNotifications();

  return (
    <SocketProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </SocketProvider>
  );
}
