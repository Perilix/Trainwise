import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { decodePolyline, projectPolyline } from '@/lib/polyline';
import { useTheme } from '@/theme/theme-provider';

type Props = {
  width: number;
  height: number;
  /** Tracé encodé de la sortie (Strava). Sans lui, un aperçu stylisé est dessiné. */
  polyline?: string | null;
  seed?: number;
};

// Tracé de la sortie. Le parcours réel est dessiné dès qu'il est disponible ;
// les sorties sans GPS (tapis, saisie manuelle) gardent l'aperçu stylisé.
export function RoutePreview({ width, height, polyline, seed = 1 }: Props) {
  const { colors, scheme } = useTheme();
  const map = scheme === 'dark' ? { bg: '#15222C', street: '#1D2C37', park: '#16302A' } : { bg: '#EDE9E1', street: '#E4DED3', park: '#DDE9D8' };

  const real = useMemo(() => (polyline ? projectPolyline(decodePolyline(polyline), width, height) : null), [polyline, width, height]);

  const points = Array.from({ length: 41 }, (_, i) => {
    const angle = (i / 40) * Math.PI * 2;
    const r = 0.36 + 0.07 * Math.sin(angle * 3 + seed) + 0.04 * Math.cos(angle * 5 + seed * 2);
    return [width / 2 + Math.cos(angle) * r * width * 0.95, height / 2 + Math.sin(angle) * r * height * 0.9] as const;
  });
  const fallback = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const route = real ?? fallback;
  const start = real ? route.slice(1).split(' ').slice(0, 2).map(Number) : [points[0][0], points[0][1]];

  const streets = [
    ...[1, 2, 3, 4, 5].map((i) => ({ d: `M0 ${(height / 6) * i + ((seed * 7) % 13)} L${width} ${(height / 6) * i - 18 + ((seed * 11) % 17)}`, w: i % 2 ? 6 : 3 })),
    ...[1, 2, 3, 4].map((i) => ({ d: `M${(width / 5) * i + ((seed * 13) % 19)} 0 L${(width / 5) * i - 30} ${height}`, w: i % 2 ? 3 : 5 })),
  ];

  return (
    <View aria-hidden>
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} rx={12} fill={map.bg} />
        {real ? null : <Rect x={width * 0.62} y={height * 0.08} width={width * 0.22} height={height * 0.3} rx={6} fill={map.park} />}
        {streets.map((street, i) => (
          <Path key={i} d={street.d} stroke={map.street} strokeWidth={street.w} />
        ))}
        <Path d={route} fill="none" stroke={colors.surface} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
        <Path d={route} fill="none" stroke={colors.accent} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={start[0]} cy={start[1]} r={6} fill={colors.primary} stroke={colors.surface} strokeWidth={2} />
      </Svg>
    </View>
  );
}
