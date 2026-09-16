import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, BackBar, Button, Card, Field, FormError, Screen, Section, SectionHeader, Text } from '@/components/ui';
import { useAthleteActions, useCoachInvitations } from '@/features/athlete/queries';
import { emitAppEvent } from '@/lib/app-events';
import { useTheme } from '@/theme/theme-provider';

export default function JoinCoachScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: invitations, refetch } = useCoachInvitations();
  const { joinCoach, answerInvitation } = useAthleteActions();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coach rejoint : l'onglet Coach, l'accueil et le profil se rechargent.
  const join = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      emitAppEvent('coach:changed');
      router.back();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de rejoindre ce coach.');
      setBusy(false);
    }
  };

  const submitCode = () => {
    if (!code.trim()) {
      setError('Saisis le code transmis par ton coach.');
      return;
    }
    void join(() => joinCoach(code));
  };

  const decline = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await answerInvitation(id, false);
      refetch();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Réponse impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackBar title="Rejoindre un coach" />

      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <Text variant="body2">Ton coach t’a transmis un code d’invitation ? Saisis-le pour le rejoindre : il verra tes séances et pourra te planifier des entraînements.</Text>
          <Field
            label="Code d’invitation"
            icon="users"
            placeholder="EX. CAMILLE24"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={submitCode}
            value={code}
            onChangeText={(text) => setCode(text.toUpperCase().replace(/\s/g, ''))}
          />
          <FormError message={error} />
          <Button label={busy ? 'Un instant…' : 'Rejoindre'} fullWidth disabled={busy} onPress={submitCode} />
        </Card>
      </Section>

      {invitations?.length ? (
        <Section>
          <SectionHeader title="Invitations reçues" />
          <Card padding={0} style={styles.list}>
            {invitations.map((invitation, index) => (
              <View key={invitation.id} style={[styles.invitation, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={styles.coach}>
                  <Avatar initials={invitation.initials} size={40} tone="violet" />
                  <View style={styles.flex}>
                    <Text variant="h3">{invitation.coachName}</Text>
                    {invitation.email ? <Text variant="small">{invitation.email}</Text> : null}
                  </View>
                </View>
                <View style={styles.actions}>
                  <Button label="Refuser" variant="secondary" size="sm" disabled={busy} onPress={() => decline(invitation.id)} style={styles.flex} />
                  <Button label="Accepter" size="sm" disabled={busy} onPress={() => join(() => answerInvitation(invitation.id, true))} style={styles.flex} />
                </View>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tight: { paddingBottom: 16 },
  gap: { gap: 14 },
  list: { paddingHorizontal: 16, marginTop: 12 },
  invitation: { gap: 12, paddingVertical: 14 },
  coach: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', gap: 8 },
});
