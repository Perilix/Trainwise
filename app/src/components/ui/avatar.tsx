import { View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

import { Text } from './text';

export type AvatarTone = 'primary' | 'accent' | 'violet' | 'highlight';

type Props = {
  initials: string;
  size?: number;
  tone?: AvatarTone;
};

export function Avatar({ initials, size = 36, tone = 'primary' }: Props) {
  const { colors } = useTheme();
  const tones: Record<AvatarTone, [string, string]> = {
    primary: [colors.primary, colors.onPrimary],
    accent: [colors.accentSoft, colors.accentInk],
    violet: [colors.violetSoft, colors.violetInk],
    highlight: [colors.highlight, '#003554'],
  };
  const [background, foreground] = tones[tone];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: radius.pill, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: foreground, fontFamily: fontFamily.semibold, fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.5), letterSpacing: 0.3 }}>
        {initials}
      </Text>
    </View>
  );
}
