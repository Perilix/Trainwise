import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { DistanceBars } from '@/components/charts/distance-bars';
import { RoutePreview } from '@/components/charts/route-preview';
import { Card, Chip, Divider, Screen, Section, SectionHeader, Segmented, Stat, StateView, Text } from '@/components/ui';
import { AthleteAppBar } from '@/features/athlete/athlete-app-bar';
import { useRunsOverview } from '@/features/athlete/queries';
import type { Activity, RunsPeriod } from '@/features/athlete/types';
import { formatClock, formatDayShort, formatDecimal, formatHoursMinutes, formatPace } from '@/lib/format';
import { layout } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

export default function RunsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<RunsPeriod>('month');
  const { data, loading, error, refetch } = useRunsOverview(period);

  const previewWidth = width - layout.gutter * 2 - 16;

  return (
    <Screen>
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
          onChange={setPeriod}
        />
      </Section>

      {data ? (
        <>
          <Section>
            <Card>
              <View style={styles.summaryHeader}>
                <View>
                  <Text variant="caption">{data.periodLabel}</Text>
                  <View style={styles.baseline}>
                    <Text tabular style={styles.total}>
                      {formatDecimal(data.distanceKm)}
                    </Text>
                    <Text variant="body2" style={{ fontFamily: fontFamily.medium }}>
                      km
                    </Text>
                  </View>
                </View>
                {data.trendLabel ? <Chip label={data.trendLabel} tone={data.trendUp ? 'success' : 'neutral'} icon={data.trendUp ? 'trendUp' : 'trendDown'} /> : null}
              </View>
              <View style={styles.bars}>
                <DistanceBars bars={data.bars} />
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
        <RoutePreview width={previewWidth} height={120} seed={seed} />
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
