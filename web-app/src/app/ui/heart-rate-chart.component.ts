import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { hostWidth } from './host-width';

import type { KmSplit } from '../domain/athlete.types';

const PAD_LEFT = 34;
const PAD_BOTTOM = 24;
const PAD_TOP = 12;

/** Fréquence cardiaque moyenne par kilomètre. */
@Component({
  selector: 'tw-heart-rate-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (model(); as m) {
      <svg [attr.width]="width()" [attr.height]="height()" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" role="img"
        aria-label="Fréquence cardiaque moyenne par kilomètre">
        @for (tick of m.ticks; track tick.value) {
          <line [attr.x1]="PAD_LEFT" [attr.x2]="width()" [attr.y1]="tick.y" [attr.y2]="tick.y" stroke="var(--border)" />
          <text [attr.x]="PAD_LEFT - 10" [attr.y]="tick.y + 4" text-anchor="end" class="lbl">{{ tick.value }}</text>
        }
        <line [attr.x1]="PAD_LEFT" [attr.x2]="width()" [attr.y1]="m.baseY" [attr.y2]="m.baseY" stroke="var(--border-strong)" />
        @for (km of m.kmTicks; track km.value) {
          <text [attr.x]="km.x" [attr.y]="height() - 6" [attr.text-anchor]="km.anchor" class="lbl">{{ km.value }} km</text>
        }
        <path [attr.d]="m.area" fill="var(--accent)" fill-opacity="0.1" />
        <path [attr.d]="m.line" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        @for (point of m.points; track point.km) {
          <circle [attr.cx]="point.x" [attr.cy]="point.y" r="2.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="1" />
        }
      </svg>
    }
  `,
  styles: [
    `
      /* Bloc pleine largeur : c'est cette largeur que le graphique mesure. */
      :host {
        display: block;
        width: 100%;
      }

      svg {
        display: block;
        width: 100%;
      }

      .lbl {
        font-size: 11px;
        fill: var(--text3);
        font-family: 'Poppins', sans-serif;
      }
    `,
  ],
})
export class HeartRateChartComponent {
  readonly splits = input.required<KmSplit[]>();
  /** Largeur imposée ; sinon le graphique prend toute la largeur disponible. */
  readonly fixedWidth = input<number | undefined>(undefined, { alias: 'width' });
  private readonly measuredWidth = hostWidth(640);
  readonly width = computed(() => this.fixedWidth() ?? this.measuredWidth());
  readonly height = input(220);

  protected readonly PAD_LEFT = PAD_LEFT;

  readonly model = computed(() => {
    const splits = this.splits();
    const points = splits.filter((split): split is KmSplit & { avgHr: number } => typeof split.avgHr === 'number');
    if (points.length < 2) return null;

    const width = this.width();
    const height = this.height();
    const values = points.map((point) => point.avgHr);
    const min = Math.floor((Math.min(...values) - 8) / 10) * 10;
    const max = Math.ceil((Math.max(...values) + 8) / 10) * 10;
    const plotWidth = width - PAD_LEFT - 6;
    const x = (km: number) => PAD_LEFT + (km / splits.length) * plotWidth;
    const y = (hr: number) => PAD_TOP + (1 - (hr - min) / (max - min)) * (height - PAD_BOTTOM - PAD_TOP);

    const plotted = points.map((point) => ({ km: point.km, x: Number(x(point.km - 0.5).toFixed(1)), y: Number(y(point.avgHr).toFixed(1)) }));
    const line = plotted.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' ');
    const baseY = height - PAD_BOTTOM;
    const step = (max - min) / 3;

    return {
      line,
      area: `${line} L${plotted[plotted.length - 1].x} ${baseY} L${plotted[0].x} ${baseY} Z`,
      points: plotted,
      baseY,
      ticks: [min + step, min + 2 * step, max].map(Math.round).map((value) => ({ value, y: y(value) })),
      kmTicks: [...new Set([0, Math.round(splits.length / 2), splits.length])].map((value) => ({
        value,
        x: x(value),
        anchor: value === splits.length ? 'end' : 'middle',
      })),
    };
  });
}
