import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { hostWidth } from './host-width';

/**
 * Les graphiques de l'écran Stats (forme d'un athlète). Tous en SVG dessiné à
 * la main, comme le reste de l'app : ils mesurent leur largeur et suivent les
 * jetons de couleur, donc le mode sombre.
 */

const LBL = `
  :host { display: block; width: 100%; }
  svg { display: block; width: 100%; overflow: visible; }
  .lbl { font-size: 11px; fill: var(--text3); font-family: 'Poppins', sans-serif; }
  .lbl.on { fill: var(--ink); font-weight: 600; }
  .ref { font-size: 10.5px; fill: var(--text2); font-family: 'Poppins', sans-serif; }
`;

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Graduations « rondes » entre 0 (ou min) et un max. */
function niceTicks(min: number, max: number, count = 4): number[] {
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

// ---------------------------------------------------------------------------
// Charge d'entraînement : barres, semaine prévue hachurée, charge habituelle, zone
// ---------------------------------------------------------------------------

export type LoadWeek = { label: string; total: number; habitual: number | null; low: number | null; high: number | null };

@Component({
  selector: 'tw-load-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (model(); as m) {
      <svg [attr.height]="height()" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" role="img" aria-label="Charge d’entraînement par semaine">
        <defs>
          <pattern [attr.id]="hatchId" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--surface)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" stroke-width="2" stroke-opacity="0.55" />
          </pattern>
        </defs>
        @for (t of m.ticks; track t.value) {
          <line [attr.x1]="m.left" [attr.x2]="width()" [attr.y1]="t.y" [attr.y2]="t.y" stroke="var(--border)" />
          <text [attr.x]="m.left - 8" [attr.y]="t.y + 4" text-anchor="end" class="lbl">{{ t.value }}</text>
        }
        @if (m.band) {
          <path [attr.d]="m.band" fill="var(--success)" fill-opacity="0.1" />
        }
        @for (b of m.bars; track b.label) {
          @if (b.h > 0) {
            <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="m.bw" [attr.height]="b.h" rx="3" fill="var(--accent)" />
          }
          @if (b.planH > 0) {
            <rect [attr.x]="b.x" [attr.y]="b.planY" [attr.width]="m.bw" [attr.height]="b.planH" rx="3" [attr.fill]="'url(#' + hatchId + ')'"
              stroke="var(--accent)" stroke-opacity="0.6" stroke-dasharray="3 2" />
          }
          <text [attr.x]="b.cx" [attr.y]="height() - 6" text-anchor="middle" class="lbl" [class.on]="b.next">{{ b.showLabel ? b.label : '' }}</text>
        }
        @if (m.habitual) {
          <path [attr.d]="m.habitual" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        }
        @if (m.alert; as a) {
          <circle [attr.cx]="a.x" [attr.cy]="a.y" r="7" fill="var(--warn-ink)" />
          <text [attr.x]="a.x" [attr.y]="a.y + 3.5" text-anchor="middle" font-size="10" font-weight="700" fill="var(--surface)">!</text>
        }
      </svg>
    }
  `,
  styles: [LBL],
})
export class LoadChartComponent {
  readonly weeks = input.required<LoadWeek[]>();
  /** Ce qui reste prévu cette semaine, empilé sur la dernière barre. */
  readonly remaining = input(0);
  readonly next = input<{ label: string; load: number; habitual: number | null; low: number | null; high: number | null } | null>(null);
  readonly height = input(230);
  readonly compact = input(false);
  private readonly measured = hostWidth(640);
  readonly width = computed(() => this.measured());
  protected readonly hatchId = `hatch-${Math.random().toString(36).slice(2, 8)}`;

  readonly model = computed(() => {
    const weeks = this.weeks();
    if (!weeks.length) return null;
    const next = this.next();
    const all = [...weeks.map((w) => ({ ...w, planned: 0, next: false })), ...(next ? [{ label: next.label, total: 0, habitual: next.habitual, low: next.low, high: next.high, planned: next.load, next: true }] : [])];
    all[weeks.length - 1].planned = this.remaining();

    const left = 36;
    const top = 16;
    const bottom = 24;
    const W = this.width();
    const H = this.height();
    const vmax = Math.max(50, ...all.map((w) => Math.max(w.total + w.planned, w.high ?? 0))) * 1.08;
    const ticks = niceTicks(0, vmax, 3);
    const tmax = ticks[ticks.length - 1];
    const y = (v: number) => top + (H - top - bottom) * (1 - v / tmax);
    const cw = (W - left) / all.length;
    const bw = Math.max(6, Math.min(34, cw * (this.compact() ? 0.56 : 0.5)));
    const cx = (i: number) => left + cw * (i + 0.5);

    const bars = all.map((w, i) => {
      const yTop = y(w.total);
      return {
        label: w.label,
        next: w.next,
        cx: r1(cx(i)),
        x: r1(cx(i) - bw / 2),
        y: r1(yTop),
        h: r1(y(0) - yTop),
        planY: r1(y(w.total + w.planned)),
        planH: w.planned ? r1(yTop - y(w.total + w.planned)) : 0,
        showLabel: !this.compact() || i % 2 === all.length % 2 || i === all.length - 1,
      };
    });

    const withBand = all.map((w, i) => ({ i, low: w.low, high: w.high })).filter((p) => p.low != null && p.high != null) as { i: number; low: number; high: number }[];
    const band = withBand.length > 1
      ? 'M' + withBand.map((p) => `${r1(cx(p.i))} ${r1(y(p.high))}`).join(' L') + ' L' + [...withBand].reverse().map((p) => `${r1(cx(p.i))} ${r1(y(p.low))}`).join(' L') + ' Z'
      : null;
    const hab = all.map((w, i) => ({ i, v: w.habitual })).filter((p) => p.v != null) as { i: number; v: number }[];
    const habitual = hab.length > 1 ? 'M' + hab.map((p) => `${r1(cx(p.i))} ${r1(y(p.v))}`).join(' L') : null;

    const last = all[all.length - 1];
    const alert = last.next && last.high != null && last.planned > last.high ? { x: r1(cx(all.length - 1)), y: r1(y(last.planned) - 12) } : null;

    return { left, ticks: ticks.map((value) => ({ value, y: r1(y(value)) })), bars, bw: r1(bw), band, habitual, alert };
  });
}

// ---------------------------------------------------------------------------
// Courbe(s) semaine par semaine
// ---------------------------------------------------------------------------

export type LineSeries = { values: (number | null)[]; color: string; area?: boolean; dashed?: boolean };

@Component({
  selector: 'tw-trend-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (model(); as m) {
      <svg [attr.height]="height()" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" role="img" [attr.aria-label]="label()">
        @for (t of m.ticks; track t.value) {
          <line [attr.x1]="m.left" [attr.x2]="width()" [attr.y1]="t.y" [attr.y2]="t.y" stroke="var(--border)" />
          <text [attr.x]="m.left - 8" [attr.y]="t.y + 4" text-anchor="end" class="lbl">{{ t.text }}</text>
        }
        @if (m.ref; as ref) {
          <line [attr.x1]="m.left" [attr.x2]="width()" [attr.y1]="ref.y" [attr.y2]="ref.y" stroke="var(--text3)" stroke-dasharray="4 4" />
          @if (refLabel()) {
            <text [attr.x]="width()" [attr.y]="ref.y - 6" text-anchor="end" class="ref">{{ refLabel() }}</text>
          }
        }
        @for (l of m.xLabels; track $index) {
          <text [attr.x]="l.x" [attr.y]="height() - 6" [attr.text-anchor]="l.anchor" class="lbl">{{ l.text }}</text>
        }
        @for (s of m.series; track $index) {
          @if (s.area) {
            <path [attr.d]="s.area" [attr.fill]="s.color" fill-opacity="0.1" />
          }
          <path [attr.d]="s.line" fill="none" [attr.stroke]="s.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"
            [attr.stroke-dasharray]="s.dashed ? '5 4' : null" />
          @for (p of s.points; track $index) {
            <circle [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="$last ? 4.5 : 3" [attr.fill]="s.color" stroke="var(--surface)" stroke-width="1.5" />
          }
        }
      </svg>
    } @else {
      <p class="small muted empty">{{ emptyText() }}</p>
    }
  `,
  styles: [LBL + ` .empty { margin: 12px 0 0; }`],
})
export class TrendChartComponent {
  readonly labels = input.required<string[]>();
  readonly series = input.required<LineSeries[]>();
  readonly height = input(190);
  readonly unit = input('');
  readonly min = input<number | null>(null);
  readonly max = input<number | null>(null);
  readonly ref = input<number | null>(null);
  readonly refLabel = input('');
  readonly label = input('Évolution');
  readonly emptyText = input('Pas encore assez de données.');
  readonly compact = input(false);
  private readonly measured = hostWidth(480);
  readonly width = computed(() => this.measured());

