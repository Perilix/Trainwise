import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Divider, IconButton, StateView, Text } from '@/components/ui';
import type { CalendarMarker, PlanningMonth } from '@/features/athlete/types';
import { formatMonthYear, toIsoDay, WEEKDAY_INITIALS } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { fontFamily } from '@/theme/typography';

type Props = {
  year: number;
  monthIndex: number;
  /** Données du mois affiché (absentes pendant le chargement). */
  month: PlanningMonth | undefined;
  selected: string;
  onSelect: (isoDay: string) => void;
  onShiftMonth: (delta: number) => void;
  /** Libellés de la légende : séances du coach, séances ajoutées par l'athlète. */
  labels: { coach: string; athlete: string };
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
};

type Cell = { iso: string; day: number; inMonth: boolean };

function buildCells(year: number, monthIndex: number): Cell[] {
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // lundi en premier
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const count = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(year, monthIndex, 1 - offset + i);
    return { iso: toIsoDay(date), day: date.getDate(), inMonth: date.getMonth() === monthIndex };
  });
}

// Calendrier mensuel du planning (athlète et coach) : navigation, jours marqués, légende.
export function MonthCalendar({ year, monthIndex, month, selected, onSelect, onShiftMonth, labels, loading, error, onRetry }: Props) {
  return (
    <Card style={styles.card}>
      <View style={styles.nav}>
        <IconButton icon="chevronLeft" size={36} accessibilityLabel="Mois précédent" onPress={() => onShiftMonth(-1)} />
        <Text variant="h2">{formatMonthYear(year, monthIndex)}</Text>
        <IconButton icon="chevronRight" size={36} accessibilityLabel="Mois suivant" onPress={() => onShiftMonth(1)} />
      </View>
      {month ? (
        <>
          <MonthGrid month={month} selected={selected} onSelect={onSelect} />
          <Divider style={styles.divider} />
          <Legend labels={labels} />
        </>
      ) : (
        <StateView loading={loading} error={error} onRetry={onRetry} />
      )}
    </Card>
  );
}

function MonthGrid({ month, selected, onSelect }: { month: PlanningMonth; selected: string; onSelect: (iso: string) => void }) {
  const { colors } = useTheme();
  const markerColor: Record<CalendarMarker, string> = { done: colors.success, coach: colors.violet, athlete: colors.primary, competition: colors.primary };

  return (
    <View>
      <View style={styles.gridRow}>
        {WEEKDAY_INITIALS.map((initial, index) => (
          <View key={index} style={styles.weekdayCell}>
            <Text variant="caption" color="text3">
              {initial}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {buildCells(month.year, month.monthIndex).map((cell) => {
          const marker = month.markers[cell.iso];
          const isToday = cell.iso === month.today;
          const isSelected = cell.iso === selected;
          const priority = month.competitionPriority[cell.iso];
          const outlined = !isToday && (isSelected || marker === 'competition');
          return (
            <Pressable key={cell.iso} accessibilityRole="button" accessibilityState={{ selected: isSelected }} onPress={() => onSelect(cell.iso)} style={styles.cell}>
              <View style={[styles.dayNumber, isToday && { backgroundColor: colors.primary }, outlined && { borderWidth: 1.5, borderColor: colors.primary }]}>
                <Text
                  tabular
                  style={{ fontSize: 14, fontFamily: isToday ? fontFamily.semibold : fontFamily.medium, color: isToday ? colors.onPrimary : cell.inMonth ? colors.ink : colors.text3 }}>
                  {cell.day}
                </Text>
              </View>
              <View style={styles.markerSlot}>
                {priority ? (
                  <Text style={{ fontSize: 10, lineHeight: 10, fontFamily: fontFamily.bold, color: colors.primary }}>{priority}</Text>
                ) : marker && cell.inMonth ? (
                  <View style={[styles.marker, { backgroundColor: markerColor[marker] }]} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Legend({ labels }: { labels: Props['labels'] }) {
  const { colors } = useTheme();
  const items = [
    { color: colors.success, label: 'Effectuée' },
    { color: colors.violet, label: labels.coach },
    { color: colors.primary, label: labels.athlete },
  ];
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text variant="caption">{item.label}</Text>
        </View>
      ))}
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { borderWidth: 1.5, borderColor: colors.primary }]} />
        <Text variant="caption">Compétition</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  gridRow: { flexDirection: 'row' },
  weekdayCell: { width: `${100 / 7}%`, height: 28, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 50, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dayNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  markerSlot: { height: 8, alignItems: 'center', justifyContent: 'center' },
  marker: { width: 6, height: 6, borderRadius: 3 },
  divider: { marginTop: 10, marginBottom: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
});
