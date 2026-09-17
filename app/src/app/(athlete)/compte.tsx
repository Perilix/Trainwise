import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { BackBar, Button, Card, Field, FormError, Screen, Section, Text } from '@/components/ui';
import { useAthleteActions } from '@/features/athlete/queries';
import { useSession } from '@/features/auth/session';
import { useTheme } from '@/theme/theme-provider';

/** Compte : identité, adresse email, mot de passe, suppression du compte. */
export default function AccountScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, signOut } = useSession();
  const { updateIdentity, changeEmail, changePassword, deleteAccount } = useAthleteActions();

  const [firstName, setFirstName] = useState(() => user?.firstName ?? '');
  const [lastName, setLastName] = useState(() => user?.lastName ?? '');
  const [email, setEmail] = useState(() => user?.email ?? '');
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState<'identity' | 'email' | 'password' | null>(null);
  const [errors, setErrors] = useState<{ identity?: string; email?: string; password?: string }>({});

  const run = async (key: 'identity' | 'email' | 'password', action: () => Promise<void>, done: string) => {
    setBusy(key);
    setErrors((current) => ({ ...current, [key]: undefined }));
    try {
      await action();
      Alert.alert('Compte', done);
    } catch (reason) {
      setErrors((current) => ({ ...current, [key]: reason instanceof Error ? reason.message : 'Enregistrement impossible.' }));
    } finally {
      setBusy(null);
    }
  };

  const saveIdentity = () => {
    if (!firstName.trim() || !lastName.trim()) {
      setErrors((current) => ({ ...current, identity: 'Prénom et nom sont obligatoires.' }));
      return;
    }
    run('identity', () => updateIdentity({ firstName: firstName.trim(), lastName: lastName.trim() }), 'Ton nom a été mis à jour.');
  };

  const saveEmail = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErrors((current) => ({ ...current, email: 'Cette adresse email n’est pas valide.' }));
      return;
    }
    run(
      'email',
      async () => {
        await changeEmail(email.trim(), emailPassword);
        setEmailPassword('');
      },
      'Ton adresse email a été mise à jour.',
    );
  };

  const savePassword = () => {
    if (newPassword.length < 6) {
      setErrors((current) => ({ ...current, password: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors((current) => ({ ...current, password: 'Les deux mots de passe ne correspondent pas.' }));
      return;
    }
    run(
      'password',
      async () => {
        await changePassword(currentPassword, newPassword);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      },
      'Ton mot de passe a été changé.',
    );
  };

  // Suppression définitive : deux confirmations, puis retour à l'écran de connexion.
  const askDelete = () =>
    Alert.alert(
      'Supprimer mon compte',
      'Tes séances, ton historique et tes échanges avec ton coach seront définitivement effacés. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Dernière confirmation', 'Confirmes-tu la suppression définitive de ton compte ?', [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Supprimer définitivement',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteAccount();
                    signOut();
                  } catch (reason) {
                    Alert.alert('Compte', reason instanceof Error ? reason.message : 'Suppression impossible.');
                  }
                },
              },
            ]),
        },
      ],
    );

  return (
    <Screen>
      <BackBar title="Mon compte" />

      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <Text variant="sectionTitle">Identité</Text>
          <Field label="Prénom" autoComplete="given-name" value={firstName} onChangeText={setFirstName} />
          <Field label="Nom" autoComplete="family-name" value={lastName} onChangeText={setLastName} />
          <FormError message={errors.identity ?? null} />
          <Button label={busy === 'identity' ? 'Enregistrement…' : 'Enregistrer'} variant="secondary" disabled={busy !== null} onPress={saveIdentity} />
        </Card>
      </Section>

      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <Text variant="sectionTitle">Adresse email</Text>
          <Field label="Email" icon="mail" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} />
          <Field
            label="Mot de passe actuel"
            icon="lock"
            secureTextEntry
            autoCapitalize="none"
            placeholder="Pour confirmer que c’est bien toi"
            value={emailPassword}
            onChangeText={setEmailPassword}
          />
          <FormError message={errors.email ?? null} />
          <Button label={busy === 'email' ? 'Enregistrement…' : 'Changer mon email'} variant="secondary" disabled={busy !== null} onPress={saveEmail} />
        </Card>
      </Section>

      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <Text variant="sectionTitle">Mot de passe</Text>
          <Field label="Mot de passe actuel" icon="lock" secureTextEntry autoCapitalize="none" value={currentPassword} onChangeText={setCurrentPassword} />
          <Field label="Nouveau mot de passe" icon="lock" secureTextEntry autoCapitalize="none" value={newPassword} onChangeText={setNewPassword} />
          <Field label="Confirmer" icon="lock" secureTextEntry autoCapitalize="none" value={confirmPassword} onChangeText={setConfirmPassword} />
          <FormError message={errors.password ?? null} />
          <Button label={busy === 'password' ? 'Enregistrement…' : 'Changer mon mot de passe'} variant="secondary" disabled={busy !== null} onPress={savePassword} />
        </Card>
      </Section>

      <Section>
        <Card style={[styles.gap, { borderColor: colors.danger }]}>
          <Text variant="sectionTitle" style={{ color: colors.danger }}>
            Supprimer mon compte
          </Text>
          <Text variant="body2">Tes séances, ton historique et tes échanges seront effacés définitivement.</Text>
          <Button label="Supprimer mon compte" variant="danger" icon="x" onPress={askDelete} />
        </Card>
        <View style={styles.signOut}>
          <Button label="Se déconnecter" variant="ghost" icon="logout" onPress={() => { signOut(); router.replace('/'); }} />
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tight: { paddingBottom: 12 },
  gap: { gap: 12 },
  signOut: { marginTop: 16, alignItems: 'center' },
});
