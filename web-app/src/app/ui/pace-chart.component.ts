import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { hostWidth } from './host-width';

import { formatPace } from '../core/format';
import type { KmSplit } from '../domain/athlete.types';

const PAD_LEFT = 40;
const PAD_BOTTOM = 24;
const PAD_TOP = 34;

/** Allure par km : plus rapide en haut, les deux moitiés de course mises en regard. */
@Component({
  selector: 'tw-pace-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (model(); as m) {
      <svg [attr.width]="width()" [attr.height]="height()" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" role="img"
        [attr.aria-label]="'Allure moyenne ' + m.averageLabel + ' par km'">
        <rect [attr.x]="m.halfX" [attr.y]="8" [attr.width]="m.halfWidth" [attr.height]="height() - PAD_BOTTOM - 8" fill="var(--accent)" fill-opacity="0.06" />
        <text [attr.x]="m.firstHalfX" y="20" text-anchor="middle" class="lbl">1ʳᵉ moitié · {{ m.firstHalfLabel }}</text>
        <text [attr.x]="m.secondHalfX" y="20" text-anchor="middle" class="lbl strong">2ᵉ moitié · {{ m.secondHalfLabel }}</text>

        @for (tick of m.ticks; track tick.value) {
          <line [attr.x1]="PAD_LEFT" [attr.x2]="width()" [attr.y1]="tick.y" [attr.y2]="tick.y" stroke="var(--border)" />
          <text [attr.x]="PAD_LEFT - 10" [attr.y]="tick.y + 4" text-anchor="end" class="lbl">{{ tick.label }}</text>
        }

        <line [attr.x1]="PAD_LEFT" [attr.x2]="width()" [attr.y1]="m.baseY" [attr.y2]="m.baseY" stroke="var(--border-strong)" />
        @for (km of m.kmTicks; track km.value) {
          <text [attr.x]="km.x" [attr.y]="height() - 6" [attr.text-anchor]="km.anchor" class="lbl">{{ km.value }} km</text>
        }

        <line [attr.x1]="PAD_LEFT" [attr.x2]="width() - 6" [attr.y1]="m.averageY" [attr.y2]="m.averageY" stroke="var(--ink)" stroke-opacity="0.45" stroke-dasharray="4 4" />
        <path [attr.d]="m.line" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        @for (point of m.points; track point.km) {
          <circle [attr.cx]="point.x" [attr.cy]="point.y" [attr.r]="point.fastest ? 5 : 3" fill="var(--accent)" stroke="var(--surface)" stroke-width="1.5" />
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

      .strong {
        font-weight: 600;
        fill: var(--accent-ink);
      }
    `,
  ],
})
export class PaceChartComponent {
  readonly splits = input.required<KmSplit[]>();
  /** Largeur imposée ; sinon le graphique prend toute la largeur disponible. */
  readonly fixedWidth = input<number | undefined>(undefined, { alias: 'width' });
  private readonly measuredWidth = hostWidth(640);
  readonly width = computed(() => this.fixedWidth() ?? this.measuredWidth());
  readonly height = input(210);

  protected readonly PAD_LEFT = PAD_LEFT;
  protected readonly PAD_BOTTOM = PAD_BOTTOM;

  readonly model = computed(() => {
    const splits = this.splits();
    if (splits.length < 2) return null;

    const width = this.width();
    const height = this.height();
    const paces = splits.map((split) => split.paceSecPerKm);
    const fastest = Math.min(...paces);
    const slowest = Math.max(...paces);
    const average = paces.reduce((sum, value) => sum + value, 0) / paces.length;
    const min = Math.floor((fastest - 5) / 10) * 10;
    const max = Math.ceil((slowest + 5) / 10) * 10;
    const half = Math.floor(splits.length / 2);
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

    const plotWidth = width - PAD_LEFT - 6;
    const x = (km: number) => PAD_LEFT + (km / splits.length) * plotWidth;
    const y = (pace: number) => PAD_TOP + ((pace - min) / (max - min)) * (height - PAD_BOTTOM - PAD_TOP);

    const points = splits.map((split, index) => ({
      km: split.km,
      x: Number(x(index + 0.5).toFixed(1)),
      y: Number(y(split.paceSecPerKm).toFixed(1)),
      fastest: split.paceSecPerKm === fastest,
    }));

    const kmSteps = [0, Math.round(splits.length / 4), Math.round(splits.length / 2), Math.round((3 * splits.length) / 4), splits.length];

    return {
      line: points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' '),
      points,
      ticks: [min, (min + max) / 2, max].map((value) => ({ value, y: y(value), label: formatPace(value) })),
      kmTicks: [...new Set(kmSteps)].map((value) => ({
        value,
        x: x(value),
        anchor: value === splits.length ? 'end' : 'middle',
      })),
      baseY: height - PAD_BOTTOM,
      averageY: y(average),
      averageLabel: formatPace(average),
      halfX: x(half),
      halfWidth: x(splits.length) - x(half),
      firstHalfX: x(half / 2),
      secondHalfX: x(half + (splits.length - half) / 2),
      firstHalfLabel: `${formatPace(mean(paces.slice(0, half)))} /km`,
      secondHalfLabel: `${formatPace(mean(paces.slice(half)))} /km`,
    };
  });
}
