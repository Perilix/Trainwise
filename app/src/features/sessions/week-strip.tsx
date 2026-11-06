import { Pressable, StyleSheet, View } from 'react-native';

import { Card, IconButton, Text } from '@/components/ui';
import { addDays, startOfWeek } from '@/lib/dates';
import { formatDayLong, formatMonthName, parseDay, toIsoDay, WEEKDAY_INITIALS } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

type Props = {
  date: string; // AAAA-MM-JJ
  onChange: (isoDay: string) => void;
  /** Jours qui ont déjà une séance ou une sortie : un point violet les signale. */
  busyDays?: ReadonlySet<string>;
};

// Choix du jour dans la semaine, flèches pour passer d'une semaine à l'autre.
export function WeekStrip({ date, onChange, busyDays }: Props) {
  const { colors } = useTheme();
  const monday = startOfWeek(parseDay(date));
  const days = WEEKDAY_INITIALS.map((initial, index) => {
    const day = addDays(monday, index);
    return { iso: toIsoDay(day), initial, num: day.getDate() };
  });
  const shiftWeek = (weeks: number) => onChange(toIsoDay(addDays(parseDay(date), weeks * 7)));
  const month = formatMonthName(parseDay(date).getMonth());

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="sectionTitle" style={styles.flex}>
          Quand
        </Text>
        <Text variant="small">{month.charAt(0).toUpperCase() + month.slice(1)}</Text>
        <IconButton icon="chevronLeft" size={36} accessibilityLabel="Semaine précédente" onPress={() => shiftWeek(-1)} />
        <IconButton icon="chevronRight" size={36} accessibilityLabel="Semaine suivante" onPress={() => shiftWeek(1)} />
      </View>
      <Card padding={8} style={styles.days}>
        {days.map((day) => {
          const selected = day.iso === date;
          const busy = busyDays?.has(day.iso);
          return (
            <Pressable
              key={day.iso}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={formatDayLong(day.iso)}
              onPress={() => onChange(day.iso)}
              style={[styles.day, selected && { backgroundColor: colors.primary }]}>
              <Text variant="overline" style={{ color: selected ? colors.onPrimary : colors.text2 }}>
                {day.initial}
              </Text>
              <Text tabular style={[styles.num, { color: selected ? colors.onPrimary : colors.ink }]}>
                {day.num}
              </Text>
              <View style={[styles.dot, busy && { backgroundColor: selected ? colors.onPrimary : colors.violet }]} />
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  days: { flexDirection: 'row', gap: 2 },
  day: { flex: 1, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2 },
  num: { fontSize: 16, lineHeight: 22, fontFamily: fontFamily.semibold },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
