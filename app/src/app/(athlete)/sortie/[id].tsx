import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { RoutePreview } from '@/components/charts/route-preview';
import { BackBar, Card, Chip, FeelingSlider, IconButton, Screen, Section, StateView, Text } from '@/components/ui';
import { useAthleteActions, useRunDetail } from '@/features/athlete/queries';
import { RunDetailBody } from '@/features/sessions/run-detail-body';
import { formatDayShort } from '@/lib/format';
import { layout } from '@/theme/tokens';

export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: run, loading, error, refetch } = useRunDetail(id);
  const { saveRunFeeling } = useAthleteActions();
  const { width } = useWindowDimensions();
  const [feelingDraft, setFeelingDraft] = useState<number | null>(null);

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

  const contentWidth = width - layout.gutter * 2;

  const feelingCard = (
    <Card>
      <View style={styles.feelingHeader}>
        <Text variant="h2">Ressenti</Text>
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

  return (
    <Screen>
      <BackBar right={<IconButton icon="moreV" accessibilityLabel="Plus d’actions" />} />

      <Section style={styles.titleBlock}>
        <Text variant="small">
          {formatDayShort(run.date)}
          {run.startTime ? ` · ${run.startTime}` : ''}
        </Text>
        <Text variant="h1">{run.title}</Text>
        <View style={styles.chips}>
          {run.fromStrava ? <Chip label="Strava" tone="strava" /> : null}
          {run.plannedBy === 'coach' ? <Chip label={`Planifiée par ${run.coachName ?? 'ton coach'}`} tone="violet" icon="user" /> : null}
        </View>
      </Section>

      <Section style={styles.tight}>
        <RoutePreview width={contentWidth} height={180} seed={1} />
      </Section>

      <RunDetailBody run={run} chartWidth={contentWidth - 32} feeling={feeling} feelingCard={feelingCard} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleBlock: { paddingBottom: 16 },
  chips: { flexDirection: 'row', gap: 6, marginTop: 6 },
  tight: { paddingBottom: 12 },
  feelingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
});
