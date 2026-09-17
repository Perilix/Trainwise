import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { RoutePreview } from '@/components/charts/route-preview';
import { BackBar, Card, Chip, FeelingSlider, IconButton, Screen, Section, StateView, Text } from '@/components/ui';
import { useAthleteActions, useRunDetail } from '@/features/athlete/queries';
import { RunDetailBody, RunHero } from '@/features/sessions/run-detail-body';
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

  return (
    <Screen>
      <BackBar right={<IconButton icon="moreV" accessibilityLabel="Plus d’actions" />} />

      <Section style={styles.tight}>
        <RunHero run={run}>
          {run.fromStrava ? <Chip label="Strava" tone="strava" /> : null}
          {run.plannedBy === 'coach' ? <Chip label={`Planifiée par ${run.coachName ?? 'ton coach'}`} tone="violet" icon="user" /> : null}
        </RunHero>
      </Section>

      <Section style={styles.tight}>
        <RoutePreview width={contentWidth} height={180} polyline={run.polyline} />
      </Section>

      <RunDetailBody run={run} chartWidth={contentWidth - 32} feeling={feeling} feelingCard={feelingCard} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tight: { paddingBottom: 12 },
  feelingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
});
