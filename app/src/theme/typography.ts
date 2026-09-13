import type { TextStyle } from 'react-native';

import type { Palette } from './tokens';

// Poppins chargée via @expo-google-fonts : une famille par graisse (fontWeight n'est pas fiable avec une police custom).
export const fontFamily = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export type TextVariant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'body2' | 'small' | 'caption' | 'overline' | 'stat';

type VariantSpec = { style: TextStyle; color: keyof Palette };

export const textVariants: Record<TextVariant, VariantSpec> = {
  display: { style: { fontFamily: fontFamily.semibold, fontSize: 34, lineHeight: 40, letterSpacing: -0.68 }, color: 'ink' },
  h1: { style: { fontFamily: fontFamily.semibold, fontSize: 24, lineHeight: 32, letterSpacing: -0.36 }, color: 'ink' },
  h2: { style: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 24 }, color: 'ink' },
  h3: { style: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20 }, color: 'ink' },
  body: { style: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21 }, color: 'ink' },
  body2: { style: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21 }, color: 'text2' },
  small: { style: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 }, color: 'text2' },
  caption: { style: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 }, color: 'text2' },
  overline: {
    style: { fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 16, letterSpacing: 0.66, textTransform: 'uppercase' },
    color: 'text3',
  },
  stat: { style: { fontFamily: fontFamily.semibold, fontSize: 20, lineHeight: 28 }, color: 'ink' },
};
