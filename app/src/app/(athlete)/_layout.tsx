import { Stack } from 'expo-router';

import { usePushNotifications } from '@/features/notifications/use-push-notifications';
import { useTheme } from '@/theme/theme-provider';

// Espace athlète : onglets + écrans poussés par-dessus (détail de sortie, profil, notifications).
export default function AthleteLayout() {
  const { colors } = useTheme();
  usePushNotifications();

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
