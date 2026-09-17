import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { RouteMap } from '@/components/charts/route-map';
import { BackBar, Button, Card, Chip, FeelingSlider, Field, FormError, Icon, IconButton, Screen, Section, StateView, Text } from '@/components/ui';
import { linkRunToPlanned, runMatchCandidates, type MatchCandidate } from '@/features/athlete/planned-match';
import { useAthleteActions, useRunDetail } from '@/features/athlete/queries';
import { RunDetailBody, RunHero } from '@/features/sessions/run-detail-body';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';

type Panel = 'none' | 'notes' | 'match';

export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { data: run, loading, error, refetch } = useRunDetail(id);
  const { saveRunFeeling, saveRunNotes } = useAthleteActions();
  const { width } = useWindowDimensions();
  const [feelingDraft, setFeelingDraft] = useState<number | null>(null);
  const [panel, setPanel] = useState<Panel>('none');
  const [notesDraft, setNotesDraft] = useState('');
  const [candidates, setCandidates] = useState<MatchCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  if (!run) {
    return (
      <Screen>
        <BackBar />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const feeling = feelingDraft ?? run.feeling;
  const changeFeeling = (value: number) => {
    setFeelingDraft(value);
    saveRunFeeling(run.id, value).catch(() => setFeelingDraft(null));
  };

  const openNotes = () => {
    setNotesDraft(run.notes ?? '');
    setPanelError(null);
    setPanel('notes');
  };

  const saveNotes = async () => {
    setBusy(true);
    setPanelError(null);
    try {
      await saveRunNotes(run.id, notesDraft.trim());
      setPanel('none');
      refetch();
    } catch (reason) {
      setPanelError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  // Rattachement manuel : quand l'import n'a pas reconnu la séance prévue du jour.
  const openMatch = async () => {
    setPanel('match');
    setPanelError(null);
    setCandidates(null);
    setBusy(true);
    try {
      setCandidates(await runMatchCandidates(run.id));
    } catch (reason) {
      setPanelError(reason instanceof Error ? reason.message : 'Séances prévues introuvables.');
      setCandidates([]);
    } finally {
      setBusy(false);
    }
  };

  const link = async (candidate: MatchCandidate) => {
    setBusy(true);
    setPanelError(null);
    try {
      await linkRunToPlanned(run.id, candidate.id);
      setPanel('none');
      refetch();
    } catch (reason) {
      setPanelError(reason instanceof Error ? reason.message : 'Rattachement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const openActions = () =>
    Alert.alert('Cette sortie', undefined, [
      { text: run.notes ? 'Modifier mon compte rendu' : 'Détailler ma séance', onPress: openNotes },
      { text: 'Associer à une séance prévue', onPress: openMatch },
      { text: 'Annuler', style: 'cancel' },
    ]);

  const contentWidth = width - layout.gutter * 2;

  const feelingCard = (
    <Card>
      <View style={styles.feelingHeader}>
        <Text variant="sectionTitle">Ressenti</Text>
        <View style={styles.baseline}>
          <Text variant="stat" tabular>
            {feeling ?? '—'}
          </Text>
          <Text variant="small">/10</Text>
        </View>
      </View>
      <FeelingSlider value={feeling ?? 5} onChange={changeFeeling} />
    </Card>
  );

  let footer: React.ReactNode;
  if (panel === 'notes') {
    footer = (
      <View style={styles.footer}>
        <Text variant="sectionTitle">Ce que tu as fait</Text>
        <Field
          placeholder="10 km en endurance, 2 relances à la fin, jambes lourdes…"
          multiline
          autoFocus
          value={notesDraft}
          onChangeText={setNotesDraft}
        />
        <FormError message={panelError} />
        <View style={styles.actions}>
          <Button label="Annuler" variant="secondary" disabled={busy} onPress={() => setPanel('none')} style={styles.flex} />
          <Button label={busy ? 'Enregistrement…' : 'Enregistrer'} icon="check" disabled={busy} onPress={saveNotes} style={styles.flex} />
        </View>
      </View>
    );
  } else if (panel === 'match') {
    footer = (
      <View style={styles.footer}>
        <Text variant="sectionTitle">Quelle séance prévue ?</Text>
        <Text variant="small">La séance choisie sortira du planning et sera comparée à cette sortie.</Text>
        <ScrollView style={styles.picker} contentContainerStyle={styles.pickerContent}>
          {busy && !candidates ? (
            <Text variant="body2">Chargement…</Text>
          ) : candidates?.length ? (
            candidates.map((candidate) => (
              <Pressable
                key={candidate.id}
                accessibilityRole="button"
                disabled={busy}
                onPress={() => link(candidate)}
                style={({ pressed }) => [styles.candidate, { borderColor: colors.border }, pressed && { backgroundColor: colors.subtle }]}>
                <View style={styles.flex}>
                  <Text variant="h3" numberOfLines={1}>
                    {candidate.title}
                  </Text>
                  <Text variant="small">{[candidate.dayLabel, candidate.meta].filter(Boolean).join(' · ')}</Text>
                </View>
                <Icon name="chevronRight" size={18} color={colors.text3} />
              </Pressable>
            ))
          ) : (
            <Text variant="body2">Aucune séance prévue dans les trois jours autour de cette sortie.</Text>
          )}
        </ScrollView>
        <FormError message={panelError} />
        <Button label="Fermer" variant="secondary" fullWidth disabled={busy} onPress={() => setPanel('none')} />
      </View>
    );
  }

  return (
    <Screen footer={footer}>
      <BackBar right={<IconButton icon="moreV" size={44} glass accessibilityLabel="Plus d’actions" onPress={openActions} />} />

      <Section style={styles.tight}>
        <RunHero run={run}>
          {run.fromStrava ? <Chip label="Strava" tone="strava" /> : null}
          {run.plannedBy === 'coach' ? <Chip label={`Planifiée par ${run.coachName ?? 'ton coach'}`} tone="violet" icon="user" /> : null}
        </RunHero>
      </Section>

      <Section style={styles.tight}>
        <RouteMap width={contentWidth} height={200} polyline={run.polyline} />
      </Section>

      <RunDetailBody run={run} chartWidth={contentWidth - 32} feeling={feeling} feelingCard={feelingCard} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tight: { paddingBottom: 12 },
  feelingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  footer: { gap: 10, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  picker: { maxHeight: 220 },
  pickerContent: { gap: 8, paddingVertical: 4 },
  candidate: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderRadius: radius.md },
});
