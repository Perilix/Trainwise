import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { hostWidth } from './host-width';

import { ThemeService } from '../core/theme.service';
import { intensityColor, intensityHeight, totals, type Segment } from '../domain/sessions';

const RAMP = {
  light: ['#CDEBFB', '#8FD2F8', '#3DB4F5', '#0A8ED6', '#05608F'],
  dark: ['#173447', '#1D5577', '#1E80B8', '#2AAAF0', '#8AD8FF'],
};

/** Profil de séance : largeur = durée, hauteur = intensité (% VMA). */
@Component({
  selector: 'tw-workout-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="width()" [attr.height]="height()" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" aria-hidden="true">
      @for (bar of bars(); track bar.key) {
        <rect [attr.x]="bar.x" [attr.y]="height() - bar.h" [attr.width]="bar.w" [attr.height]="bar.h" [attr.rx]="bar.rx" [attr.fill]="bar.color" />
      }
    </svg>
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
    `,
  ],
})
export class WorkoutProfileComponent {
  private readonly theme = inject(ThemeService);

  readonly segments = input.required<readonly Segment[]>();
  /** Largeur imposée ; sinon le graphique prend toute la largeur disponible. */
  readonly fixedWidth = input<number | undefined>(undefined, { alias: 'width' });
  private readonly measuredWidth = hostWidth(560);
  readonly width = computed(() => this.fixedWidth() ?? this.measuredWidth());
  readonly height = input(56);
  readonly gap = input(1.5);
  /** Durée de référence, pour comparer deux profils (prévu / réalisé) à la même échelle. */
  readonly totalSeconds = input<number | undefined>(undefined);

  readonly bars = computed(() => {
    const segments = this.segments();
    const ramp = RAMP[this.theme.resolved()];
    const total = this.totalSeconds() ?? (totals(segments).sec || 1);
    let start = 0;
    return segments.map((segment, index) => {
      const x = (start / total) * this.width();
      start += segment.sec;
      const w = Math.max(1, (segment.sec / total) * this.width() - this.gap());
      const h = intensityHeight(segment.pct, this.height());
      return { key: index, x, w, h, rx: Math.min(2, w / 2), color: intensityColor(segment.pct, ramp) };
    });
  });
}
