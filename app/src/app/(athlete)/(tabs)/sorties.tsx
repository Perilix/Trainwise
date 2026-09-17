import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { DistanceBars } from '@/components/charts/distance-bars';
import { RoutePreview } from '@/components/charts/route-preview';
import { Card, Chip, Divider, IconButton, Screen, Section, SectionHeader, Segmented, Stat, StateView, Text } from '@/components/ui';
import { AthleteAppBar } from '@/features/athlete/athlete-app-bar';
import { useRunsOverview } from '@/features/athlete/queries';
import { onAppEvent } from '@/lib/app-events';
import type { Activity, RunsPeriod } from '@/features/athlete/types';
import { formatClock, formatDayShort, formatDecimal, formatHoursMinutes, formatPace } from '@/lib/format';
import { layout } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

// Libellés des flèches de navigation, par granularité.
const PERIOD_LABELS: Record<RunsPeriod, { previous: string; next: string }> = {
  week: { previous: 'Semaine précédente', next: 'Semaine suivante' },
  month: { previous: 'Mois précédent', next: 'Mois suivant' },
  year: { previous: 'Année précédente', next: 'Année suivante' },
};

export default function RunsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<RunsPeriod>('month');
  // Nombre de périodes en arrière : 0 = période en cours.
  const [offset, setOffset] = useState(0);
  const { data, loading, error, refetch } = useRunsOverview(period, offset);

  const changePeriod = (next: RunsPeriod) => {
    setPeriod(next);
    setOffset(0);
  };

  useEffect(() => onAppEvent('sessions:changed', refetch), [refetch]);

  const previewWidth = width - layout.gutter * 2 - 16;

  return (
    <Screen tabs>
      <AthleteAppBar />

      <Section style={styles.top}>
        <Text variant="h1">Mes sorties</Text>
        <Segmented<RunsPeriod>
          options={[
            { value: 'week', label: 'Semaine' },
            { value: 'month', label: 'Mois' },
            { value: 'year', label: 'Année' },
          ]}
          value={period}
          onChange={changePeriod}
        />
      </Section>

      {data ? (
        <>
          <Section>
            <Card>
              <View style={styles.summaryHeader}>
                <View style={styles.flex}>
                  <View style={styles.periodRow}>
                    <IconButton icon="chevronLeft" size={30} accessibilityLabel={`${PERIOD_LABELS[period].previous}`} onPress={() => setOffset((value) => value + 1)} />
                    <Text variant="caption">{data.periodLabel}</Text>
                    {offset > 0 ? (
                      <IconButton icon="chevronRight" size={30} accessibilityLabel={PERIOD_LABELS[period].next} onPress={() => setOffset((value) => value - 1)} />
                    ) : null}
                  </View>
                  <View style={styles.baseline}>
                    <Text tabular style={styles.total}>
                      {formatDecimal(data.distanceKm)}
                    </Text>
                    <Text variant="body2" style={{ fontFamily: fontFamily.medium }}>
                      km
                    </Text>
                  </View>
                </View>
                {data.trendLabel ? (
                  <Chip label={data.trendLabel} tone={data.trendUp ? 'success' : 'danger'} icon={data.trendUp ? 'trendUp' : 'trendDown'} />
                ) : null}
              </View>
              <View style={styles.bars}>
                <DistanceBars bars={data.bars} onSelect={(index) => setOffset(data.bars[index].offset)} />
              </View>
              <Divider style={styles.divider} />
              <View style={styles.statsRow}>
                <Stat label="Sorties" value={String(data.stats.runs)} style={styles.flex} />
                <Stat label="Allure moy." value={data.stats.avgPaceSecPerKm ? formatPace(data.stats.avgPaceSecPerKm) : '—'} unit="/km" style={styles.flex} />
                <Stat label="Temps" value={formatHoursMinutes(data.stats.durationSec)} style={styles.flex} />
              </View>
            </Card>
          </Section>

          <Section>
            <SectionHeader title={data.listTitle} />
            <View style={styles.runList}>
              {data.runs.map((run, index) => (
                <RunCard key={run.id} run={run} seed={index * 3 + 1} previewWidth={previewWidth} onPress={() => router.push({ pathname: '/sortie/[id]', params: { id: run.id } })} />
              ))}
            </View>
          </Section>
        </>
      ) : (
        <StateView loading={loading} error={error} onRetry={refetch} />
      )}
    </Screen>
  );
}

function RunCard({ run, seed, previewWidth, onPress }: { run: Activity; seed: number; previewWidth: number; onPress: () => void }) {
  const stats = [
    { label: 'Distance', value: run.distanceKm ? formatDecimal(run.distanceKm) : '—', unit: 'km' },
    { label: 'Durée', value: formatClock(run.durationSec), unit: '' },
    { label: 'Allure', value: run.paceSecPerKm ? formatPace(run.paceSecPerKm) : '—', unit: '/km' },
    { label: 'FC moy.', value: run.avgHr ? String(run.avgHr) : '—', unit: 'bpm' },
  ];

  return (
    <Card padding={0} onPress={onPress} accessibilityLabel={`${run.title}, ${formatDayShort(run.date)}`} style={styles.runCard}>
      <View style={styles.preview}>
        <RoutePreview width={previewWidth} height={120} polyline={run.polyline} seed={seed} />
      </View>
      <View style={styles.runBody}>
        <View style={styles.runHeader}>
          <View style={styles.flex}>
            <Text variant="h3" numberOfLines={1}>
              {run.title}
            </Text>
            <Text variant="small">
              {formatDayShort(run.date)}
              {run.startTime ? ` · ${run.startTime}` : ''}
            </Text>
          </View>
          {run.feeling ? <Chip label={`Ressenti ${run.feeling}/10`} /> : null}
        </View>
        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.flex}>
              <Text variant="caption">{stat.label}</Text>
              <View style={styles.baseline}>
                <Text tabular style={{ fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 22 }}>
                  {stat.value}
                </Text>
                {stat.unit ? (
                  <Text variant="caption" style={{ fontSize: 11, fontFamily: fontFamily.regular }}>
                    {stat.unit}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { gap: 12, paddingTop: 4, paddingBottom: 16 },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -8 },
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  total: { fontFamily: fontFamily.semibold, fontSize: 34, lineHeight: 40, letterSpacing: -0.68 },
  bars: { marginTop: 18 },
  divider: { marginVertical: 14 },
  statsRow: { flexDirection: 'row', gap: 8 },
  runList: { gap: 12, marginTop: 12 },
  runCard: { overflow: 'hidden' },
  preview: { paddingTop: 8, paddingHorizontal: 8 },
  runBody: { padding: 16, paddingTop: 12, gap: 12 },
  runHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
