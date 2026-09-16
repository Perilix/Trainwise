import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { fontFamily } from '@/theme/typography';

import { Text } from './text';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, actionLabel, onAction, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      <Text variant="sectionTitle" accessibilityRole="header">
        {title}
      </Text>
      {actionLabel ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={12}>
          <Text variant="small" color="accentInk" style={{ fontFamily: fontFamily.semibold }}>
            {actionLabel} →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
