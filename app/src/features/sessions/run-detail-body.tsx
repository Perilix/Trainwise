import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { HeartRateChart } from '@/components/charts/heart-rate-chart';
import { SessionPreview } from './session-preview';
import { PaceChart } from '@/components/charts/pace-chart';
import { BRAND, Card, Chip, Section, Stat, Text } from '@/components/ui';
import type { KmSplit, RunDetail } from '@/features/athlete/types';
import { formatClock, formatDayShort, formatDecimal, formatPace } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

type Props = {
  run: RunDetail;
  /** Largeur utile d'une carte, pour dimensionner les graphiques. */
  chartWidth: number;
  /** Ressenti affiché dans la grille (édition en cours côté athlète). */
  feeling?: number | null;
  /** Carte de saisie du ressenti, insérée après les graphiques. */
  feelingCard?: ReactNode;
};

/** Corps d'une sortie réalisée : chiffres clés, allure par kilomètre, FC, zones et notes. */
export function RunDetailBody({ run, chartWidth, feeling, feelingCard }: Props) {
  const paces = run.splits.map((split) => split.paceSecPerKm);
  const half = Math.floor(paces.length / 2);
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const gain = Math.round(mean(paces.slice(0, half)) - mean(paces.slice(half)));
  const shownFeeling = feeling ?? run.feeling;

  return (
    <>
      <Section style={styles.tight}>
        <Card style={styles.statsGrid}>
          <Stat label="FC moy." value={run.avgHr ? String(run.avgHr) : '—'} unit="bpm" style={styles.gridCell} />
          <Stat label="D+" value={run.elevationGain ? String(Math.round(run.elevationGain)) : '—'} unit="m" style={styles.gridCell} />
          <Stat label="Ressenti" value={shownFeeling ? String(shownFeeling) : '—'} unit="/10" style={styles.gridCell} />
        </Card>
      </Section>

      {run.blocks.length ? (
        <Section style={styles.tight}>
          <Card>
            <SessionPreview blocks={run.blocks} segments={run.segments} width={chartWidth} title="Déroulé réalisé" />
            {run.blocksAuto ? (
              <Text variant="caption" style={styles.autoNote}>
                Reconstruit depuis les tours de ta montre.
              </Text>
            ) : null}
          </Card>
        </Section>
      ) : null}

      {run.splits.length > 1 ? (
        <Section style={styles.tight}>
          <Card>
            <View style={styles.cardHeader}>
              <Text variant="sectionTitle">Allure</Text>
              {gain > 0 ? <Chip label={`Negative split · −${gain} s/km`} tone="success" icon="trendUp" /> : null}
            </View>
            <View style={styles.chart}>
              <PaceChart splits={run.splits} width={chartWidth} />
            </View>
            <Text variant="sectionTitle" style={styles.tableTitle}>
              Par kilomètre
            </Text>
            <SplitsTable splits={run.splits} />
          </Card>
        </Section>
      ) : null}

      {run.avgHr ? (
        <Section style={styles.tight}>
          <Card>
            <Text variant="sectionTitle">Fréquence cardiaque</Text>
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
            <Text variant="sectionTitle">Zones d’allure</Text>
            <PaceZones zones={run.paceZones} />
          </Card>
        </Section>
      ) : null}

      {feelingCard ? <Section style={styles.tight}>{feelingCard}</Section> : null}

      {run.notes ? (
        <Section>
          <Card>
            <Text variant="sectionTitle">Notes</Text>
            <Text variant="body2" style={styles.notes}>
              {run.notes}
            </Text>
          </Card>
        </Section>
      ) : null}
    </>
  );
}

/** Sortie ouverte : carte navy de mise en avant (titre, date, chiffres clés), comme la séance du jour. */
export function RunHero({ run, children }: { run: RunDetail; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.hero, { backgroundColor: colors.brand }]}>
      <View style={styles.watermark} pointerEvents="none">
        <SvgXml xml={BRAND.glyph} width={112} height={112} opacity={0.05} />
      </View>
      <Text variant="overline" style={{ color: colors.highlight }}>
        {formatDayShort(run.date)}
        {run.startTime ? ` · ${run.startTime}` : ''}
      </Text>
      <Text variant="h1" style={[styles.heroTitle, { color: colors.onBrand }]}>
        {run.title}
      </Text>
      {children ? <View style={styles.heroChips}>{children}</View> : null}
      <View style={styles.heroStats}>
        <Stat label="Distance" value={run.distanceKm ? formatDecimal(run.distanceKm) : '—'} unit="km" tint={HERO_TINT} style={styles.flex} />
        <Stat label="Durée" value={formatClock(run.durationSec)} tint={HERO_TINT} style={styles.flex} />
        <Stat label="Allure" value={run.paceSecPerKm ? formatPace(run.paceSecPerKm) : '—'} unit="/km" tint={HERO_TINT} style={styles.flex} />
      </View>
    </View>
  );
}

const HERO_TINT = { label: 'rgba(255, 255, 255, 0.55)', value: '#FFFFFF' };

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
  hero: { borderRadius: radius.xl, padding: 20, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -16, bottom: -18 },
  heroTitle: { marginTop: 6 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.14)' },
  flex: { flex: 1 },
  tight: { paddingBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  gridCell: { width: '33.33%' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
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
  autoNote: { marginTop: 10 },
});
