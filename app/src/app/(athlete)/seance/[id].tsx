import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackBar, Button, Screen, StateView, Text } from '@/components/ui';
import { useAthleteActions, usePlannedSession } from '@/features/athlete/queries';
import { PlannedSessionBody } from '@/features/sessions/planned-session-body';
import { emitAppEvent } from '@/lib/app-events';
import { layout } from '@/theme/tokens';

export default function PlannedSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: session, loading, error, refetch } = usePlannedSession(id);
  const { skipSession, completeSession, reopenSession } = useAthleteActions();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  let footer: React.ReactNode;
  if (session.status === 'planned') {
    footer = (
      <View style={styles.footer}>
        {actionError ? (
          <Text variant="small" color="danger">
            {actionError}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button label="Passer" variant="secondary" disabled={busy} onPress={() => act(() => skipSession(session.id))} style={styles.flex} />
          {running ? (
            <Button label="Séance faite" icon="check" disabled={busy} onPress={() => act(() => completeSession(session.id))} style={styles.flex} />
          ) : (
            <Button label="Commencer" icon="dumbbell" disabled={busy} onPress={() => router.push({ pathname: '/muscu/[id]', params: { id: session.id } })} style={styles.flex} />
          )}
        </View>
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
