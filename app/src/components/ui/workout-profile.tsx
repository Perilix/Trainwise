import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { intensityColor, intensityHeight, totals, type Segment } from '@/lib/sessions';
import { useTheme } from '@/theme/theme-provider';

type Props = {
  segments: readonly Segment[];
  width: number;
  height: number;
  gap?: number;
  // Durée de référence pour comparer deux profils à la même échelle (prévu / réalisé).
  totalSeconds?: number;
};

// Profil de séance : largeur = durée, hauteur = intensité (% VMA).
export function WorkoutProfile({ segments, width, height, gap = 1.5, totalSeconds }: Props) {
  const { ramp } = useTheme();
  const total = totalSeconds ?? totals(segments).sec;

  const bars = segments.map((segment, index) => {
    const start = segments.slice(0, index).reduce((sum, previous) => sum + previous.sec, 0);
    const x = (start / total) * width;
    const w = Math.max(1, (segment.sec / total) * width - gap);
    const h = intensityHeight(segment.pct, height);
    return { key: index, x, w, h, color: intensityColor(segment.pct, ramp) };
  });

  // Décoratif : masqué des lecteurs d'écran (aria-hidden fonctionne sur mobile comme sur le web).
  return (
    <View aria-hidden>
      <Svg width={width} height={height}>
        {bars.map((bar) => (
          <Rect key={bar.key} x={bar.x} y={height - bar.h} width={bar.w} height={bar.h} rx={Math.min(2, bar.w / 2)} fill={bar.color} />
        ))}
      </Svg>
    </View>
  );
}
