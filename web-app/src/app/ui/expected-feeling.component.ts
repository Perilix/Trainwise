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

export const feelingLabel = (value: number | null | undefined) => (value ? (FEELING_SCALE[value] ?? '') : '');

/**
 * La couleur d'une note, du rouge au vert.
 *
 * L'échelle est celle du ressenti : 1 épuisant, 10 excellent. Le rouge et le
 * vert y portent exactement leur sens habituel — ça va mal, ça va bien — donc
 * ils ne concurrencent pas le code couleur de l'app, ils le prolongent.
 */
export const FEELING_TINT: Record<number, { soft: string; ink: string }> = {
  1: { soft: '#FBE4E2', ink: '#B4463D' },
  2: { soft: '#FBE4E2', ink: '#B4463D' },
  3: { soft: '#FBE8D8', ink: '#B4662F' },
  4: { soft: '#FBE8D8', ink: '#B4662F' },
  5: { soft: '#FAF0D8', ink: '#96731C' },
  6: { soft: '#FAF0D8', ink: '#96731C' },
  7: { soft: '#EDF3DC', ink: '#6E8A2E' },
  8: { soft: '#EDF3DC', ink: '#6E8A2E' },
  9: { soft: '#E4F1E6', ink: '#41815A' },
  10: { soft: '#E4F1E6', ink: '#41815A' },
};

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

/** La même échelle, en lecture seule : les dix chiffres, celui qui compte détouré. */
@Component({
  selector: 'tw-feeling-scale',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <span class="caption label">{{ label() }}</span>
      <div class="steps">
        @for (step of steps; track step) {
          <span
            class="step num"
            [class.on]="value() === step"
            [style.background]="tint(step).soft"
            [style.color]="tint(step).ink"
            [attr.aria-current]="value() === step ? 'true' : null"
          >
            {{ step }}
          </span>
        }
      </div>
      <span class="caption note">{{ value() }}/10 · {{ text() }}</span>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .wrap {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .steps {
        display: flex;
        gap: 3px;
      }

      .step {
        flex: 1;
        height: 28px;
        border-radius: var(--r-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        opacity: 0.45;
      }

      /* Seule la note retenue est pleinement lisible : les autres situent l'échelle. */
      .step.on {
        opacity: 1;
        font-weight: 700;
        box-shadow: inset 0 0 0 1.5px currentColor;
      }

      .label,
      .note {
        color: var(--text2);
      }
    `,
  ],
})
export class FeelingScaleComponent {
  readonly value = input.required<number>();
  readonly label = input('Ressenti attendu');

  readonly steps = Array.from({ length: 10 }, (_, index) => index + 1);

  tint(step: number) {
    return FEELING_TINT[step];
  }

  text() {
    return feelingLabel(this.value());
  }
}
