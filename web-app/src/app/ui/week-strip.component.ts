import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { parseDay } from '../core/format';
import type { WeekDay } from '../domain/athlete.types';
import { IconComponent } from './icon.component';

const LABELS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];

/** Les sept jours de la semaine : vert = effectuée, bleu = planifiée, rien = repos (DA §6.4). */
@Component({
  selector: 'tw-week-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="strip">
      @for (day of cells(); track day.date) {
        <div class="col">
          <span class="caption muted-3">{{ day.label }}</span>
          <span class="num" [class.done]="day.status === 'done'" [class.today]="day.isToday">{{ day.number }}</span>
          <span class="mark">
            @if (day.status === 'done') {
              <tw-icon name="check" [size]="12" [strokeWidth]="2.5" />
            } @else if (day.status === 'planned') {
              <span class="pin"></span>
            }
          </span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .strip {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 4px;
      }

      .col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }

      .num {
        width: 36px;
        height: 36px;
        border-radius: var(--r-pill);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
        color: var(--ink);
      }

      .num.done {
        background: var(--success-soft);
        color: var(--success-ink);
      }

      .num.today {
        background: var(--brand);
        color: var(--on-brand);
      }

      .mark {
        height: 12px;
        display: flex;
        align-items: center;
        color: var(--success-ink);
      }

      .pin {
        display: block;
        width: 6px;
        height: 6px;
        border-radius: var(--r-pill);
        background: var(--accent);
      }
    `,
  ],
})
export class WeekStripComponent {
  readonly week = input.required<WeekDay[]>();

  readonly cells = computed(() =>
    this.week().map((day, index) => ({ ...day, label: LABELS[index], number: parseDay(day.date).getDate() })),
  );
}
