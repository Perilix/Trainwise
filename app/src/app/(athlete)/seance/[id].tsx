import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackBar, Button, FeelingSlider, Field, FormError, Screen, StateView, Text } from '@/components/ui';
import { useAthleteActions, usePlannedSession } from '@/features/athlete/queries';
import { PlannedSessionBody } from '@/features/sessions/planned-session-body';
import { emitAppEvent } from '@/lib/app-events';
import { parseDecimal } from '@/lib/format';
import { layout } from '@/theme/tokens';

export default function PlannedSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: session, loading, error, refetch } = usePlannedSession(id);
  const { skipSession, completeSession, reopenSession, logRun } = useAthleteActions();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Saisie manuelle du réalisé, quand Strava n'a pas importé la sortie.
  const [detailing, setDetailing] = useState(false);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [feeling, setFeeling] = useState(7);
  const [notes, setNotes] = useState('');

  if (!session) {
    return (
      <Screen>
        <BackBar />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      emitAppEvent('sessions:changed');
      refetch();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  };

  const running = session.sport === 'running';
  const linkedRunId = session.linkedRunId;

  // Enregistrer la sortie plutôt que cocher la séance : l'API rattache la séance prévue
  // du jour, garde ce que le coach avait demandé et le prévient.
  const saveDone = async () => {
    const km = parseDecimal(distance);
    const minutes = parseDecimal(duration);
    if (distance.trim() && km === undefined) return setActionError('La distance doit être un nombre, en kilomètres.');
    if (duration.trim() && minutes === undefined) return setActionError('La durée doit être un nombre, en minutes.');

    setBusy(true);
    setActionError(null);
    try {
      await logRun({ date: session.date, distanceKm: km, durationMin: minutes, feeling, notes: notes.trim(), sessionType: session.sessionType });
      emitAppEvent('sessions:changed');
      router.back();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
      setBusy(false);
    }
  };

  let footer: React.ReactNode;
  if (detailing) {
    footer = (
      <View style={styles.footer}>
        <Text variant="sectionTitle">Ce que tu as fait</Text>
        <View style={styles.actions}>
          <Field label="Distance (km)" placeholder="10,4" keyboardType="decimal-pad" value={distance} onChangeText={setDistance} containerStyle={styles.flex} />
          <Field label="Durée (min)" placeholder="58" keyboardType="number-pad" value={duration} onChangeText={setDuration} containerStyle={styles.flex} />
        </View>
        <Field placeholder="Sensations, allures tenues, ce que tu as adapté…" multiline value={notes} onChangeText={setNotes} />
        <Text variant="caption">Ressenti · {feeling}/10</Text>
        <FeelingSlider value={feeling} onChange={setFeeling} />
        <FormError message={actionError} />
        <View style={styles.actions}>
          <Button label="Annuler" variant="secondary" disabled={busy} onPress={() => setDetailing(false)} style={styles.flex} />
          <Button label={busy ? 'Enregistrement…' : 'Enregistrer'} icon="check" disabled={busy} onPress={saveDone} style={styles.flex} />
        </View>
      </View>
    );
  } else if (session.status === 'planned') {
    footer = (
      <View style={styles.footer}>
        <FormError message={actionError} />
        <View style={styles.actions}>
          <Button label="Passer" variant="secondary" disabled={busy} onPress={() => act(() => skipSession(session.id))} style={styles.flex} />
          {running ? (
            <Button label="Séance faite" icon="check" disabled={busy} onPress={() => setDetailing(true)} style={styles.flex} />
          ) : (
            <Button label="Commencer" icon="dumbbell" disabled={busy} onPress={() => router.push({ pathname: '/muscu/[id]', params: { id: session.id } })} style={styles.flex} />
          )}
        </View>
        {running ? (
          <Button label="Juste la cocher, sans détail" variant="ghost" size="sm" fullWidth disabled={busy} onPress={() => act(() => completeSession(session.id))} />
        ) : null}
      </View>
    );
  } else if (session.status === 'skipped') {
    footer = (
      <View style={styles.footer}>
        <Button label="Remettre à faire" variant="secondary" icon="rotate" fullWidth disabled={busy} onPress={() => act(() => reopenSession(session.id))} />
      </View>
    );
  } else if (linkedRunId) {
    footer = (
      <View style={styles.footer}>
        <Button label="Voir la sortie" icon="route" fullWidth onPress={() => router.push({ pathname: '/sortie/[id]', params: { id: linkedRunId } })} />
      </View>
    );
  }

  return (
    <Screen footer={footer}>
      <BackBar />
      <PlannedSessionBody session={session} plannedByLabel={session.plannedBy === 'coach' ? `Planifiée par ${session.coachName ?? 'ton coach'}` : 'Ajoutée par toi'} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { gap: 8, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
  actions: { flexDirection: 'row', gap: 8 },
});
