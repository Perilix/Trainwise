import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { ThemeService } from '../core/theme.service';

/** Répartition du temps par zone d'allure, avec la rampe d'intensité de la DA (§7.5). */
const RAMP = {
  light: ['#CDEBFB', '#8FD2F8', '#3DB4F5', '#0A8ED6', '#05608F'],
  dark: ['#173447', '#1D5577', '#1E80B8', '#2AAAF0', '#8AD8FF'],
};

@Component({
  selector: 'tw-zone-bars',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar">
      @for (zone of rows(); track zone.label) {
        @if (zone.minutes > 0) {
          <span [style.flex]="zone.minutes" [style.background]="zone.color"></span>
        }
      }
    </div>
    <div class="rows">
      @for (zone of rows(); track zone.label) {
        <div class="row">
          <span class="swatch" [style.background]="zone.color"></span>
          <span class="grow small">{{ zone.label }}</span>
          <span class="small muted num">{{ zone.minutes }} min</span>
          <span class="pct num">{{ zone.percent }} %</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .bar {
        display: flex;
        gap: 2px;
        height: 12px;
        margin-top: 14px;
      }

      .bar span {
        border-radius: 4px;
      }

      .rows {
        display: flex;
        flex-direction: column;
        margin-top: 8px;
      }

      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 0;
      }

      .row + .row {
        border-top: 1px solid var(--border);
      }

      .swatch {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        flex-shrink: 0;
      }

      .pct {
        width: 40px;
        text-align: right;
        font-size: 13px;
        font-weight: 600;
      }
    `,
  ],
})
export class ZoneBarsComponent {
  private readonly theme = inject(ThemeService);

  readonly zones = input.required<{ label: string; minutes: number }[]>();

  readonly rows = computed(() => {
    const ramp = RAMP[this.theme.resolved()];
    const zones = this.zones();
    const total = zones.reduce((sum, zone) => sum + zone.minutes, 0) || 1;
    return zones.map((zone, index) => ({
      ...zone,
      color: ramp[Math.min(index, ramp.length - 1)],
      percent: Math.round((zone.minutes / total) * 100),
    }));
  });
}
