import { StyleSheet, View } from 'react-native';

import { Card, Chip, Text } from '@/components/ui';
import { paceToSeconds } from '@/features/athlete/mappers';
import type { RunDetail } from '@/features/athlete/types';
import type { ApiRun } from '@/lib/api-types';
import { formatClock, formatDecimal, formatPace } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';

type Snapshot = NonNullable<ApiRun['plannedSnapshot']>;

type Row = {
  label: string;
  planned: string;
  done: string;
  /** Écart signé, déjà mis en mots (« +1,2 km », « 8 s/km plus vite »). */
  gap?: string;
  tone: 'success' | 'warning' | 'neutral';
};

// Tolérances au-delà desquelles l'écart mérite d'être signalé.
const DISTANCE_TOLERANCE_KM = 0.5;
const DURATION_TOLERANCE_SEC = 180;
const PACE_TOLERANCE_SEC = 10;

const signed = (value: number, unit: string, digits = 0) => `${value > 0 ? '+' : '−'}${formatDecimal(Math.abs(value), digits)} ${unit}`;

function buildRows(snapshot: Snapshot, run: RunDetail): Row[] {
  const rows: Row[] = [];

  if (snapshot.targetDistance && run.distanceKm) {
    const gap = run.distanceKm - snapshot.targetDistance;
    rows.push({
      label: 'Distance',
      planned: `${formatDecimal(snapshot.targetDistance)} km`,
      done: `${formatDecimal(run.distanceKm)} km`,
      gap: Math.abs(gap) >= 0.1 ? signed(gap, 'km', 1) : undefined,
      tone: Math.abs(gap) <= DISTANCE_TOLERANCE_KM ? 'success' : 'warning',
    });
  }

  if (snapshot.targetDuration && run.durationSec) {
    const gap = run.durationSec - snapshot.targetDuration * 60;
    rows.push({
      label: 'Durée',
      planned: formatClock(snapshot.targetDuration * 60),
      done: formatClock(run.durationSec),
      gap: Math.abs(gap) >= 60 ? signed(Math.round(gap / 60), 'min') : undefined,
      tone: Math.abs(gap) <= DURATION_TOLERANCE_SEC ? 'success' : 'warning',
    });
  }

  const plannedPace = paceToSeconds(snapshot.targetPace ?? null);
  if (plannedPace && run.paceSecPerKm) {
    // Une allure plus basse est plus rapide : on inverse la lecture de l'écart.
    const gap = run.paceSecPerKm - plannedPace;
    rows.push({
      label: 'Allure',
      planned: `${formatPace(plannedPace)} /km`,
      done: `${formatPace(run.paceSecPerKm)} /km`,
      gap: Math.abs(gap) >= 3 ? `${Math.abs(Math.round(gap))} s/km plus ${gap < 0 ? 'vite' : 'lent'}` : undefined,
      tone: Math.abs(gap) <= PACE_TOLERANCE_SEC ? 'success' : 'warning',
    });
  }

  return rows;
}

/** Comparaison de la sortie réalisée avec la séance que le coach avait prévue. */
export function PlannedVsDone({ snapshot, run }: { snapshot: Snapshot; run: RunDetail }) {
  const { colors } = useTheme();
  const rows = buildRows(snapshot, run);
  if (!rows.length && !snapshot.description) return null;

  const offTarget = rows.filter((row) => row.tone === 'warning').length;
  const verdict = rows.length ? (offTarget === 0 ? 'Séance respectée' : `${offTarget} écart${offTarget > 1 ? 's' : ''} notable${offTarget > 1 ? 's' : ''}`) : undefined;

  return (
    <Card>
      <View style={styles.header}>
        <Text variant="h2">Prévu / réalisé</Text>
        {verdict ? <Chip label={verdict} tone={offTarget ? 'warning' : 'success'} icon={offTarget ? 'warning' : 'check'} /> : null}
      </View>

      {snapshot.title ? (
        <Text variant="small" style={styles.planTitle}>
          Séance prévue : {snapshot.title}
        </Text>
      ) : null}

      {rows.length ? (
        <>
          <View style={styles.row}>
            <Text variant="overline" style={styles.labelCol} />
            <Text variant="overline" style={styles.valueCol}>
              Prévu
            </Text>
            <Text variant="overline" style={styles.valueCol}>
              Réalisé
            </Text>
          </View>
          {rows.map((row) => (
            <View key={row.label} style={[styles.row, styles.dataRow, { borderTopColor: colors.border }]}>
              <Text variant="small" color="text3" style={styles.labelCol}>
                {row.label}
              </Text>
              <Text variant="body2" tabular style={styles.valueCol}>
                {row.planned}
              </Text>
              <View style={styles.valueCol}>
                <Text variant="h3" tabular>
                  {row.done}
                </Text>
                {row.gap ? (
                  <Text variant="caption" color={row.tone === 'warning' ? 'warningInk' : 'text3'} tabular>
                    {row.gap}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </>
      ) : null}

      {snapshot.description ? (
        <Text variant="small" style={styles.instructions}>
          Consignes : {snapshot.description}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  planTitle: { marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingBottom: 8 },
  dataRow: { borderTopWidth: 1, paddingTop: 10 },
  labelCol: { width: 64 },
  valueCol: { flex: 1 },
  instructions: { marginTop: 8 },
});
