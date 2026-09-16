import type { TextStyle } from 'react-native';

import type { Palette } from './tokens';

// Poppins chargée via @expo-google-fonts : une famille par graisse (fontWeight n'est pas fiable avec une police custom).
export const fontFamily = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
  // GulfsDisplay : titres, noms propres et grands chiffres uniquement (cf. docs/design-system.md).
  display: 'GulfsDisplay',
} as const;

export type TextVariant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'body2' | 'small' | 'caption' | 'overline' | 'sectionTitle' | 'stat';

type VariantSpec = { style: TextStyle; color: keyof Palette };

export const textVariants: Record<TextVariant, VariantSpec> = {
  display: { style: { fontFamily: fontFamily.display, fontSize: 23, lineHeight: 30 }, color: 'ink' },
  h1: { style: { fontFamily: fontFamily.display, fontSize: 22, lineHeight: 29 }, color: 'ink' },
  h2: { style: { fontFamily: fontFamily.display, fontSize: 17, lineHeight: 24 }, color: 'ink' },
  h3: { style: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, letterSpacing: -0.15 }, color: 'ink' },
  body: { style: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21 }, color: 'ink' },
  body2: { style: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21 }, color: 'text2' },
  small: { style: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 }, color: 'text2' },
  caption: { style: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 }, color: 'text2' },
  overline: {
    style: { fontFamily: fontFamily.bold, fontSize: 11, lineHeight: 14, letterSpacing: 0.66, textTransform: 'uppercase' },
    color: 'text3',
  },
  // Titre de section : capitales Poppins, jamais GulfsDisplay.
  sectionTitle: {
    style: { fontFamily: fontFamily.extrabold, fontSize: 13, lineHeight: 16, letterSpacing: 0.78, textTransform: 'uppercase' },
    color: 'primary',
  },
  stat: { style: { fontFamily: fontFamily.display, fontSize: 18, lineHeight: 24 }, color: 'ink' },
};
