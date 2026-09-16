import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

import { Text } from './text';

type Props = {
  value: number; // 1 à 10
  onChange?: (value: number) => void;
  labels?: [string, string];
};

const STEPS = Array.from({ length: 10 }, (_, index) => index + 1);

// Ressenti de séance : un appui sur la piste choisit la note (1 = épuisant, 10 = excellent).
export function FeelingSlider({ value, onChange, labels = ['Épuisant', 'Excellent'] }: Props) {
  const { colors } = useTheme();
  const percent = ((value - 1) / 9) * 100;

  return (
    <View style={styles.container}>
      <View
        style={styles.track}
        accessibilityRole="adjustable"
        accessibilityLabel="Ressenti"
        accessibilityValue={{ min: 1, max: 10, now: value, text: `${value} sur 10` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') onChange?.(Math.min(10, value + 1));
          if (event.nativeEvent.actionName === 'decrement') onChange?.(Math.max(1, value - 1));
        }}>
        <View style={[styles.rail, { backgroundColor: colors.subtle }]} />
        <View style={[styles.rail, { width: `${percent}%`, backgroundColor: colors.primary }]} />
        <View style={[styles.thumb, { left: `${percent}%`, backgroundColor: colors.surface, borderColor: colors.primary }]} />
        <View style={styles.hitAreas}>
          {STEPS.map((step) => (
            <Pressable key={step} style={styles.hitArea} onPress={() => onChange?.(step)} accessibilityElementsHidden importantForAccessibility="no" />
          ))}
        </View>
      </View>
      <View style={styles.labels}>
        <Text variant="caption">{labels[0]}</Text>
        <Text variant="caption">{labels[1]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  track: { height: 32, justifyContent: 'center', marginHorizontal: 12 },
  rail: { position: 'absolute', left: 0, right: 0, height: 6, borderRadius: radius.pill },
  thumb: { position: 'absolute', width: 24, height: 24, marginLeft: -12, borderRadius: 12, borderWidth: 2, boxShadow: '0 1px 3px rgba(5, 25, 35, 0.15)' },
  hitAreas: { position: 'absolute', top: 0, bottom: 0, left: -12, right: -12, flexDirection: 'row' },
  hitArea: { flex: 1 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
});
