import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

import { Text } from './text';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** radio : un seul choix ; checkbox : plusieurs. */
  role?: 'radio' | 'checkbox';
};

// Pastille sélectionnable (type de séance, disciplines…).
export function ChoicePill({ label, selected, onPress, role = 'checkbox' }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      onPress={onPress}
      style={[styles.pill, selected ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="small" style={{ color: selected ? colors.onPrimary : colors.ink, fontFamily: fontFamily.medium }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
});
