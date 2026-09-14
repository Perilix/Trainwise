import { StyleSheet, View } from 'react-native';

import { Card, IconButton, Text } from '@/components/ui';
import { addDays } from '@/lib/dates';
import { formatDayLong, parseDay, toIsoDay } from '@/lib/format';

type Props = {
  date: string; // AAAA-MM-JJ
  onChange: (isoDay: string) => void;
  label?: string;
};

// Choix d'une date jour par jour.
export function DateStepper({ date, onChange, label = 'Date' }: Props) {
  const shift = (days: number) => onChange(toIsoDay(addDays(parseDay(date), days)));
  return (
    <Card style={styles.card}>
      <IconButton icon="chevronLeft" size={36} accessibilityLabel="Jour précédent" onPress={() => shift(-1)} />
      <View style={styles.label} accessible accessibilityLabel={`${label} : ${formatDayLong(date)}`}>
        <Text variant="caption">{label}</Text>
        <Text variant="h3">{formatDayLong(date)}</Text>
      </View>
      <IconButton icon="chevronRight" size={36} accessibilityLabel="Jour suivant" onPress={() => shift(1)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 10 },
  label: { flex: 1, alignItems: 'center' },
});
