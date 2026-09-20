import { Pressable, StyleSheet, View } from 'react-native';

import { Chip, Text } from '@/components/ui';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

/** Ce que veut dire une note, pour que le coach et l'athlète parlent de la même chose. */
export const FEELING_SCALE: Record<number, string> = {
  1: 'Épuisant',
  2: 'Très dur',
  3: 'Dur',
  4: 'Exigeant',
  5: 'Soutenu',
  6: 'Correct',
  7: 'Confortable',
  8: 'Facile',
  9: 'Très facile',
  10: 'Excellent',
};

export const feelingLabel = (value: number | null | undefined) => (value ? (FEELING_SCALE[value] ?? '') : '');

const STEPS = Array.from({ length: 10 }, (_, index) => index + 1);

/**
 * La difficulté attendue d'une séance, posée par le coach.
 *
 * Même échelle que le ressenti de l'athlète — 1 épuisant, 10 excellent — pour
 * que les deux notes se comparent à la fin de la séance.
 */
export function ExpectedFeelingPicker({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="caption" style={styles.flex}>
          Ce que l’athlète devrait ressentir en rentrant
        </Text>
        {value ? <Chip label={`${value}/10 · ${feelingLabel(value)}`} tone="accent" /> : null}
      </View>
      <View style={styles.steps}>
        {STEPS.map((step) => {
          const filled = value !== null && step <= value;
          return (
            <Pressable
              key={step}
              accessibilityRole="button"
              accessibilityState={{ selected: value === step }}
              accessibilityLabel={`${step} sur 10 — ${FEELING_SCALE[step]}`}
              onPress={() => onChange(value === step ? null : step)}
              style={[
                styles.step,
                {
                  backgroundColor: filled ? colors.accentSoft : colors.surface,
                  borderColor: value === step ? colors.accentInk : filled ? colors.accentSoft : colors.border,
                },
              ]}>
              <Text variant="caption" style={{ color: filled ? colors.accentInk : colors.text3 }} tabular>
                {step}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  steps: { flexDirection: 'row', gap: 4 },
  step: { flex: 1, height: 36, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
