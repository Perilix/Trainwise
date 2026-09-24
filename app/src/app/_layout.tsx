import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold, useFonts } from '@expo-google-fonts/poppins';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/ui';
import { isCoach, SessionProvider, useSession } from '@/features/auth/session';
import { AppThemeProvider, useTheme } from '@/theme/theme-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    // Police de marque, réservée aux titres et aux grands chiffres.
    GulfsDisplay: require('../../assets/fonts/GulfsDisplay-Regular.ttf'),
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <SessionProvider>
          <ToastProvider>
            <ThemedNavigation />
          </ToastProvider>
        </SessionProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedNavigation() {
  const { scheme, colors } = useTheme();
  const { status, user } = useSession();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  // L'écran de lancement reste affiché tant que la session n'est pas restaurée.
  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;
  const signedIn = status === 'signedIn' || status === 'demo';
  const coach = signedIn && isCoach(user);

  return (
    <NavigationThemeProvider
      value={{
        ...base,
        dark: scheme === 'dark',
        colors: { ...base.colors, background: colors.bg, card: colors.surface, text: colors.ink, border: colors.border, primary: colors.primary },
      }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={signedIn && !coach}>
          <Stack.Screen name="(athlete)" />
        </Stack.Protected>
        <Stack.Protected guard={coach}>
          <Stack.Screen name="pro" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Screen name="design-system" />
      </Stack>
    </NavigationThemeProvider>
  );
}
