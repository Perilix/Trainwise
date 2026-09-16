import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { fontFamily } from '@/theme/typography';

import { Text } from './text';

type Props = {
  label: string;
  value: string;
  unit?: string;
  // Sur une surface de marque (carte navy), le contraste ne vient plus des jetons de texte.
  tint?: { label: string; value: string };
  style?: StyleProp<ViewStyle>;
};

export function Stat({ label, value, unit, tint, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <Text variant="overline" style={tint ? { color: tint.label } : undefined}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text variant="stat" tabular style={tint ? { color: tint.value } : undefined}>
          {value}
        </Text>
        {unit ? (
          <Text variant="small" style={[{ fontFamily: fontFamily.medium }, tint ? { color: tint.label } : undefined]}>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
});
