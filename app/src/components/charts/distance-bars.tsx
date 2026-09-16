import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme/theme-provider';

type Bar = { label: string; distanceKm: number; selected: boolean };

type Props = {
  bars: Bar[];
  height?: number;
};

// Kilomètres par période : barres partant de zéro, période sélectionnée en bleu plein.
export function DistanceBars({ bars, height = 128 }: Props) {
  const { colors } = useTheme();
  const max = Math.max(...bars.map((bar) => bar.distanceKm), 1);
  const plotHeight = height - 40;

  return (
    <View style={[styles.row, { height }]} accessibilityLabel={bars.map((bar) => `${bar.label} ${Math.round(bar.distanceKm)} km`).join(', ')}>
      {bars.map((bar) => (
        <View key={bar.label} style={styles.column}>
          {bar.selected ? (
            <Text variant="caption" color="ink" tabular>
              {Math.round(bar.distanceKm)}
            </Text>
          ) : null}
          <View
            style={{
              width: '100%',
              height: Math.max(4, (bar.distanceKm / max) * plotHeight),
              borderTopLeftRadius: 6,
              borderTopRightRadius: 6,
              borderBottomLeftRadius: 2,
              borderBottomRightRadius: 2,
              backgroundColor: bar.selected ? colors.accent : colors.barMuted,
            }}
          />
          <Text variant="caption" color={bar.selected ? 'ink' : 'text3'}>
            {bar.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
});
