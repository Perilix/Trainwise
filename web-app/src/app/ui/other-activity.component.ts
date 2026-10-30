import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { OtherActivity } from '../domain/athlete.types';
import { otherActivityStats, otherSportIcon } from '../domain/other-sports';
import { IconComponent } from './icon.component';
import { StatComponent } from './stat.component';

/** Vélo, natation… synchronisé depuis Strava : les chiffres clés et la description de l'athlète. */
@Component({
  selector: 'tw-other-activity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, StatComponent],
  template: `
    <div class="head">
      <span class="badge"><tw-icon [name]="icon()" [size]="16" [strokeWidth]="2" /></span>
      <div class="stack grow">
        <span class="h3">{{ activity().title }}</span>
        <span class="small muted">{{ subtitle() }}</span>
      </div>
    </div>
    @if (stats().length) {
      <div class="stats">
        @for (stat of stats(); track stat.label) {
          <tw-stat [label]="stat.label" [value]="stat.value" [unit]="stat.unit" />
        }
      </div>
    }
    @if (activity().description) {
      <p class="body desc">{{ activity().description }}</p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 14px 0;
      }

      .head {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .badge {
        width: 32px;
        height: 32px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--r-sm);
        background: var(--success-soft);
        color: var(--success-ink);
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px 8px;
        margin-top: 12px;
      }

      .desc {
        margin-top: 12px;
        padding: 10px 12px;
        border-radius: var(--r-md);
        background: var(--bg);
        white-space: pre-line;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class OtherActivityComponent {
  readonly activity = input.required<OtherActivity>();

  readonly icon = computed(() => otherSportIcon(this.activity().family));
  readonly stats = computed(() => otherActivityStats(this.activity()));
  readonly subtitle = computed(() => {
    const { sportLabel, startTime } = this.activity();
    return [sportLabel, startTime, 'via Strava'].filter(Boolean).join(' · ');
  });
}
