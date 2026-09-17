import { View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

import { Text } from './text';

export type AvatarTone = 'primary' | 'accent' | 'violet' | 'violetSolid' | 'highlight' | 'personBlue' | 'personGreen' | 'personYellow' | 'personOrange' | 'personRed';

/**
 * Teintes qui distinguent les athlètes les uns des autres. Ni violet (réservé au
 * coach) ni orange Strava : ces deux-là portent déjà un sens.
 */
// Pastels, dans le même registre que le violet du coach.
const PEOPLE_TONES: readonly AvatarTone[] = ['personBlue', 'personGreen', 'personYellow', 'personOrange', 'personRed'];

/**
 * Même personne, même couleur d'une liste à l'autre : la teinte suit l'identifiant.
 * Haché depuis la fin, parce que les identifiants se ressemblent par le début —
 * un ObjectId commence par un horodatage, et deux comptes créés le même jour
 * repartiraient sur la même couleur.
 */
export function avatarToneFor(id: string | undefined): AvatarTone {
  if (!id) return PEOPLE_TONES[0];
  let hash = 7;
  for (let index = id.length - 1; index >= 0; index -= 1) hash = (Math.imul(hash, 131) + id.charCodeAt(index)) >>> 0;
  return PEOPLE_TONES[hash % PEOPLE_TONES.length];
}

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
    violetSolid: [colors.violet, '#FFFFFF'],
    highlight: [colors.highlight, '#003554'],
    personBlue: [colors.accentSoft, colors.accentInk],
    personGreen: [colors.successSoft, colors.successInk],
    personYellow: [colors.warningSoft, colors.warningInk],
    personOrange: [colors.stravaSoft, colors.stravaInk],
    personRed: [colors.dangerSoft, colors.danger],
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
