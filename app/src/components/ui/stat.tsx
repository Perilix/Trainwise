import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { fontFamily } from '@/theme/typography';

import { Text } from './text';

type Props = {
  label: string;
  value: string;
  unit?: string;
  style?: StyleProp<ViewStyle>;
};

export function Stat({ label, value, unit, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <Text variant="caption">{label}</Text>
      <View style={styles.valueRow}>
        <Text variant="stat" tabular>
          {value}
        </Text>
        {unit ? (
          <Text variant="small" style={{ fontFamily: fontFamily.medium }}>
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
