import { Text as NativeText, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import type { Palette } from '@/theme/tokens';
import { textVariants, type TextVariant } from '@/theme/typography';

type Props = TextProps & {
  variant?: TextVariant;
  color?: keyof Palette;
  // Chiffres alignés (allures, durées, distances).
  tabular?: boolean;
};

export function Text({ variant = 'body', color, tabular, style, ...rest }: Props) {
  const { colors } = useTheme();
  const spec = textVariants[variant];
  const themed: TextStyle = { color: colors[color ?? spec.color] };
  if (tabular) themed.fontVariant = ['tabular-nums'];
  return <NativeText {...rest} style={[spec.style, themed, style]} />;
}
