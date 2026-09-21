import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { BackBar, Button, Card, ChoicePill, Field, FormError, Screen, Section, Text } from '@/components/ui';
import { useBringIntoView } from '@/components/ui/keyboard-scroll';
import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

const SUBJECTS = [
  { value: 'question', label: 'Une question' },
  { value: 'bug', label: 'Un problème' },
  { value: 'compte', label: 'Mon compte' },
  { value: 'donnees', label: 'Mes données' },
  { value: 'suggestion', label: 'Une suggestion' },
  { value: 'autre', label: 'Autre' },
] as const;

/**
 * Nous contacter.
 *
 * Le message part dans le back-office plutôt que dans une boîte mail : on sait
 * ce qui reste à traiter, et l'utilisateur n'a pas besoin d'un client mail
 * configuré pour nous joindre.
 */
export function ContactScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useSession();
  const areaRef = useRef<TextInput>(null);
  const bringIntoView = useBringIntoView();

  const [name, setName] = useState(() => `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim());
  const [email, setEmail] = useState(() => user?.email ?? '');
  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]['value']>('question');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && message.trim().length > 9;

  const submit = async () => {
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    try {
      await api('/api/contact', {
        method: 'POST',
        body: {
          name: name.trim(),
          email: email.trim(),
          subject,
          message: message.trim(),
          source: 'app',
          // De quoi reproduire un problème sans redemander.
          platform: `${Platform.OS} ${Platform.Version}`,
          appVersion: Constants.expoConfig?.version ?? undefined,
        },
      });
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Envoi impossible. Réessayez dans un instant.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Screen>
        <BackBar title="Nous contacter" />
        <Section>
          <Card style={styles.done}>
            <Text variant="h2">Message envoyé</Text>
            <Text variant="body2">Merci. On vous répond à {email.trim()}, sous deux jours ouvrés.</Text>
            <Button label="Revenir au profil" icon="check" fullWidth onPress={() => router.back()} />
          </Card>
        </Section>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <FormError message={error} />
          <Button label={sending ? 'Envoi…' : 'Envoyer'} icon="send" fullWidth disabled={!valid || sending} onPress={submit} />
        </View>
      }>
      <BackBar title="Nous contacter" />

      <Section style={styles.tight}>
        <Text variant="body2">Une question, un problème, une idée : écrivez-nous. On lit tout, et on répond sous deux jours ouvrés.</Text>
      </Section>

      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <Field label="Votre nom" value={name} onChangeText={setName} autoComplete="name" />
          <Field label="Votre email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        </Card>
      </Section>

      <Section style={styles.tight}>
        <Card>
          <Text variant="sectionTitle">Sujet</Text>
          <View style={styles.pills}>
            {SUBJECTS.map((option) => (
              <ChoicePill key={option.value} label={option.label} selected={subject === option.value} onPress={() => setSubject(option.value)} />
            ))}
          </View>
        </Card>
      </Section>

      <Section>
        <Card>
          <Text variant="sectionTitle">Votre message</Text>
          <TextInput
            ref={areaRef}
            onFocus={() => bringIntoView(areaRef.current)}
            accessibilityLabel="Votre message"
            placeholder="Décrivez votre demande. Pour un problème, dites-nous ce que vous faisiez au moment où il est survenu."
            placeholderTextColor={colors.text3}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={4000}
            style={[styles.message, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.ink }]}
          />
          <Text variant="caption">Les informations saisies ne servent qu’à traiter votre demande.</Text>
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tight: { paddingBottom: 12 },
  gap: { gap: 14 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  message: { minHeight: 150, marginTop: 10, marginBottom: 10, padding: 12, borderWidth: 1, borderRadius: radius.md, fontFamily: fontFamily.regular, fontSize: 14, textAlignVertical: 'top' },
  done: { gap: 10, alignItems: 'flex-start' },
  footer: { gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
});
