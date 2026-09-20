import { Pressable, StyleSheet, View } from 'react-native';

import { Chip, Text } from '@/components/ui';
import { useTheme } from '@/theme/theme-provider';
import { fontFamily } from '@/theme/typography';
import { radius } from '@/theme/tokens';

/** Ce que veut dire une note, pour que le coach et l'athlète parlent de la même chose. */
export const FEELING_SCALE: Record<number, string> = {
  1: 'Très facile',
  2: 'Facile',
  3: 'Tranquille',
  4: 'Modérée',
  5: 'Soutenue',
  6: 'Exigeante',
  7: 'Dure',
  8: 'Très dure',
  9: 'Maximale',
  10: 'Épuisante',
};

export const feelingLabel = (value: number | null | undefined) => (value ? (FEELING_SCALE[value] ?? '') : '');

/**
 * La couleur d'une note, du rouge au vert.
 *
 * L'échelle va du plus facile au plus dur : 1 très facile, 10 épuisante. Le
 * vert et le rouge y portent le sens qu'on leur donne partout ailleurs — c'est
 * tranquille, c'est costaud — donc ils prolongent le code couleur de l'app.
 */
export const FEELING_TINT: Record<number, { soft: string; ink: string }> = {
  1: { soft: '#E4F1E6', ink: '#41815A' },
  2: { soft: '#E4F1E6', ink: '#41815A' },
  3: { soft: '#EDF3DC', ink: '#6E8A2E' },
  4: { soft: '#EDF3DC', ink: '#6E8A2E' },
  5: { soft: '#FAF0D8', ink: '#96731C' },
  6: { soft: '#FAF0D8', ink: '#96731C' },
  7: { soft: '#FBE8D8', ink: '#B4662F' },
  8: { soft: '#FBE8D8', ink: '#B4662F' },
  9: { soft: '#FBE4E2', ink: '#B4463D' },
  10: { soft: '#FBE4E2', ink: '#B4463D' },
};

const STEPS = Array.from({ length: 10 }, (_, index) => index + 1);

/**
 * La difficulté attendue d'une séance, posée par le coach.
 *
 * 1 très facile, 10 épuisante. C'est l'inverse de l'échelle de ressenti que
 * l'athlète remplit après coup, où 10 veut dire « je me sentais bien ».
 */
export function ExpectedFeelingPicker({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="caption" style={styles.flex}>
          Ce que la séance devrait coûter à l’athlète
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
  readWrap: { gap: 6 },
  readStep: { flex: 1, height: 28, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});

/** La même échelle, en lecture seule : les dix chiffres, celui qui compte détouré. */
export function FeelingScale({ value, label = 'Difficulté attendue' }: { value: number; label?: string }) {
  return (
    <View style={styles.readWrap}>
      <Text variant="caption">{label}</Text>
      <View style={styles.steps}>
        {STEPS.map((step) => {
          const tint = FEELING_TINT[step];
          const on = step === value;
          return (
            <View
              key={step}
              // Seule la note retenue est pleinement lisible : les autres situent l'échelle.
              style={[styles.readStep, { backgroundColor: tint.soft, opacity: on ? 1 : 0.45, borderColor: on ? tint.ink : 'transparent' }]}>
              <Text variant="caption" style={{ color: tint.ink, fontFamily: on ? fontFamily.bold : fontFamily.regular }} tabular>
                {step}
              </Text>
            </View>
          );
        })}
      </View>
      <Text variant="caption">
        {value}/10 · {feelingLabel(value)}
      </Text>
    </View>
  );
}
