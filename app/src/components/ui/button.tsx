import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

import { GlassSurface, glassBackdrop } from './glass-surface';
import { Icon, type IconName } from './icon';
import { Text } from './text';

// `inverse` : bouton blanc posé sur une surface de marque (carte du jour).
export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger' | 'inverse' | 'accent' | 'violet';

// Variantes rendues en verre teinté : les boutons d'action, jamais les boutons discrets.
const GLASS_VARIANTS = new Set<ButtonVariant>(['primary', 'accent', 'violet', 'inverse']);

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  // `pill` : boutons posés sur une surface de marque ou en verre.
  shape?: 'md' | 'pill';
  icon?: IconName;
  // `trailing` : flèche posée après le libellé (« Voir la séance → »).
  iconPosition?: 'leading' | 'trailing';
  fullWidth?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({ label, onPress, variant = 'primary', size = 'md', shape = 'md', icon, iconPosition = 'leading', fullWidth, disabled, style, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const tone = {
    primary: { bg: colors.primary, border: colors.primary, fg: colors.onPrimary },
    secondary: { bg: colors.surface, border: colors.borderStrong, fg: colors.ink },
    tonal: { bg: colors.accentSoft, border: colors.accentSoft, fg: colors.accentInk },
    ghost: { bg: 'transparent', border: 'transparent', fg: colors.accentInk },
    danger: { bg: 'transparent', border: 'transparent', fg: colors.danger },
    inverse: { bg: '#FFFFFF', border: '#FFFFFF', fg: '#003554' },
    accent: { bg: colors.accent, border: colors.accent, fg: colors.ctaInk },
    violet: { bg: colors.violetBtn, border: colors.violetBtn, fg: '#FFFFFF' },
  }[variant];
  const small = size === 'sm';
  // Les boutons d'action portent leur couleur en verre teinté : sur iOS 26 ils prennent
  // le fond qu'ils survolent, ailleurs la couleur reste pleine (cf. docs/design-system.md § 5).
  const glass = GLASS_VARIANTS.has(variant);
  const shapeRadius = shape === 'pill' ? radius.pill : radius.md;

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
        { height: small ? 36 : 48, paddingHorizontal: small ? 14 : 20, borderColor: tone.border, borderRadius: shapeRadius },
        glass ? styles.glassBase : { backgroundColor: tone.bg },
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {glass ? <GlassSurface radius={shapeRadius} tint={tone.bg} style={glassBackdrop} /> : null}
      {icon && iconPosition === 'leading' ? <Icon name={icon} size={small ? 16 : 18} color={tone.fg} strokeWidth={2} /> : null}
      <Text variant="h3" numberOfLines={1} style={{ color: tone.fg, fontSize: small ? 13 : 14 }}>
        {label}
      </Text>
      {icon && iconPosition === 'trailing' ? <Icon name={icon} size={small ? 16 : 18} color={tone.fg} strokeWidth={2} /> : null}
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
  // Le verre est posé en fond absolu : le bouton lui-même reste transparent et rogne les coins.
  glassBase: { backgroundColor: 'transparent', overflow: 'hidden' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
});
