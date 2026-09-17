import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

import { GlassSurface, glassBackdrop } from './glass-surface';
import { Icon, type IconName } from './icon';

type Props = {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  size?: number;
  // Bulle de verre : boutons posés sur le fond de page (retour, réglages, message).
  glass?: boolean;
  bordered?: boolean;
  badge?: boolean;
  color?: string;
};

export function IconButton({ icon, accessibilityLabel, onPress, size = 40, glass, bordered, badge, color }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={size < 44 ? (44 - size) / 2 : 0}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size },
        glass && { borderRadius: radius.pill, overflow: 'hidden' },
        bordered && !glass && { borderWidth: 1, borderColor: colors.borderStrong },
        pressed && (glass ? styles.pressed : { backgroundColor: colors.subtle }),
      ]}>
      {glass ? <GlassSurface intensity="strong" radius={radius.pill} style={glassBackdrop} /> : null}
      <Icon name={icon} size={20} color={color ?? colors.ink} />
      {badge ? <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.bg }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.94 }] },
  badge: { position: 'absolute', top: 7, right: 8, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
});
