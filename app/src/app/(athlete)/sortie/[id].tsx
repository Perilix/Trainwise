import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { HeartRateChart } from '@/components/charts/heart-rate-chart';
import { PaceChart } from '@/components/charts/pace-chart';
import { RoutePreview } from '@/components/charts/route-preview';
import { BackBar, Card, Chip, FeelingSlider, IconButton, Screen, Section, Stat, StateView, Text } from '@/components/ui';
import { useAthleteActions, useRunDetail } from '@/features/athlete/queries';
import type { KmSplit } from '@/features/athlete/types';
import { formatClock, formatDayShort, formatDecimal, formatPace } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { layout } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

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
  const chartWidth = contentWidth - 32;
  const paces = run.splits.map((split) => split.paceSecPerKm);
  const half = Math.floor(paces.length / 2);
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const gain = Math.round(mean(paces.slice(0, half)) - mean(paces.slice(half)));

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

      <Section style={styles.tight}>
        <Card style={styles.statsGrid}>
          <Stat label="Distance" value={run.distanceKm ? formatDecimal(run.distanceKm) : '—'} unit="km" style={styles.gridCell} />
          <Stat label="Durée" value={formatClock(run.durationSec)} style={styles.gridCell} />
          <Stat label="Allure" value={run.paceSecPerKm ? formatPace(run.paceSecPerKm) : '—'} unit="/km" style={styles.gridCell} />
          <Stat label="FC moy." value={run.avgHr ? String(run.avgHr) : '—'} unit="bpm" style={styles.gridCell} />
          <Stat label="D+" value={run.elevationGain ? String(Math.round(run.elevationGain)) : '—'} unit="m" style={styles.gridCell} />
          <Stat label="Ressenti" value={feeling ? String(feeling) : '—'} unit="/10" style={styles.gridCell} />
        </Card>
      </Section>

      {run.splits.length > 1 ? (
        <Section style={styles.tight}>
          <Card>
            <View style={styles.cardHeader}>
              <Text variant="h2">Allure</Text>
              {gain > 0 ? <Chip label={`Negative split · −${gain} s/km`} tone="success" icon="trendUp" /> : null}
            </View>
            <View style={styles.chart}>
              <PaceChart splits={run.splits} width={chartWidth} />
            </View>
            <Text variant="h3" style={styles.tableTitle}>
              Par kilomètre
            </Text>
            <SplitsTable splits={run.splits} />
          </Card>
        </Section>
      ) : null}

      {run.avgHr ? (
        <Section style={styles.tight}>
          <Card>
            <Text variant="h2">Fréquence cardiaque</Text>
            <View style={styles.hrStats}>
              <Stat label="Moyenne" value={String(run.avgHr)} unit="bpm" style={styles.flex} />
              <Stat label="Max" value={run.maxHr ? String(Math.round(run.maxHr)) : '—'} unit="bpm" style={styles.flex} />
              {run.minHr ? <Stat label="Min" value={String(run.minHr)} unit="bpm" style={styles.flex} /> : null}
            </View>
            <View style={styles.chart}>
              <HeartRateChart splits={run.splits} width={chartWidth} />
            </View>
          </Card>
        </Section>
      ) : null}

      {run.paceZones.length ? (
        <Section style={styles.tight}>
          <Card>
            <Text variant="h2">Zones d’allure</Text>
            <PaceZones zones={run.paceZones} />
          </Card>
        </Section>
      ) : null}

      <Section style={styles.tight}>
        <Card>
          <View style={[styles.cardHeader, styles.feelingHeader]}>
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
      </Section>

      {run.notes ? (
        <Section>
          <Card>
            <Text variant="h2">Notes</Text>
            <Text variant="body2" style={styles.notes}>
              {run.notes}
            </Text>
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const formatElevation = (meters?: number) => (meters === undefined ? '—' : `${meters < 0 ? '−' : '+'}${Math.abs(meters)} m`);

function SplitsTable({ splits }: { splits: KmSplit[] }) {
  const { colors } = useTheme();
  const fastest = Math.min(...splits.map((split) => split.paceSecPerKm));

  return (
    <View>
      <View style={styles.tableRow}>
        <Text variant="overline" style={styles.kmCol}>
          Km
        </Text>
        <Text variant="overline" style={styles.flex}>
          Allure
        </Text>
        <Text variant="overline" style={styles.hrCol}>
          FC
        </Text>
        <Text variant="overline" style={styles.elevationCol}>
          Dén.
        </Text>
      </View>
      {splits.map((split) => {
        const isFastest = split.paceSecPerKm === fastest;
        return (
          <View key={split.km} style={[styles.tableRow, styles.tableCell, { borderTopColor: colors.border }]}>
            <Text variant="small" color="text3" tabular style={styles.kmCol}>
              {split.km}
            </Text>
            <Text tabular style={[styles.flex, { fontSize: 13, fontFamily: isFastest ? fontFamily.semibold : fontFamily.medium }]}>
              {formatPace(split.paceSecPerKm)} /km
              {isFastest ? <Text style={{ fontSize: 11, fontFamily: fontFamily.semibold, color: colors.accentInk }}>  plus rapide</Text> : null}
            </Text>
            <Text variant="small" tabular style={styles.hrCol}>
              {split.avgHr ? `${split.avgHr} bpm` : '—'}
            </Text>
            <Text variant="small" tabular style={styles.elevationCol}>
              {formatElevation(split.elevation)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function PaceZones({ zones }: { zones: { label: string; minutes: number }[] }) {
  const { colors, ramp } = useTheme();
  const total = zones.reduce((sum, zone) => sum + zone.minutes, 0) || 1;

  return (
    <View>
      <View style={styles.zoneBar}>
        {zones
          .map((zone, index) => ({ ...zone, color: ramp[index] }))
          .filter((zone) => zone.minutes > 0)
          .map((zone) => (
            <View key={zone.label} style={{ flex: zone.minutes, backgroundColor: zone.color, borderRadius: 4 }} />
          ))}
      </View>
      {zones.map((zone, index) => (
        <View key={zone.label} style={[styles.zoneRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
          <View style={[styles.zoneSwatch, { backgroundColor: ramp[index] }]} />
          <Text style={[styles.flex, { fontSize: 13 }]}>
            Z{index + 1} · {zone.label}
          </Text>
          <Text variant="small" tabular>
            {zone.minutes} min
          </Text>
          <Text variant="h3" tabular style={styles.zonePct}>
            {Math.round((zone.minutes / total) * 100)} %
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleBlock: { paddingBottom: 16 },
  chips: { flexDirection: 'row', gap: 6, marginTop: 6 },
  tight: { paddingBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  gridCell: { width: '33.33%' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  feelingHeader: { marginBottom: 12 },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  chart: { marginTop: 12 },
  tableTitle: { marginTop: 20, marginBottom: 10 },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  tableCell: { borderTopWidth: 1, paddingTop: 7, paddingBottom: 7 },
  kmCol: { width: 28 },
  hrCol: { width: 72, textAlign: 'right' },
  elevationCol: { width: 52, textAlign: 'right' },
  hrStats: { flexDirection: 'row', gap: 8, marginTop: 10 },
  zoneBar: { flexDirection: 'row', gap: 2, height: 12, marginTop: 14 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  zoneSwatch: { width: 10, height: 10, borderRadius: 3 },
  zonePct: { width: 40, textAlign: 'right' },
  notes: { marginTop: 6 },
});
