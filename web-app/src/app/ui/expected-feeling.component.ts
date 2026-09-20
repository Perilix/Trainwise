import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Ce que veut dire une note, pour que le coach et l'athlète parlent de la même chose. */
export const FEELING_SCALE: Record<number, string> = {
  1: 'Épuisant',
  2: 'Très dur',
  3: 'Dur',
  4: 'Exigeant',
  5: 'Soutenu',
  6: 'Correct',
  7: 'Confortable',
  8: 'Facile',
  9: 'Très facile',
  10: 'Excellent',
};

export const feelingLabel = (value: number | null | undefined) => (value ? FEELING_SCALE[value] ?? '' : '');

/**
 * La difficulté attendue d'une séance, posée par le coach.
 *
 * Même échelle que le ressenti de l'athlète — 1 épuisant, 10 excellent — pour
 * que les deux notes se comparent à la fin de la séance.
 */
@Component({
  selector: 'tw-expected-feeling',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <span class="caption muted grow">{{ hint() }}</span>
      @if (value()) {
        <span class="chip chip-accent">{{ value() }}/10 · {{ label() }}</span>
        <button class="link" type="button" (click)="changed.emit(null)">Effacer</button>
      }
    </div>
    <div class="steps">
      @for (step of steps; track step) {
        <button
          type="button"
          class="step num"
          [class.on]="value() === step"
          [class.filled]="value() !== null && step <= value()!"
          [attr.aria-pressed]="value() === step"
          [attr.aria-label]="step + ' sur 10 — ' + scale[step]"
          (click)="changed.emit(step)"
        >
          {{ step }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .steps {
        display: flex;
        gap: 4px;
      }

      .step {
        flex: 1;
        height: 36px;
        border-radius: var(--r-sm);
        border: 1px solid var(--border);
        background: var(--surface);
        font-size: 13px;
        color: var(--text3);
        cursor: pointer;
      }

      .step.filled {
        background: var(--accent-soft);
        color: var(--accent-ink);
        border-color: var(--accent-soft);
      }

      .step.on {
        border-color: var(--accent-ink);
        font-weight: 600;
      }
    `,
  ],
})
export class ExpectedFeelingComponent {
  readonly value = input<number | null>(null);
  readonly hint = input('Ce que l’athlète devrait ressentir en rentrant');
  readonly changed = output<number | null>();

  readonly steps = Array.from({ length: 10 }, (_, index) => index + 1);
  readonly scale = FEELING_SCALE;

  label() {
    return feelingLabel(this.value());
  }
}