  readonly model = computed(() => {
    const labels = this.labels();
    const all = this.series().flatMap((s) => s.values).filter((v): v is number => v != null);
    if (all.length < 2 || labels.length < 2) return null;
    const ref = this.ref();
    const lo = this.min() ?? Math.floor(Math.min(...all, ref ?? Infinity) - 2);
    const hi = this.max() ?? Math.ceil(Math.max(...all, ref ?? -Infinity) + 2);
    const ticks = niceTicks(lo, hi, 3);
    const tmin = ticks[0];
    const tmax = ticks[ticks.length - 1];
    const left = 42;
    const top = 12;
    const bottom = 24;
    const W = this.width();
    const H = this.height();
    const step = (W - left - 8) / (labels.length - 1);
    const x = (i: number) => left + 4 + step * i;
    const y = (v: number) => top + (H - top - bottom) * (1 - (v - tmin) / (tmax - tmin));
    const unit = this.unit();

    const series = this.series().map((s) => {
      const points = s.values.map((v, i) => (v == null ? null : { x: r1(x(i)), y: r1(y(v)) })).filter((p): p is { x: number; y: number } => !!p);
      const line = points.length ? 'M' + points.map((p) => `${p.x} ${p.y}`).join(' L') : '';
      const area = s.area && points.length > 1 ? `${line} L${points[points.length - 1].x} ${r1(y(tmin))} L${points[0].x} ${r1(y(tmin))} Z` : null;
      return { color: s.color, dashed: !!s.dashed, points, line, area };
    });

    const every = this.compact() && labels.length > 5 ? 2 : 1;
    const xLabels = labels
      .map((text, i) => ({ text, x: r1(x(i)), anchor: i === labels.length - 1 && this.compact() ? 'end' : 'middle', i }))
      .filter((l) => (labels.length - 1 - l.i) % every === 0);

    return {
      left,
      ticks: ticks.map((value) => ({ value, y: r1(y(value)), text: `${String(value).replace('.', ',')}${unit ? ' ' + unit : ''}` })),
      ref: ref != null ? { y: r1(y(ref)) } : null,
      series,
      xLabels,
    };
  });
}

