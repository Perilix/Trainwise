import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { KmSplit } from '@/features/athlete/types';
import { formatPace } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { fontFamily } from '@/theme/typography';

type Props = {
  splits: KmSplit[];
  width: number;
  height?: number;
};

const PAD_LEFT = 38;
const PAD_BOTTOM = 22;
const PAD_TOP = 24;

// Allure par km (un point par split Strava), plus rapide en haut, moitiés de course mises en évidence.
export function PaceChart({ splits, width, height = 180 }: Props) {
  const { colors } = useTheme();
  if (splits.length < 2) return null;

  const paces = splits.map((split) => split.paceSecPerKm);
  const fastest = Math.min(...paces);
  const slowest = Math.max(...paces);
  const average = paces.reduce((sum, pace) => sum + pace, 0) / paces.length;
  const min = Math.floor((fastest - 5) / 10) * 10;
  const max = Math.ceil((slowest + 5) / 10) * 10;
  const half = Math.floor(splits.length / 2);
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const firstHalf = mean(paces.slice(0, half));
  const secondHalf = mean(paces.slice(half));

  const plotWidth = width - PAD_LEFT - 6;
  const x = (km: number) => PAD_LEFT + (km / splits.length) * plotWidth;
  const y = (pace: number) => PAD_TOP + ((pace - min) / (max - min)) * (height - PAD_BOTTOM - PAD_TOP);
  const line = splits.map((split, index) => `${index ? 'L' : 'M'}${x(index + 0.5).toFixed(1)} ${y(split.paceSecPerKm).toFixed(1)}`).join(' ');
  const ticks = [min, (min + max) / 2, max];
  const kmTicks = [0, Math.round(splits.length / 4), Math.round(splits.length / 2), Math.round((3 * splits.length) / 4), splits.length];
  const label = { fontFamily: fontFamily.regular, fontSize: 10, fill: colors.text3 };

  return (
    <Svg width={width} height={height} accessibilityLabel={`Allure moyenne ${formatPace(average)} par km, plus rapide ${formatPace(fastest)}`}>
      <Rect x={x(half)} y={PAD_TOP - 18} width={x(splits.length) - x(half)} height={height - PAD_BOTTOM - PAD_TOP + 18} fill={colors.accent} fillOpacity={0.07} />
      <SvgText {...label} x={x(half / 2)} y={PAD_TOP - 6} textAnchor="middle">{`1ʳᵉ moitié · ${formatPace(firstHalf)}`}</SvgText>
      <SvgText {...label} fontFamily={fontFamily.semibold} fill={colors.accentInk} x={x(half + (splits.length - half) / 2)} y={PAD_TOP - 6} textAnchor="middle">
        {`2ᵉ moitié · ${formatPace(secondHalf)}`}
      </SvgText>
      {ticks.map((tick) => (
        <Line key={`g${tick}`} x1={PAD_LEFT} x2={width} y1={y(tick)} y2={y(tick)} stroke={colors.border} strokeWidth={1} />
      ))}
      {ticks.map((tick) => (
        <SvgText key={`t${tick}`} {...label} x={PAD_LEFT - 8} y={y(tick) + 4} textAnchor="end">
          {formatPace(tick)}
        </SvgText>
      ))}
      <Line x1={PAD_LEFT} x2={width} y1={height - PAD_BOTTOM} y2={height - PAD_BOTTOM} stroke={colors.borderStrong} strokeWidth={1} />
      {kmTicks.map((km) => (
        <SvgText key={`k${km}`} {...label} x={x(km)} y={height - 6} textAnchor={km === splits.length ? 'end' : 'middle'}>
          {`${km} km`}
        </SvgText>
      ))}
      <Line x1={PAD_LEFT} x2={width - 6} y1={y(average)} y2={y(average)} stroke={colors.ink} strokeOpacity={0.45} strokeDasharray="4 4" />
      <Path d={line} fill="none" stroke={colors.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {splits.map((split, index) => (
        <Circle
          key={split.km}
          cx={x(index + 0.5)}
          cy={y(split.paceSecPerKm)}
          r={split.paceSecPerKm === fastest ? 5 : 3}
          fill={colors.accent}
          stroke={colors.surface}
          strokeWidth={1.5}
        />
      ))}
    </Svg>
  );
}
