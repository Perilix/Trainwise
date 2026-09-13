import { Stack } from 'expo-router';

import { useTheme } from '@/theme/theme-provider';

// Espace athlète : onglets + écrans poussés par-dessus (détail de sortie, profil, notifications).
export default function AthleteLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
