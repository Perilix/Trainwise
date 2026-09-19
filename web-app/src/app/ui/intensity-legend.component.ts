import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ThemeService } from '../core/theme.service';
import { INTENSITY_LEVELS } from '../domain/sessions';

const RAMP = {
  light: ['#CDEBFB', '#8FD2F8', '#3DB4F5', '#0A8ED6', '#05608F'],
  dark: ['#173447', '#1D5577', '#1E80B8', '#2AAAF0', '#8AD8FF'],
};

const RANGES = ['< 68 %', '68 – 78 %', '78 – 84 %', '84 – 95 %', '≥ 95 %'];

/** Légende de la rampe d'intensité, sous un profil de séance. */
@Component({
  selector: 'tw-intensity-legend',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legend">
      @for (level of levels(); track level.label) {
        <div class="item">
          <span class="swatch" [style.background]="level.color"></span>
          <span class="caption muted">{{ level.label }}</span>
          <span class="caption muted-3">{{ level.range }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .legend {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }

      .item {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .swatch {
        width: 12px;
        height: 12px;
        border-radius: 3px;
      }
    `,
  ],
})
export class IntensityLegendComponent {
  private readonly theme = inject(ThemeService);

  readonly levels = computed(() =>
    INTENSITY_LEVELS.map((label, index) => ({ label, range: RANGES[index], color: RAMP[this.theme.resolved()][index] })),
  );
}