// ---------------------------------------------------------------------------
// Ressenti après séance : un point par séance, et la moyenne sur 7 jours
// ---------------------------------------------------------------------------

@Component({
  selector: 'tw-feeling-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (model(); as m) {
      <svg [attr.height]="height()" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" role="img" aria-label="Ressenti après chaque séance">
        <rect [attr.x]="m.left" [attr.y]="m.good.y" [attr.width]="width() - m.left" [attr.height]="m.good.h" fill="var(--success)" fill-opacity="0.07" />
        <rect [attr.x]="m.left" [attr.y]="m.bad.y" [attr.width]="width() - m.left" [attr.height]="m.bad.h" fill="var(--warn)" fill-opacity="0.08" />
        @for (t of m.ticks; track t.value) {
          <line [attr.x1]="m.left" [attr.x2]="width()" [attr.y1]="t.y" [attr.y2]="t.y" stroke="var(--border)" />
          <text [attr.x]="m.left - 8" [attr.y]="t.y + 4" text-anchor="end" class="lbl">{{ t.value }}</text>
        }
        @for (p of m.points; track $index) {
          <circle [attr.cx]="p.x" [attr.cy]="p.y" r="4" [attr.fill]="p.color" fill-opacity="0.9" stroke="var(--surface)" stroke-width="1.2" />
        }
        @if (m.avg) {
          <path [attr.d]="m.avg" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        }
        @for (l of m.xLabels; track $index) {
          <text [attr.x]="l.x" [attr.y]="height() - 6" [attr.text-anchor]="l.anchor" class="lbl">{{ l.text }}</text>
        }
      </svg>
    } @else {
      <p class="small muted empty">Pas encore de ressenti noté sur la période.</p>
    }
  `,
  styles: [LBL + ` .empty { margin: 12px 0 0; }`],
})
export class FeelingChartComponent {
  readonly points = input.required<{ date: string; value: number }[]>();
  readonly average = input<{ date: string; value: number | null }[]>([]);
  /** Début de la période affichée (AAAA-MM-JJ). */
  readonly from = input.required<string>();
  /** Fin de la période : le moment du calcul. */
  readonly to = input<string | null>(null);
  readonly height = input(190);
  readonly compact = input(false);
  private readonly measured = hostWidth(480);
  readonly width = computed(() => this.measured());

  readonly model = computed(() => {
    const pts = this.points();
    if (!pts.length) return null;
    const start = new Date(this.from() + 'T00:00:00').getTime();
    const end = this.to() ? new Date(this.to()!).getTime() : Date.now();
    const left = 28;
    const top = 10;
    const bottom = 24;
    const W = this.width();
    const H = this.height();
    const x = (d: string) => left + 6 + ((new Date(d).getTime() - start) / (end - start || 1)) * (W - left - 12);
    const y = (v: number) => top + (H - top - bottom) * (1 - (v - 1) / 9);
    const avg = this.average().filter((a): a is { date: string; value: number } => a.value != null);
    const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
    const marks = this.compact() ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
    return {
      left,
      good: { y: r1(y(10)), h: r1(y(7) - y(10)) },
      bad: { y: r1(y(4)), h: r1(y(1) - y(4)) },
      ticks: [1, 4, 7, 10].map((value) => ({ value, y: r1(y(value)) })),
      points: pts.map((p) => ({ x: r1(x(p.date)), y: r1(y(p.value)), color: p.value >= 7 ? 'var(--success)' : p.value <= 4 ? 'var(--warn-ink)' : 'var(--accent)' })),
      avg: avg.length > 1 ? 'M' + avg.map((a) => `${r1(x(a.date))} ${r1(y(a.value))}`).join(' L') : null,
      xLabels: marks.map((f) => ({
        x: r1(left + 6 + f * (W - left - 12)),
        anchor: f === 0 ? 'start' : f === 1 ? 'end' : 'middle',
        text: fmt.format(new Date(start + f * (end - start))).replace('.', ''),
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Barres empilées (km par intensité, tonnage)
// ---------------------------------------------------------------------------

@Component({
  selector: 'tw-stack-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (model(); as m) {
      <svg [attr.height]="height()" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" role="img" [attr.aria-label]="label()">
        @for (t of m.ticks; track t.value) {
          <line [attr.x1]="m.left" [attr.x2]="width()" [attr.y1]="t.y" [attr.y2]="t.y" stroke="var(--border)" />
          <text [attr.x]="m.left - 8" [attr.y]="t.y + 4" text-anchor="end" class="lbl">{{ t.text }}</text>
        }
        @for (b of m.bars; track b.label) {
          @for (part of b.parts; track $index) {
            <rect [attr.x]="b.x" [attr.y]="part.y" [attr.width]="m.bw" [attr.height]="part.h" rx="2.5" [attr.fill]="part.color" />
          }
          @if (b.showLabel) {
            <text [attr.x]="b.cx" [attr.y]="height() - 6" text-anchor="middle" class="lbl">{{ b.label }}</text>
          }
        }
      </svg>
    } @else {
      <p class="small muted empty">{{ emptyText() }}</p>
    }
  `,
  styles: [LBL + ` .empty { margin: 12px 0 0; }`],
})
export class StackChartComponent {
  readonly labels = input.required<string[]>();
  /** Une ligne par barre, une valeur par couleur. */
  readonly stacks = input.required<number[][]>();
  readonly colors = input.required<string[]>();
  readonly height = input(180);
  readonly unit = input('');
  readonly label = input('Barres');
  readonly emptyText = input('Rien sur la période.');
  readonly compact = input(false);
  private readonly measured = hostWidth(480);
  readonly width = computed(() => this.measured());

