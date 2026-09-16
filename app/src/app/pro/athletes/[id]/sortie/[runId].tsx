import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { BackBar, Chip, Screen, Section, StateView } from '@/components/ui';
import { useCoachRunDetail } from '@/features/coach/queries';
import { PlannedVsDone } from '@/features/sessions/planned-vs-done';
import { RunDetailBody, RunHero } from '@/features/sessions/run-detail-body';
import { layout } from '@/theme/tokens';

export default function CoachRunDetailScreen() {
  const { id, runId } = useLocalSearchParams<{ id: string; runId: string }>();
  const { width } = useWindowDimensions();
  const { data, loading, error, refetch } = useCoachRunDetail(id, runId);

  if (!data) {
    return (
      <Screen>
        <BackBar />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const { run, snapshot } = data;
  const contentWidth = width - layout.gutter * 2;

  return (
    <Screen>
      <BackBar />

      <Section style={styles.tight}>
        <RunHero run={run}>
          {run.fromStrava ? <Chip label="Strava" tone="strava" /> : null}
          <Chip label={snapshot ? 'Séance planifiée' : 'Sortie libre'} tone={snapshot ? 'violet' : 'neutral'} icon={snapshot ? 'user' : 'route'} />
        </RunHero>
      </Section>

      {snapshot ? (
        <Section style={styles.tight}>
          <PlannedVsDone snapshot={snapshot} run={run} />
        </Section>
      ) : null}

      <RunDetailBody run={run} chartWidth={contentWidth - 32} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tight: { paddingBottom: 12 },
});
