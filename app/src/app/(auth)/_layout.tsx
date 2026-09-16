import { Stack } from 'expo-router';

import { useTheme } from '@/theme/theme-provider';

// Écrans hors connexion ; la connexion reste en bas de pile quand on ouvre l'inscription ou le mot de passe oublié.
export const unstable_settings = { initialRouteName: 'login' };

export default function AuthLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