  readonly model = computed(() => {
    const stacks = this.stacks();
    const totals = stacks.map((s) => s.reduce((a, b) => a + b, 0));
    if (!totals.some((t) => t > 0)) return null;
    const left = 36;
    const top = 10;
    const bottom = 24;
    const W = this.width();
    const H = this.height();
    const ticks = niceTicks(0, Math.max(...totals) * 1.05, 3);
    const tmax = ticks[ticks.length - 1];
    const y = (v: number) => top + (H - top - bottom) * (1 - v / tmax);
    const cw = (W - left) / stacks.length;
    const bw = Math.max(6, Math.min(34, cw * (this.compact() ? 0.56 : 0.5)));
    const colors = this.colors();
    const labels = this.labels();
    const unit = this.unit();
    return {
      left,
      bw: r1(bw),
      ticks: ticks.map((value) => ({ value, y: r1(y(value)), text: `${String(value).replace('.', ',')}${unit}` })),
      bars: stacks.map((parts, i) => {
        const cx = left + cw * (i + 0.5);
        let acc = 0;
        return {
          label: labels[i],
          cx: r1(cx),
          x: r1(cx - bw / 2),
          showLabel: !this.compact() || (stacks.length - 1 - i) % 2 === 0,
          parts: parts
            .map((v, k) => {
              if (!v) return null;
              const y1 = y(acc + v);
              const y0 = y(acc);
              const gap = acc ? 1.5 : 0;
              acc += v;
              return { y: r1(y1), h: r1(Math.max(1, y0 - y1 - gap)), color: colors[k] };
            })
            .filter((p): p is { y: number; h: number; color: string } => !!p),
        };
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// Mini courbe d'une ligne de tableau
// ---------------------------------------------------------------------------

@Component({
  selector: 'tw-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (model(); as m) {
      <svg [attr.width]="w()" [attr.height]="h()" [attr.viewBox]="'0 0 ' + w() + ' ' + h()" aria-hidden="true">
        <path [attr.d]="m.d" fill="none" [attr.stroke]="color()" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" />
        <circle [attr.cx]="m.last.x" [attr.cy]="m.last.y" r="2.5" [attr.fill]="color()" />
      </svg>
    }
  `,
  styles: [`:host { display: inline-flex; } svg { display: block; }`],
})
export class SparklineComponent {
  readonly values = input.required<(number | null)[]>();
  readonly color = input('var(--accent)');
  readonly w = input(84);
  readonly h = input(28);

  readonly model = computed(() => {
    const vals = this.values().map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
    if (vals.length < 2) return null;
    const lo = Math.min(...vals.map((p) => p.v));
    const hi = Math.max(...vals.map((p) => p.v));
    const n = this.values().length - 1 || 1;
    const pts = vals.map((p) => ({ x: r1(2 + ((this.w() - 4) * p.i) / n), y: r1(this.h() - 3 - ((this.h() - 6) * (p.v - lo)) / (hi - lo || 1)) }));
    return { d: 'M' + pts.map((p) => `${p.x} ${p.y}`).join(' L'), last: pts[pts.length - 1] };
  });
}
