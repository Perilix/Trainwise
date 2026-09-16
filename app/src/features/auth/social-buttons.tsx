import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { FormError, Text } from '@/components/ui';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

import { useSession } from './session';
import { appleAvailable, googleAvailable, SocialSignInCancelled } from './social-sign-in';

// Marque Google : le « G » quadrichrome est imposé par les règles de Google.
const GOOGLE_G = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
<path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z"/>
<path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.700-3.9-12.4-9.1H4.2v5.7C7.8 41.1 15.3 46 24 46z"/>
<path fill="#FBBC05" d="M11.6 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.2C2.8 17.1 2 20.4 2 24s.8 6.9 2.2 9.8l7.4-5.7z"/>
<path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.3 2 7.8 6.9 4.2 14.2l7.4 5.7c1.7-5.2 6.6-9.1 12.4-9.1z"/>
</svg>`;

type Props = {
  /** « Continuer avec » à l'inscription, « Se connecter avec » à la connexion. */
  label: 'continuer' | 'connexion';
};

/** Connexion Google et Apple, sous le bouton principal des écrans d'authentification. */
export function SocialSignInButtons({ label }: Props) {
  const { colors, scheme } = useTheme();
  const { signInWithGoogle, signInWithApple } = useSession();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    appleAvailable().then(setApple, () => setApple(false));
  }, []);

  const google = googleAvailable();
  if (!google && !apple) return null;

  const run = async (provider: 'google' | 'apple', action: () => Promise<void>) => {
    setBusy(provider);
    setError(null);
    try {
      await action();
    } catch (reason) {
      if (!(reason instanceof SocialSignInCancelled)) {
        setError(reason instanceof Error ? reason.message : 'Connexion impossible.');
      }
      setBusy(null);
    }
  };

  const prefix = label === 'continuer' ? 'Continuer avec' : 'Se connecter avec';

  return (
    <View style={styles.container}>
      <View style={styles.separator}>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <Text variant="caption">ou</Text>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>

      {google ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${prefix} Google`}
          accessibilityState={{ disabled: busy !== null }}
          disabled={busy !== null}
          onPress={() => run('google', signInWithGoogle)}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.surface, borderColor: colors.borderStrong },
            pressed && styles.pressed,
            busy === 'apple' && styles.disabled,
          ]}>
          <SvgXml xml={GOOGLE_G} width={20} height={20} />
          <Text style={[styles.label, { color: colors.ink }]}>{busy === 'google' ? 'Connexion…' : `${prefix} Google`}</Text>
        </Pressable>
      ) : null}

      {apple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            label === 'continuer'
              ? AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
              : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
          }
          buttonStyle={
            scheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={radius.md}
          style={styles.apple}
          onPress={() => run('apple', signInWithApple)}
        />
      ) : null}

      <FormError message={error} style={styles.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, marginTop: 20 },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  line: { flex: 1, height: 1 },
  button: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  label: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20 },
  apple: { height: 48 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  error: { marginTop: 4 },
});
