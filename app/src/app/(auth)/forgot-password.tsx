import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackBar, Button, Card, Field, FormError, Icon, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Adresse email invalide.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const { message } = await api<{ message: string }>('/api/auth/forgot-password', { method: 'POST', body: { email: email.trim() } });
      setSentMessage(message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Envoi impossible.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <BackBar />
      <View style={styles.container}>
        <Text variant="h1" style={styles.title}>
          Mot de passe oublié
        </Text>

        {sentMessage ? (
          <Card style={styles.sent}>
            <View style={[styles.sentIcon, { backgroundColor: colors.successSoft }]}>
              <Icon name="mail" size={22} color={colors.successInk} />
            </View>
            <Text variant="h2">Vérifie ta boîte mail</Text>
            <Text variant="body2">{sentMessage}</Text>
            <Text variant="small">Le lien est valable 30 minutes et s’ouvre dans ton navigateur pour choisir un nouveau mot de passe.</Text>
            <Button label="Retour à la connexion" fullWidth onPress={() => router.back()} style={styles.back} />
          </Card>
        ) : (
          <>
            <Text variant="body2" style={styles.intro}>
              Saisis l’email de ton compte, on t’envoie un lien pour choisir un nouveau mot de passe.
            </Text>
            <Field
              label="Email"
              icon="mail"
              placeholder="ton@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={submit}
              value={email}
              onChangeText={setEmail}
            />
            <FormError message={error} style={styles.error} />
            <Button label={sending ? 'Envoi…' : 'Envoyer le lien'} fullWidth disabled={sending} onPress={submit} style={styles.submit} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: layout.gutter + 4, paddingBottom: 24 },
  title: { fontSize: 28, lineHeight: 36, marginTop: 8 },
  intro: { marginTop: 4, marginBottom: 24 },
  error: { marginTop: 20 },
  submit: { marginTop: 24 },
  sent: { gap: 8, marginTop: 24 },
  sentIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  back: { marginTop: 12 },
});
