import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackBar, Button, FormError, Screen, StateView, Text } from '@/components/ui';
import type { PlannedSessionDetail } from '@/features/athlete/types';
import { useShareSession } from '@/features/chat/share-session';
import { useCoachActions, useCoachPlannedSession } from '@/features/coach/queries';
import { DateStepper } from '@/features/sessions/date-stepper';
import { PlannedSessionBody } from '@/features/sessions/planned-session-body';
import { emitAppEvent, onAppEvent } from '@/lib/app-events';
import { addDays } from '@/lib/dates';
import { formatDayLong, formatDecimal, formatHoursMinutes, parseDay, toIsoDay } from '@/lib/format';
import { layout } from '@/theme/tokens';

type Mode = 'idle' | 'duplicate' | 'delete';

export default function CoachPlannedSessionScreen() {
  const { id, planId } = useLocalSearchParams<{ id: string; planId: string }>();
  const router = useRouter();
  const { data: session, loading, error, refetch } = useCoachPlannedSession(id, planId);
  const { duplicateAthleteSession, deleteAthleteSession } = useCoachActions();
  const shareSession = useShareSession();
  const [mode, setMode] = useState<Mode>('idle');
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Revient de l'éditeur : la séance a pu changer.
  useEffect(() => onAppEvent('sessions:changed', refetch), [refetch]);

  if (!session) {
    return (
      <Screen>
        <BackBar />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  // Par défaut, la même séance une semaine plus tard.
  const target = targetDate ?? toIsoDay(addDays(parseDay(session.date), 7));
  const done = session.status === 'done';

  const changeMode = (next: Mode) => {
    setMode(next);
    setActionError(null);
    setNotice(null);
  };

  const duplicate = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await duplicateAthleteSession(id, session.id, target);
      emitAppEvent('sessions:changed');
      setMode('idle');
      setTargetDate(null);
      setNotice(`Séance dupliquée au ${formatDayLong(target).toLowerCase()}.`);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Duplication impossible.');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!session) return;
    setBusy(true);
    setActionError(null);
    try {
      await shareSession(id, `Séance du ${formatDayLong(session.date).toLowerCase()} : ${session.title}`, {
        kind: 'planned',
        id: session.id,
        sport: session.sport,
        title: session.title,
        date: session.date,
        meta: sessionMeta(session),
      });
      setNotice('Séance envoyée dans la conversation.');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  };

  const openDone = () =>
    session.sport === 'running' && session.linkedRunId
      ? router.push({ pathname: '/pro/athletes/[id]/sortie/[runId]', params: { id, runId: session.linkedRunId } })
      : router.push({ pathname: '/pro/athletes/[id]/muscu/[sessionId]', params: { id, sessionId: session.id, from: 'planned' } });

  const remove = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await deleteAthleteSession(id, session.id);
      emitAppEvent('sessions:changed');
      router.back();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Suppression impossible.');
      setBusy(false);
    }
  };

  let footer: React.ReactNode;
  if (mode === 'duplicate') {
    footer = (
      <View style={styles.footer}>
        <DateStepper date={target} onChange={setTargetDate} label="Dupliquer au" />
        <FormError message={actionError} />
        <View style={styles.actions}>
          <Button label="Annuler" variant="secondary" disabled={busy} onPress={() => changeMode('idle')} style={styles.flex} />
          <Button label={busy ? 'Duplication…' : 'Dupliquer'} icon="copy" disabled={busy} onPress={duplicate} style={styles.flex} />
        </View>
      </View>
    );
  } else if (mode === 'delete') {
    footer = (
      <View style={styles.footer}>
        <Text variant="body2">Supprimer cette séance du planning de l’athlète ? Il ne la verra plus.</Text>
        <FormError message={actionError} />
        <View style={styles.actions}>
          <Button label="Annuler" variant="secondary" disabled={busy} onPress={() => changeMode('idle')} style={styles.flex} />
          <Button label={busy ? 'Suppression…' : 'Supprimer'} icon="x" disabled={busy} onPress={remove} style={styles.flex} />
        </View>
      </View>
    );
  } else {
    footer = (
      <View style={styles.footer}>
        {notice ? (
          <Text variant="small" color="successInk" accessibilityRole="alert">
            {notice}
          </Text>
        ) : null}
        <FormError message={actionError} />
        {done ? <Button label="Voir le réalisé" icon="chart" fullWidth onPress={openDone} /> : null}
        <Button
          label="Modifier la séance"
          icon="pen"
          variant={done ? 'secondary' : 'primary'}
          fullWidth
          onPress={() => router.push({ pathname: '/pro/athletes/[id]/editeur', params: { id, planId: session.id } })}
        />
        <View style={styles.actions}>
          <Button label={busy ? 'Envoi…' : 'Envoyer'} variant="secondary" size="sm" icon="message" disabled={busy} onPress={share} style={styles.flex} />
          <Button label="Dupliquer" variant="secondary" size="sm" icon="copy" onPress={() => changeMode('duplicate')} style={styles.flex} />
        </View>
        <Button label="Supprimer du planning" variant="danger" size="sm" icon="x" fullWidth onPress={() => changeMode('delete')} />
      </View>
    );
  }

  return (
    <Screen footer={footer}>
      <BackBar />
      <PlannedSessionBody session={session} plannedByLabel={session.plannedBy === 'coach' ? 'Planifiée par vous' : 'Ajoutée par l’athlète'} />
    </Screen>
  );
}

// Résumé court affiché dans la carte du message.
function sessionMeta(session: PlannedSessionDetail) {
  return session.sport === 'running'
    ? [session.distanceKm ? `${formatDecimal(session.distanceKm)} km` : null, session.durationMin ? formatHoursMinutes(session.durationMin * 60) : null].filter(Boolean).join(' · ')
    : [session.exercisesCount ? `${session.exercisesCount} exercices` : null, session.durationMin ? formatHoursMinutes(session.durationMin * 60) : null].filter(Boolean).join(' · ');
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { gap: 10, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
  actions: { flexDirection: 'row', gap: 8 },
});
