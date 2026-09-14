import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { BRAND } from '@/components/ui/brand-svg';
import { Button, Field, FormError, Icon, Screen, Text } from '@/components/ui';
import { DEMO_ENABLED, useSession } from '@/features/auth/session';
import { useTheme } from '@/theme/theme-provider';
import { fontFamily } from '@/theme/typography';

export default function LoginScreen() {
  const { scheme, colors } = useTheme();
  const router = useRouter();
  const { signIn, enterDemo } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Une fois connecté, la navigation protégée bascule d'elle-même vers l'espace athlète.
  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Renseigne ton email et ton mot de passe.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Connexion impossible.');
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']} scroll={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <SvgXml xml={scheme === 'dark' ? BRAND.logoDark : BRAND.logoLight} width={102} height={48} accessibilityLabel="Trainwise" />
        <View style={styles.heading}>
          <Text variant="h1" style={styles.title}>
            Connexion
          </Text>
          <Text variant="body2">Retrouve ton planning et tes séances.</Text>
        </View>
        <View style={styles.form}>
          <Field
            label="Email"
            icon="mail"
            placeholder="ton@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            label="Mot de passe"
            icon="lock"
            placeholder="Ton mot de passe"
            secureTextEntry={!showPassword}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            value={password}
            onChangeText={setPassword}
            trailing={
              <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onPress={() => setShowPassword((value) => !value)} hitSlop={12}>
                <Icon name="eye" size={20} color={colors.text3} />
              </Pressable>
            }
          />
          <Pressable accessibilityRole="link" style={styles.forgot} hitSlop={8} onPress={() => router.push('/forgot-password')}>
            <Text variant="small" color="accentInk" style={{ fontFamily: fontFamily.medium }}>
              Mot de passe oublié ?
            </Text>
          </Pressable>
        </View>
        <FormError message={error} style={styles.error} />
        <Button label={submitting ? 'Connexion…' : 'Se connecter'} fullWidth disabled={submitting} onPress={submit} style={styles.submit} />
        {DEMO_ENABLED ? <Button label="Explorer la démo" variant="ghost" fullWidth onPress={enterDemo} style={styles.demo} /> : null}
        <View style={styles.flex} />
        <View style={styles.signup}>
          <Text variant="body2">Pas encore de compte ?</Text>
          <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push('/register')}>
            <Text variant="h3" color="accentInk">
              S’inscrire
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 24 },
  heading: { gap: 4, marginTop: 40 },
  title: { fontSize: 28, lineHeight: 36 },
  form: { gap: 14, marginTop: 28 },
  forgot: { alignSelf: 'flex-end' },
  error: { marginTop: 20 },
  submit: { marginTop: 24 },
  demo: { marginTop: 8 },
  signup: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
});
