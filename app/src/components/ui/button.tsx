import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { Text } from './text';

// `inverse` : bouton blanc posé sur une surface de marque (carte du jour).
export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger' | 'inverse';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: IconName;
  fullWidth?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({ label, onPress, variant = 'primary', size = 'md', icon, fullWidth, disabled, style, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const tone = {
    primary: { bg: colors.primary, border: colors.primary, fg: colors.onPrimary },
    secondary: { bg: colors.surface, border: colors.borderStrong, fg: colors.ink },
    tonal: { bg: colors.accentSoft, border: colors.accentSoft, fg: colors.accentInk },
    ghost: { bg: 'transparent', border: 'transparent', fg: colors.accentInk },
    danger: { bg: 'transparent', border: 'transparent', fg: colors.danger },
    inverse: { bg: '#FFFFFF', border: '#FFFFFF', fg: '#003554' },
  }[variant];
  const small = size === 'sm';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={small ? 4 : 0}
      style={({ pressed }) => [
        styles.base,
        { height: small ? 36 : 48, paddingHorizontal: small ? 14 : 20, backgroundColor: tone.bg, borderColor: tone.border },
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {icon ? <Icon name={icon} size={small ? 16 : 18} color={tone.fg} strokeWidth={2} /> : null}
      <Text variant="h3" numberOfLines={1} style={{ color: tone.fg, fontSize: small ? 13 : 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
