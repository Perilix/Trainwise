import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatDecimal, formatHoursMinutes, formatPace, formatWeekdayTile, parseDay } from '../core/format';
import type { PlannedSession } from '../domain/athlete.types';
import { IconComponent } from './icon.component';

/** Ligne « prochain entraînement » : pastille de date, titre, méta, badge coach. */
@Component({
  selector: 'tw-session-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="tile">
      <span class="dow">{{ weekday() }}</span>
      <span class="day num">{{ dayNumber() }}</span>
    </div>
    <div class="grow stack">
      <span class="h3 truncate">{{ session().title }}</span>
      <span class="small muted">{{ meta() }}</span>
    </div>
    @if (session().plannedBy === 'coach') {
      <span class="chip chip-coach"><tw-icon name="user" [size]="13" [strokeWidth]="2" />Coach</span>
    }
    @if (session().status === 'done') {
      <span class="chip chip-done"><tw-icon name="check" [size]="13" [strokeWidth]="2" />Faite</span>
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
        display: flex;
        flex-direction: column;
        width: 44px;
        height: 48px;
        border-radius: var(--r-md);
        background: var(--subtle);
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .dow {
        font-size: 10px;
        line-height: 12px;
        font-weight: 600;
        letter-spacing: 0.06em;
        color: var(--text3);
      }

      .day {
        font-size: 17px;
        line-height: 22px;
        font-weight: 600;
      }
    `,
  ],
})
export class SessionRowComponent {
  readonly session = input.required<PlannedSession>();

  readonly weekday = computed(() => formatWeekdayTile(this.session().date));
  readonly dayNumber = computed(() => parseDay(this.session().date).getDate());

  readonly meta = computed(() => {
    const session = this.session();
    const parts: string[] = [];
    if (session.sport === 'strength') {
      if (session.durationMin) parts.push(`${session.durationMin} min`);
      if (session.exercisesCount) parts.push(`${session.exercisesCount} exercices`);
    } else {
      if (session.distanceKm) parts.push(`${formatDecimal(session.distanceKm, session.distanceKm % 1 ? 1 : 0)} km`);
      else if (session.durationMin) parts.push(formatHoursMinutes(session.durationMin * 60));
      if (session.paceSecPerKm) parts.push(`${formatPace(session.paceSecPerKm)} /km`);
    }
    return parts.join(' · ') || 'Séance';
  });
}
