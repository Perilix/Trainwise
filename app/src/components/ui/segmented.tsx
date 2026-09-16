import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

import { Text } from './text';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange?: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

export function Segmented<T extends string>({ options, value, onChange, style }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.track, { backgroundColor: colors.subtle }, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange?.(option.value)}
            style={[styles.item, selected && [styles.selected, { backgroundColor: colors.thumb }]]}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 13, lineHeight: 18, fontFamily: selected ? fontFamily.semibold : fontFamily.medium, color: selected ? colors.ink : colors.text2 }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 3, gap: 2, borderRadius: radius.md },
  item: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingHorizontal: 8 },
  selected: { boxShadow: '0 1px 2px rgba(5, 25, 35, 0.08)' },
});
