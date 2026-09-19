import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatDayShort, formatDecimal, formatHoursMinutes, formatPace } from '../core/format';
import type { Activity } from '../domain/athlete.types';
import { IconComponent } from './icon.component';

/** Ligne « dernier entraînement » : tuile de discipline, titre, méta, badge Strava. */
@Component({
  selector: 'tw-activity-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <span class="tile" [class.strength]="activity().sport === 'strength'">
      <tw-icon [name]="activity().sport === 'strength' ? 'dumbbell' : 'run'" [size]="20" />
    </span>
    <div class="grow stack">
      <span class="h3 truncate">{{ activity().title }}</span>
      <span class="small muted truncate">{{ meta() }}</span>
    </div>
    @if (activity().fromStrava) {
      <span class="chip chip-strava">Strava</span>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        cursor: pointer;
      }

      .tile {
        width: 40px;
        height: 40px;
        border-radius: var(--r-md);
        background: var(--accent-soft);
        color: var(--accent-ink);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .tile.strength {
        background: var(--subtle);
        color: var(--brand);
      }

      :host(:not(.clickable)) {
        cursor: default;
      }
    `,
  ],
})
export class ActivityRowComponent {
  readonly activity = input.required<Activity>();

  readonly meta = computed(() => {
    const activity = this.activity();
    const parts = [formatDayShort(activity.date)];
    if (activity.durationSec) parts.push(formatHoursMinutes(activity.durationSec));
    if (activity.sport === 'strength') {
      if (activity.setsCount) parts.push(`${activity.setsCount} séries`);
    } else {
      if (activity.distanceKm) parts.push(`${formatDecimal(activity.distanceKm, 1)} km`);
      if (activity.paceSecPerKm) parts.push(`${formatPace(activity.paceSecPerKm)} /km`);
    }
    return parts.join(' · ');
  });
}
