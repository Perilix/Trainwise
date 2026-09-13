import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import type { KmSplit } from '@/features/athlete/types';
import { useTheme } from '@/theme/theme-provider';
import { fontFamily } from '@/theme/typography';

type Props = {
  splits: KmSplit[];
  width: number;
  height?: number;
};

const PAD_LEFT = 34;
const PAD_BOTTOM = 22;
const PAD_TOP = 12;

// Fréquence cardiaque moyenne par km (splits Strava).
export function HeartRateChart({ splits, width, height = 150 }: Props) {
  const { colors } = useTheme();
  const points = splits.filter((split): split is KmSplit & { avgHr: number } => typeof split.avgHr === 'number');
  if (points.length < 2) return null;

  const values = points.map((point) => point.avgHr);
  const min = Math.floor((Math.min(...values) - 8) / 10) * 10;
  const max = Math.ceil((Math.max(...values) + 8) / 10) * 10;
  const plotWidth = width - PAD_LEFT - 6;
  const x = (km: number) => PAD_LEFT + (km / splits.length) * plotWidth;
  const y = (hr: number) => PAD_TOP + (1 - (hr - min) / (max - min)) * (height - PAD_BOTTOM - PAD_TOP);
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(point.km - 0.5).toFixed(1)} ${y(point.avgHr).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points[points.length - 1].km - 0.5).toFixed(1)} ${height - PAD_BOTTOM} L${x(points[0].km - 0.5).toFixed(1)} ${height - PAD_BOTTOM} Z`;
  const step = (max - min) / 3;
  const ticks = [min + step, min + 2 * step, max].map(Math.round);
  const label = { fontFamily: fontFamily.regular, fontSize: 10, fill: colors.text3 };

  return (
    <Svg width={width} height={height} accessibilityLabel="Fréquence cardiaque moyenne par kilomètre">
      {ticks.map((tick) => (
        <Line key={`g${tick}`} x1={PAD_LEFT} x2={width} y1={y(tick)} y2={y(tick)} stroke={colors.border} strokeWidth={1} />
      ))}
      {ticks.map((tick) => (
        <SvgText key={`t${tick}`} {...label} x={PAD_LEFT - 8} y={y(tick) + 4} textAnchor="end">
          {String(tick)}
        </SvgText>
      ))}
      <Line x1={PAD_LEFT} x2={width} y1={height - PAD_BOTTOM} y2={height - PAD_BOTTOM} stroke={colors.borderStrong} strokeWidth={1} />
      {[0, Math.round(splits.length / 2), splits.length].map((km) => (
        <SvgText key={`k${km}`} {...label} x={x(km)} y={height - 6} textAnchor={km === splits.length ? 'end' : 'middle'}>
          {`${km} km`}
        </SvgText>
      ))}
      <Path d={area} fill={colors.accent} fillOpacity={0.1} />
      <Path d={line} fill="none" stroke={colors.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point) => (
        <Circle key={point.km} cx={x(point.km - 0.5)} cy={y(point.avgHr)} r={2.5} fill={colors.accent} stroke={colors.surface} strokeWidth={1} />
      ))}
    </Svg>
  );
}
