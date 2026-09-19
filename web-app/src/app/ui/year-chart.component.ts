import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { hostWidth } from './host-width';

const PAD_LEFT = 42;
const PAD_BOTTOM = 24;
const PAD_TOP = 12;
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** Cumul mois par mois, l'année en cours contre la précédente (en pointillé). */
@Component({
  selector: 'tw-year-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (model(); as m) {
      <svg [attr.width]="width()" [attr.height]="height()" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" role="img"
        [attr.aria-label]="'Cumul par mois, ' + label()">
        @for (tick of m.ticks; track tick.value) {
          <line [attr.x1]="PAD_LEFT" [attr.x2]="width()" [attr.y1]="tick.y" [attr.y2]="tick.y" stroke="var(--border)" />
          <text [attr.x]="PAD_LEFT - 10" [attr.y]="tick.y + 4" text-anchor="end" class="lbl">{{ tick.value }}</text>
        }
        <line [attr.x1]="PAD_LEFT" [attr.x2]="width()" [attr.y1]="m.baseY" [attr.y2]="m.baseY" stroke="var(--border-strong)" />
        @for (month of m.months; track $index) {
          <text [attr.x]="month.x" [attr.y]="height() - 6" text-anchor="middle" class="lbl">{{ month.label }}</text>
        }
        @if (m.previousLine) {
          <path [attr.d]="m.previousLine" fill="none" stroke="var(--text3)" stroke-width="1.5" stroke-dasharray="4 4" />
        }
        <path [attr.d]="m.currentLine" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
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
export class YearChartComponent {
  readonly current = input.required<number[]>();
  readonly previous = input<number[]>([]);
  readonly label = input('');
  /** Largeur imposée ; sinon le graphique prend toute la largeur disponible. */
  readonly fixedWidth = input<number | undefined>(undefined, { alias: 'width' });
  private readonly measuredWidth = hostWidth(680);
  readonly width = computed(() => this.fixedWidth() ?? this.measuredWidth());
  readonly height = input(200);

  protected readonly PAD_LEFT = PAD_LEFT;

  readonly model = computed(() => {
    const current = this.current();
    if (!current.length) return null;
    const previous = this.previous();
    const width = this.width();
    const height = this.height();
    const max = Math.max(1, ...current, ...previous);
    const step = (width - PAD_LEFT - 8) / 11;
    const x = (index: number) => PAD_LEFT + index * step;
    const y = (value: number) => PAD_TOP + (1 - value / max) * (height - PAD_BOTTOM - PAD_TOP);
    const toPath = (values: number[]) =>
      values.length ? values.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' ') : '';

    return {
      currentLine: toPath(current),
      previousLine: previous.length ? toPath(previous) : '',
      baseY: height - PAD_BOTTOM,
      months: MONTHS.map((label, index) => ({ label, x: x(index) })),
      ticks: [Math.round(max / 2), Math.round(max)].map((value) => ({ value, y: y(value) })),
    };
  });
}
