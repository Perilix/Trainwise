import { useRef } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

import { Text } from './text';

type Props = {
  value: number; // 1 à 10
  onChange?: (value: number) => void;
  labels?: [string, string];
};

/**
 * Ressenti de séance : 1 = épuisant, 10 = excellent.
 *
 * La piste répond au glissement comme à l'appui — on attrape le curseur et on
 * le fait courir, ou on tape directement à l'endroit voulu.
 */
export function FeelingSlider({ value, onChange, labels = ['Épuisant', 'Excellent'] }: Props) {
  const { colors } = useTheme();
  const percent = ((value - 1) / 9) * 100;

  const track = useRef<View>(null);
  // Position et largeur de la piste à l'écran : c'est ce qui convertit un doigt en note.
  const geometry = useRef({ x: 0, width: 0 });
  const measure = () => track.current?.measureInWindow((x, _y, width) => (geometry.current = { x, width }));

  const stepFor = (pageX: number) => {
    const { x, width } = geometry.current;
    if (!width) return null;
    const ratio = Math.min(1, Math.max(0, (pageX - x) / width));
    return Math.round(1 + ratio * 9);
  };

  const apply = (event: GestureResponderEvent) => {
    const step = stepFor(event.nativeEvent.pageX);
    if (step !== null) onChange?.(step);
  };

  return (
    <View style={styles.container}>
      <View
        ref={track}
        onLayout={measure}
        style={styles.track}
        accessibilityRole="adjustable"
        accessibilityLabel="Ressenti"
        accessibilityValue={{ min: 1, max: 10, now: value, text: `${value} sur 10` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') onChange?.(Math.min(10, value + 1));
          if (event.nativeEvent.actionName === 'decrement') onChange?.(Math.max(1, value - 1));
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        // La piste garde le doigt : sans ça, la page défile au lieu de glisser.
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          measure();
          apply(event);
        }}
        onResponderMove={apply}>
        <View style={[styles.rail, { backgroundColor: colors.subtle }]} />
        <View style={[styles.rail, { width: `${percent}%`, backgroundColor: colors.primary }]} />
        <View style={[styles.thumb, { left: `${percent}%`, backgroundColor: colors.surface, borderColor: colors.primary }]} />
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
  track: { height: 40, justifyContent: 'center', marginHorizontal: 12 },
  rail: { position: 'absolute', left: 0, right: 0, height: 6, borderRadius: radius.pill },
  thumb: { position: 'absolute', width: 26, height: 26, marginLeft: -13, borderRadius: 13, borderWidth: 2, boxShadow: '0 1px 3px rgba(5, 25, 35, 0.15)' },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
});
