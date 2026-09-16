import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

// Le verre natif n'existe qu'à partir d'iOS 26 ; ailleurs on retombe sur une surface pleine (cf. docs/design-system.md § 5).
export const liquidGlass = isLiquidGlassAvailable();

export type GlassIntensity = 'regular' | 'strong';

type Props = {
  children?: ReactNode;
  // `strong` : les trois éléments signature (avatar, cloche, badge de série).
  intensity?: GlassIntensity;
  radius: number;
  interactive?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function GlassSurface({ children, intensity = 'regular', radius, interactive = true, accessibilityLabel, style }: Props) {
  const { colors, scheme } = useTheme();
  const shape: ViewStyle = { borderRadius: radius, overflow: 'hidden' };

  if (liquidGlass) {
    return (
      <GlassView
        glassEffectStyle={intensity === 'strong' ? 'clear' : 'regular'}
        colorScheme={scheme}
        isInteractive={interactive}
        accessible={!!accessibilityLabel}
        accessibilityLabel={accessibilityLabel}
        style={[shape, style]}>
        {children}
      </GlassView>
    );
  }

  // Repli : surface translucide + liseré, pour garder le même contraste sans le flou natif.
  const dark = scheme === 'dark';
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={[
        shape,
        {
          backgroundColor: dark ? 'rgba(26, 39, 49, 0.92)' : 'rgba(255, 255, 255, 0.92)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        intensity === 'strong' && (dark ? styles.strongDark : styles.strongLight),
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  strongLight: {
    ...Platform.select({
      ios: { shadowColor: '#003554', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 3 },
      default: {},
    }),
  },
  strongDark: {
    ...Platform.select({
      ios: { shadowColor: '#000000', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 4 },
      default: {},
    }),
  },
});
