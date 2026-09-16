import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { BackBar, Button, Field, FormError, Icon, Screen, Text } from '@/components/ui';
import { useSession, type SignUpInput } from '@/features/auth/session';
import { SocialSignInButtons } from '@/features/auth/social-buttons';
import { useTheme } from '@/theme/theme-provider';
import { layout } from '@/theme/tokens';

type Form = SignUpInput & { confirm: string };

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

function validate(form: Form) {
  if (!form.firstName.trim() || !form.lastName.trim()) return 'Renseigne ton prénom et ton nom.';
  if (!EMAIL_PATTERN.test(form.email.trim())) return 'Adresse email invalide.';
  if (form.password.length < 6) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (form.password !== form.confirm) return 'Les mots de passe ne correspondent pas.';
  return null;
}

export default function RegisterScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signUp } = useSession();
  const [form, setForm] = useState<Form>({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof Form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  // Compte créé = session ouverte : la navigation protégée bascule d'elle-même vers l'espace athlète.
  const submit = async () => {
    const problem = validate(form);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signUp(form);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Inscription impossible.');
      setSubmitting(false);
    }
  };

  const eye = (
    <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onPress={() => setShowPassword((value) => !value)} hitSlop={12}>
      <Icon name="eye" size={20} color={colors.text3} />
    </Pressable>
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BackBar />
        <View style={styles.container}>
          <View style={styles.heading}>
            <Text variant="h1" style={styles.title}>
              Créer un compte
            </Text>
            <Text variant="body2">Suis tes séances et échange avec ton coach.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Field icon="user" label="Prénom" placeholder="Thomas" autoComplete="given-name" textContentType="givenName" value={form.firstName} onChangeText={update('firstName')} />
              </View>
              <View style={styles.flex}>
                <Field icon="user" label="Nom" placeholder="Dubois" autoComplete="family-name" textContentType="familyName" value={form.lastName} onChangeText={update('lastName')} />
              </View>
            </View>
            <Field
              label="Email"
              icon="mail"
              placeholder="ton@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              value={form.email}
              onChangeText={update('email')}
            />
            <Field
              label="Mot de passe"
              icon="lock"
              placeholder="6 caractères minimum"
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              textContentType="newPassword"
              value={form.password}
              onChangeText={update('password')}
              trailing={eye}
            />
            <Field
              label="Confirmation"
              icon="lock"
              placeholder="Retape ton mot de passe"
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
              value={form.confirm}
              onChangeText={update('confirm')}
            />
          </View>

          <FormError message={error} style={styles.error} />
          <Button label={submitting ? 'Création…' : 'Créer mon compte'} fullWidth disabled={submitting} onPress={submit} style={styles.submit} />
          <SocialSignInButtons label="continuer" />

          <View style={styles.signin}>
            <Text variant="body2">Déjà un compte ?</Text>
            <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.back()}>
              <Text variant="h3" color="accentInk">
                Se connecter
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { paddingHorizontal: layout.gutter + 4, paddingBottom: 24 },
  heading: { gap: 4, marginTop: 8 },
  title: { fontSize: 28, lineHeight: 36 },
  form: { gap: 14, marginTop: 24 },
  row: { flexDirection: 'row', gap: 12 },
  error: { marginTop: 20 },
  submit: { marginTop: 24 },
  signin: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 24 },
});
