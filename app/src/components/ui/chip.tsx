import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export type ChipTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'violet' | 'strava' | 'primary';

type Props = {
  label: string;
  tone?: ChipTone;
  icon?: IconName;
};

// Toujours un libellé : la couleur seule ne porte jamais l'information.
export function Chip({ label, tone = 'neutral', icon }: Props) {
  const { colors } = useTheme();
  const tones: Record<ChipTone, [string, string]> = {
    neutral: [colors.subtle, colors.text2],
    accent: [colors.accentSoft, colors.accentInk],
    success: [colors.successSoft, colors.successInk],
    warning: [colors.warningSoft, colors.warningInk],
    danger: [colors.dangerSoft, colors.danger],
    violet: [colors.violetSoft, colors.violetInk],
    strava: [colors.stravaSoft, colors.stravaInk],
    primary: [colors.primary, colors.onPrimary],
  };
  const [background, foreground] = tones[tone];

  return (
    <View style={[styles.chip, { backgroundColor: background }]}>
      {icon ? <Icon name={icon} size={13} color={foreground} strokeWidth={2} /> : null}
      <Text variant="caption" numberOfLines={1} style={{ color: foreground }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    height: 24,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
  },
});
