import type { ReactNode } from 'react';
import Svg, { Circle, Defs, Line, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/theme/theme-provider';
import { fontFamily } from '@/theme/typography';

/**
 * Les graphiques de l'écran Stats (forme d'un athlète), en SVG comme les autres
 * graphiques de l'app. Même dessin que sur le web (web-app/src/app/ui/form-charts.component.ts).
 * Ils reçoivent leur largeur : la carte qui les contient la mesure.
 */

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Graduations « rondes ». */
function niceTicks(min: number, max: number, count = 3): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => span / s <= count) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.01; v += step) ticks.push(Number(v.toFixed(6)));
  if (ticks[ticks.length - 1] < max) ticks.push(Number((ticks[ticks.length - 1] + step).toFixed(6)));
  return ticks;
}

function useLabel() {
  const { colors } = useTheme();
  return { fontFamily: fontFamily.regular, fontSize: 10, fill: colors.text3 };
}

// ---------------------------------------------------------------------------

export type LoadWeek = { label: string; total: number; habitual: number | null; low: number | null; high: number | null };
type NextWeek = { label: string; load: number; habitual: number | null; low: number | null; high: number | null };

/** Charge par semaine : barres, semaine prévue hachurée, charge habituelle et zone de progression. */
export function LoadChart({ weeks, remaining = 0, next, width, height = 170 }: { weeks: LoadWeek[]; remaining?: number; next: NextWeek | null; width: number; height?: number }) {
  const { colors } = useTheme();
  const label = useLabel();
  if (!weeks.length || width <= 0) return null;

  const all = [
    ...weeks.map((w, i) => ({ ...w, planned: i === weeks.length - 1 ? remaining : 0, next: false })),
    ...(next ? [{ label: next.label, total: 0, habitual: next.habitual, low: next.low, high: next.high, planned: next.load, next: true }] : []),
  ];
  const left = 30;
  const top = 14;
  const bottom = 22;
  const vmax = Math.max(50, ...all.map((w) => Math.max(w.total + w.planned, w.high ?? 0))) * 1.08;
  const ticks = niceTicks(0, vmax);
  const tmax = ticks[ticks.length - 1];
  const y = (v: number) => top + (height - top - bottom) * (1 - v / tmax);
  const cw = (width - left) / all.length;
  const bw = Math.max(5, Math.min(26, cw * 0.56));
  const cx = (i: number) => left + cw * (i + 0.5);

  const band = all.map((w, i) => ({ i, low: w.low, high: w.high })).filter((p): p is { i: number; low: number; high: number } => p.low != null && p.high != null);
  const bandPath = band.length > 1 ? 'M' + band.map((p) => `${r1(cx(p.i))} ${r1(y(p.high))}`).join(' L') + ' L' + [...band].reverse().map((p) => `${r1(cx(p.i))} ${r1(y(p.low))}`).join(' L') + ' Z' : null;
  const hab = all.map((w, i) => ({ i, v: w.habitual })).filter((p): p is { i: number; v: number } => p.v != null);
  const habPath = hab.length > 1 ? 'M' + hab.map((p) => `${r1(cx(p.i))} ${r1(y(p.v))}`).join(' L') : null;
  const last = all[all.length - 1];
  const alert = last.next && last.high != null && last.planned > last.high;

  return (
    <Svg width={width} height={height} accessibilityLabel="Charge d’entraînement par semaine">
      <Defs>
        <Pattern id="hatch" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <Rect width={6} height={6} fill={colors.surface} />
          <Line x1={0} y1={0} x2={0} y2={6} stroke={colors.accent} strokeWidth={2} strokeOpacity={0.55} />
        </Pattern>
      </Defs>
      {ticks.map((t) => (
        <Line key={`g${t}`} x1={left} x2={width} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
      ))}
      {ticks.map((t) => (
        <SvgText key={`t${t}`} {...label} x={left - 6} y={y(t) + 3.5} textAnchor="end">
          {String(t)}
        </SvgText>
      ))}
      {bandPath ? <Path d={bandPath} fill={colors.success} fillOpacity={0.1} /> : null}
      {all.map((w, i) => {
        const x = cx(i) - bw / 2;
        const showLabel = (all.length - 1 - i) % 2 === 0;
        return (
          <SvgGroupBar
            key={w.label}
            x={x}
            bw={bw}
            yTop={y(w.total)}
            yZero={y(0)}
            yPlan={y(w.total + w.planned)}
            planned={w.planned > 0}
            done={w.total > 0}
            accent={colors.accent}
            label={showLabel ? w.label : ''}
            labelX={cx(i)}
            labelY={height - 6}
            labelStyle={w.next ? { ...label, fill: colors.ink, fontFamily: fontFamily.semibold } : label}
          />
        );
      })}
      {habPath ? <Path d={habPath} fill="none" stroke={colors.ink} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
      {alert ? (
        <>
          <Circle cx={cx(all.length - 1)} cy={y(last.planned) - 11} r={6.5} fill={colors.warningInk} />
          <SvgText x={cx(all.length - 1)} y={y(last.planned) - 7.7} textAnchor="middle" fontSize={9.5} fontFamily={fontFamily.bold} fill={colors.surface}>
            !
          </SvgText>
        </>
      ) : null}
    </Svg>
  );
}

function SvgGroupBar(p: {
  x: number;
  bw: number;
  yTop: number;
  yZero: number;
  yPlan: number;
  planned: boolean;
  done: boolean;
  accent: string;
  label: string;
  labelX: number;
  labelY: number;
  labelStyle: object;
}) {
  return (
    <>
      {p.done ? <Rect x={r1(p.x)} y={r1(p.yTop)} width={r1(p.bw)} height={r1(p.yZero - p.yTop)} rx={3} fill={p.accent} /> : null}
      {p.planned ? (
        <Rect x={r1(p.x)} y={r1(p.yPlan)} width={r1(p.bw)} height={r1(p.yTop - p.yPlan)} rx={3} fill="url(#hatch)" stroke={p.accent} strokeOpacity={0.6} strokeDasharray="3 2" />
      ) : null}
      <SvgText {...p.labelStyle} x={p.labelX} y={p.labelY} textAnchor="middle">
        {p.label}
      </SvgText>
    </>
  );
}

// ---------------------------------------------------------------------------

export type LineSeries = { values: (number | null)[]; color: string; area?: boolean; dashed?: boolean };

/** Une ou plusieurs courbes, un point par semaine. */
export function TrendChart({
  labels,
  series,
  width,
  height = 150,
  min,
  max,
  unit = '',
  refValue,
  refLabel,
}: {
  labels: string[];
  series: LineSeries[];
  width: number;
  height?: number;
  min?: number;
  max?: number;
  unit?: string;
  refValue?: number | null;
  refLabel?: string;
}) {
  const { colors } = useTheme();
  const label = useLabel();
  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  if (all.length < 2 || labels.length < 2 || width <= 0) return null;
  const lo = min ?? Math.floor(Math.min(...all, refValue ?? Infinity) - 2);
  const hi = max ?? Math.ceil(Math.max(...all, refValue ?? -Infinity) + 2);
  const ticks = niceTicks(lo, hi);
  const tmin = ticks[0];
  const tmax = ticks[ticks.length - 1];
  const left = 34;
  const top = 10;
  const bottom = 22;
  const step = (width - left - 6) / (labels.length - 1);
  const x = (i: number) => left + 3 + step * i;
  const y = (v: number) => top + (height - top - bottom) * (1 - (v - tmin) / (tmax - tmin));

  return (
    <Svg width={width} height={height}>
      {ticks.map((t) => (
        <Line key={`g${t}`} x1={left} x2={width} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
      ))}
      {ticks.map((t) => (
        <SvgText key={`t${t}`} {...label} x={left - 6} y={y(t) + 3.5} textAnchor="end">
          {`${String(t).replace('.', ',')}${unit}`}
        </SvgText>
      ))}
      {refValue != null ? (
        <>
          <Line x1={left} x2={width} y1={y(refValue)} y2={y(refValue)} stroke={colors.text3} strokeDasharray="4 4" strokeWidth={1} />
          {refLabel ? (
            <SvgText {...label} fill={colors.text2} x={width} y={y(refValue) - 5} textAnchor="end">
              {refLabel}
            </SvgText>
          ) : null}
        </>
      ) : null}
      {labels.map((l, i) =>
        (labels.length - 1 - i) % 2 === 0 ? (
          <SvgText key={`x${i}`} {...label} x={i === labels.length - 1 ? x(i) + 3 : x(i)} y={height - 6} textAnchor={i === labels.length - 1 ? 'end' : 'middle'}>
            {l}
          </SvgText>
        ) : null,
      )}
      {series.map((s, k) => {
        const pts = s.values.map((v, i) => (v == null ? null : { x: r1(x(i)), y: r1(y(v)) })).filter((p): p is { x: number; y: number } => !!p);
        if (!pts.length) return null;
        const d = 'M' + pts.map((p) => `${p.x} ${p.y}`).join(' L');
        return (
          <SvgSeries key={k} d={d} area={s.area && pts.length > 1 ? `${d} L${pts[pts.length - 1].x} ${r1(y(tmin))} L${pts[0].x} ${r1(y(tmin))} Z` : null} pts={pts} color={s.color} dashed={!!s.dashed} surface={colors.surface} />
        );
      })}
    </Svg>
  );
}

function SvgSeries({ d, area, pts, color, dashed, surface }: { d: string; area: string | null; pts: { x: number; y: number }[]; color: string; dashed: boolean; surface: string }) {
  return (
    <>
      {area ? <Path d={area} fill={color} fillOpacity={0.1} /> : null}
      <Path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dashed ? '5 4' : undefined} />
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4 : 2.8} fill={color} stroke={surface} strokeWidth={1.5} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------

/** Ressenti après séance : un point par séance, la moyenne sur 7 jours par-dessus. */
export function FeelingChart({
  points,
  average,
  from,
  to,
  width,
  height = 150,
}: {
  points: { date: string; value: number }[];
  average: { date: string; value: number | null }[];
  from: string;
  to: string;
  width: number;
  height?: number;
}) {
  const { colors } = useTheme();
  const label = useLabel();
  if (!points.length || width <= 0) return null;
  const start = new Date(from + 'T00:00:00').getTime();
  const end = new Date(to).getTime();
  const left = 24;
  const top = 10;
  const bottom = 22;
  const x = (d: string) => left + 5 + ((new Date(d).getTime() - start) / (end - start || 1)) * (width - left - 10);
  const y = (v: number) => top + (height - top - bottom) * (1 - (v - 1) / 9);
  const avg = average.filter((a): a is { date: string; value: number } => a.value != null);
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <Svg width={width} height={height}>
      <Rect x={left} y={y(10)} width={width - left} height={y(7) - y(10)} fill={colors.success} fillOpacity={0.07} />
      <Rect x={left} y={y(4)} width={width - left} height={y(1) - y(4)} fill={colors.warning} fillOpacity={0.08} />
      {[1, 4, 7, 10].map((v) => (
        <Line key={`g${v}`} x1={left} x2={width} y1={y(v)} y2={y(v)} stroke={colors.border} strokeWidth={1} />
      ))}
      {[1, 4, 7, 10].map((v) => (
        <SvgText key={`t${v}`} {...label} x={left - 6} y={y(v) + 3.5} textAnchor="end">
          {String(v)}
        </SvgText>
      ))}
      {points.map((p, i) => (
        <Circle key={i} cx={x(p.date)} cy={y(p.value)} r={3.5} fill={p.value >= 7 ? colors.success : p.value <= 4 ? colors.warningInk : colors.accent} fillOpacity={0.9} stroke={colors.surface} strokeWidth={1.2} />
      ))}
      {avg.length > 1 ? <Path d={'M' + avg.map((a) => `${r1(x(a.date))} ${r1(y(a.value))}`).join(' L')} fill="none" stroke={colors.ink} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
      {[0, 0.5, 1].map((f) => (
        <SvgText key={`d${f}`} {...label} x={left + 5 + f * (width - left - 10)} y={height - 6} textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}>
          {fmt.format(new Date(start + f * (end - start))).replace('.', '')}
        </SvgText>
      ))}
    </Svg>
  );
}

