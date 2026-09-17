import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/theme-provider';

// Le verre natif n'existe qu'à partir d'iOS 26 ; ailleurs on floute nous-mêmes (cf. docs/design-system.md § 5).
export const liquidGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

export type GlassIntensity = 'regular' | 'strong';

/** Verre posé en fond d'un élément tactile : reste sous son contenu. */
export const glassBackdrop = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 } as const;

type Props = {
  children?: ReactNode;
  // `strong` : les éléments signature (avatar, cloche, badge de série).
  intensity?: GlassIntensity;
  radius: number;
  // Verre teinté : boutons d'action, qui gardent leur couleur.
  tint?: string;
  // Reflet en haut de la surface : à couper sur une barre large, où il lirait comme un dégradé.
  sheen?: boolean;
  interactive?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

// Flou du repli : assez marqué pour qu'on lise le fond au travers sans gêner le texte posé dessus.
const BLUR = { regular: 28, strong: 44 } as const;

export function GlassSurface({ children, intensity = 'regular', radius, tint, sheen = true, interactive = true, accessibilityLabel, style }: Props) {
  const { scheme } = useTheme();
  const shape: ViewStyle = { borderRadius: radius, overflow: 'hidden' };
  const dark = scheme === 'dark';
  // Un dégradé par thème : tous les verres de l'écran partagent la même définition.
  const gradientId = dark ? 'glass-sheen-dark' : 'glass-sheen-light';

  if (liquidGlass) {
    return (
      <GlassView
        glassEffectStyle={intensity === 'strong' ? 'clear' : 'regular'}
        tintColor={tint}
        colorScheme={scheme}
        isInteractive={interactive}
        accessible={!!accessibilityLabel}
        accessibilityLabel={accessibilityLabel}
        style={[shape, style]}>
        {children}
      </GlassView>
    );
  }

  // Un bouton teinté garde sa couleur pleine : du texte clair sur une teinte translucide
  // passerait sous le seuil de contraste selon ce qui défile dessous.
  if (tint) {
    return <View style={[shape, { backgroundColor: tint }, style]}>{children}</View>;
  }

  // Repli : flou réel (backdrop-filter sur le web, RenderEffect sur Android 12+),
  // voile de surface translucide, liseré et reflet en haut.
  return (
    <View accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} style={[shape, style]}>
      <BlurView
        intensity={BLUR[intensity]}
        tint={dark ? 'dark' : 'light'}
        blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
        style={styles.layer}
      />
      <View
        pointerEvents="none"
        style={[
          styles.layer,
          {
            backgroundColor: dark ? 'rgba(20, 32, 41, 0.62)' : 'rgba(255, 255, 255, 0.62)',
            borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.75)',
          },
        ]}
      />
      {/* Reflet : la lumière accroche le haut du verre et s'éteint en diagonale. */}
      {sheen ? (
        <Svg pointerEvents="none" style={styles.layer}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0.65" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={dark ? 0.18 : 0.62} />
              <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      ) : null}
      {intensity === 'strong' ? <View pointerEvents="none" style={[styles.layer, { borderRadius: radius }, dark ? styles.ringDark : styles.ringLight]} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // `zIndex: -1` : sur le web, un enfant positionné passerait sinon devant le contenu posé sur le verre.
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 },
  // Liseré irisé des trois éléments signature : une pointe de bleu en haut, de violet en bas.
  ringLight: { borderWidth: 1, borderTopColor: 'rgba(0, 166, 251, 0.35)', borderLeftColor: 'rgba(0, 166, 251, 0.18)', borderRightColor: 'rgba(124, 92, 255, 0.18)', borderBottomColor: 'rgba(124, 92, 255, 0.3)' },
  ringDark: { borderWidth: 1, borderTopColor: 'rgba(0, 166, 251, 0.45)', borderLeftColor: 'rgba(0, 166, 251, 0.2)', borderRightColor: 'rgba(124, 92, 255, 0.22)', borderBottomColor: 'rgba(124, 92, 255, 0.38)' },
});
