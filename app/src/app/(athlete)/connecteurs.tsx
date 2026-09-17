import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { BackBar, Button, Card, Chip, Icon, Screen, Section, StateView, Text, type IconName } from '@/components/ui';
import { useAthleteActions, useAthleteProfile, type StravaImportResult } from '@/features/athlete/queries';
import { StravaImportModal } from '@/features/athlete/strava-import-modal';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

type Connector = { id: string; name: string; purpose: string; icon: IconName };

// Strava est branché ; les autres arrivent. Ils restent affichés pour que
// l'athlète sache ce qu'on prépare, en gris pour qu'on ne les confonde pas
// avec un connecteur utilisable.
const SOON: Connector[] = [
  { id: 'garmin', name: 'Garmin Connect', purpose: 'Forerunner, Fenix, Venu', icon: 'watch' },
  { id: 'polar', name: 'Polar Flow', purpose: 'Vantage, Pacer, Grit X', icon: 'watch' },
  { id: 'coros', name: 'COROS', purpose: 'Pace, Apex, Vertix', icon: 'watch' },
  { id: 'suunto', name: 'Suunto', purpose: 'Race, Vertical, 9', icon: 'watch' },
  { id: 'apple-sante', name: 'Apple Santé', purpose: 'Séances de l’Apple Watch', icon: 'heart' },
];

/** Connecteurs : d'où viennent les séances importées automatiquement. */
export default function ConnectorsScreen() {
  const { colors } = useTheme();
  const { data: profile, loading, error, refetch } = useAthleteProfile();
  const { connectStrava, disconnectStrava } = useAthleteActions();
  const [busy, setBusy] = useState(false);
  const [stravaImport, setStravaImport] = useState<StravaImportResult | null>(null);

  const linkStrava = async () => {
    setBusy(true);
    try {
      const result = await connectStrava((progress) => setStravaImport(progress));
      if (!result) {
        setStravaImport(null);
        return;
      }
      setStravaImport(result);
      refetch();
    } catch (reason) {
      setStravaImport(null);
      Alert.alert('Strava', reason instanceof Error ? reason.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  };

  const unlinkStrava = () =>
    Alert.alert('Délier Strava', 'Tes sorties ne seront plus importées automatiquement. Les séances déjà enregistrées sont conservées.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Délier',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await disconnectStrava();
            refetch();
          } catch (reason) {
            Alert.alert('Strava', reason instanceof Error ? reason.message : 'Déconnexion impossible.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  if (!profile) {
    return (
      <Screen>
        <BackBar title="Connecteurs" />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const connected = profile.strava.connected;

  return (
    <Screen>
      <BackBar title="Connecteurs" />
      <StravaImportModal result={stravaImport} onClose={() => setStravaImport(null)} />

      <Section style={styles.tight}>
        <Text variant="body2">
          Relie tes applications et tes montres : tes séances arrivent alors toutes seules dans Trainwise, avec leurs allures, leur fréquence cardiaque et leur
          tracé.
        </Text>
      </Section>

      <Section style={styles.tight}>
        <Text variant="sectionTitle" style={styles.groupTitle}>
          Disponible
        </Text>
        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.tile, { backgroundColor: colors.stravaSoft }]}>
              <Icon name="activity" size={22} color={colors.stravaInk} strokeWidth={2} />
            </View>
            <View style={styles.flex}>
              <Text variant="h3">Strava</Text>
              <Text variant="small">Course, trail, vélo</Text>
            </View>
            {connected ? <Chip label="Connecté" tone="success" icon="check" /> : <Chip label="Non connecté" />}
          </View>

          <View style={[styles.status, { borderTopColor: colors.border }]}>
            <View style={[styles.dot, { backgroundColor: connected ? colors.success : colors.text3 }]} />
            <Text variant="small" style={styles.flex}>
              {connected ? `Import automatique actif · depuis le ${profile.strava.since}` : 'Tes sorties ne sont pas importées pour l’instant.'}
            </Text>
          </View>

          {connected ? (
            <Button label={busy ? 'Déliaison…' : 'Délier Strava'} variant="secondary" fullWidth disabled={busy} onPress={unlinkStrava} />
          ) : (
            <Button label={busy ? 'Connexion…' : 'Connecter Strava'} fullWidth disabled={busy} onPress={linkStrava} />
          )}
        </Card>
      </Section>

      <Section>
        <Text variant="sectionTitle" style={styles.groupTitle}>
          Bientôt
        </Text>
        <Card padding={0}>
          {SOON.map((connector, index) => (
            <View key={connector.id} style={[styles.soonRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <View style={[styles.tile, { backgroundColor: colors.subtle }]}>
                <Icon name={connector.icon} size={20} color={colors.text3} />
              </View>
              <View style={styles.flex}>
                <Text variant="h3">{connector.name}</Text>
                <Text variant="small">{connector.purpose}</Text>
              </View>
              <Chip label="Bientôt" />
            </View>
          ))}
        </Card>
        <Text variant="caption" style={styles.note}>
          En attendant, les séances d’une montre Garmin, Polar, COROS ou Suunto arrivent déjà dans Trainwise si elles se synchronisent avec Strava.
        </Text>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tight: { paddingBottom: 12 },
  card: { gap: 14 },
  groupTitle: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, borderTopWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  soonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  note: { marginTop: 10 },
});