// ---------------------------------------------------------------------------

/** Barres empilées : km par intensité, tonnage. */
export function StackChart({ labels, stacks, colors: palette, width, height = 150, unit = '' }: { labels: string[]; stacks: number[][]; colors: string[]; width: number; height?: number; unit?: string }) {
  const { colors } = useTheme();
  const label = useLabel();
  const totals = stacks.map((s) => s.reduce((a, b) => a + b, 0));
  if (!totals.some((t) => t > 0) || width <= 0) return null;
  const left = 30;
  const top = 10;
  const bottom = 22;
  const ticks = niceTicks(0, Math.max(...totals) * 1.05);
  const tmax = ticks[ticks.length - 1];
  const y = (v: number) => top + (height - top - bottom) * (1 - v / tmax);
  const cw = (width - left) / stacks.length;
  const bw = Math.max(5, Math.min(26, cw * 0.56));

  return (
    <Svg width={width} height={height}>
      {ticks.map((t) => (
        <Line key={`g${t}`} x1={left} x2={width} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
      ))}
      {ticks.map((t) => (
        <SvgText key={`t${t}`} {...label} x={left - 6} y={y(t) + 3.5} textAnchor="end">
          {`${String(t).replace('.', ',')}${unit}`}
        </SvgText>
      ))}
      {stacks.map((parts, i) => {
        const cx = left + cw * (i + 0.5);
        let acc = 0;
        return (
          <SvgStack key={i} cx={cx} bw={bw} label={(stacks.length - 1 - i) % 2 === 0 ? labels[i] : ''} labelY={height - 6} labelStyle={label}>
            {parts.map((v, k) => {
              if (!v) return null;
              const y1 = y(acc + v);
              const y0 = y(acc);
              const gap = acc ? 1.5 : 0;
              acc += v;
              return <Rect key={k} x={r1(cx - bw / 2)} y={r1(y1)} width={r1(bw)} height={r1(Math.max(1, y0 - y1 - gap))} rx={2.5} fill={palette[k]} />;
            })}
          </SvgStack>
        );
      })}
    </Svg>
  );
}

function SvgStack({ cx, label, labelY, labelStyle, children }: { cx: number; bw: number; label: string; labelY: number; labelStyle: object; children: ReactNode }) {
  return (
    <>
      {children}
      <SvgText {...labelStyle} x={cx} y={labelY} textAnchor="middle">
        {label}
      </SvgText>
    </>
  );
}
