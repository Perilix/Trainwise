import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Ce que veut dire une note, pour que le coach et l'athlète parlent de la même chose. */
export const FEELING_SCALE: Record<number, string> = {
  1: 'Très facile',
  2: 'Facile',
  3: 'Tranquille',
  4: 'Modérée',
  5: 'Soutenue',
  6: 'Exigeante',
  7: 'Dure',
  8: 'Très dure',
  9: 'Maximale',
  10: 'Épuisante',
};

export const feelingLabel = (value: number | null | undefined) => (value ? (FEELING_SCALE[value] ?? '') : '');

/**
 * La couleur d'une note, du rouge au vert.
 *
 * L'échelle va du plus facile au plus dur : 1 très facile, 10 épuisante. Le
 * vert et le rouge y portent le sens qu'on leur donne partout ailleurs — c'est
 * tranquille, c'est costaud — donc ils prolongent le code couleur de l'app.
 */
export const FEELING_TINT: Record<number, { soft: string; ink: string }> = {
  1: { soft: '#E4F1E6', ink: '#41815A' },
  2: { soft: '#E4F1E6', ink: '#41815A' },
  3: { soft: '#EDF3DC', ink: '#6E8A2E' },
  4: { soft: '#EDF3DC', ink: '#6E8A2E' },
  5: { soft: '#FAF0D8', ink: '#96731C' },
  6: { soft: '#FAF0D8', ink: '#96731C' },
  7: { soft: '#FBE8D8', ink: '#B4662F' },
  8: { soft: '#FBE8D8', ink: '#B4662F' },
  9: { soft: '#FBE4E2', ink: '#B4463D' },
  10: { soft: '#FBE4E2', ink: '#B4463D' },
};

/**
 * La difficulté attendue d'une séance, posée par le coach.
 *
 * 1 très facile, 10 épuisante. C'est l'inverse de l'échelle de ressenti que
 * l'athlète remplit après coup, où 10 veut dire « je me sentais bien ».
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
  readonly hint = input('Ce que la séance devrait coûter à l’athlète');
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
  readonly label = input('Difficulté attendue');

  readonly steps = Array.from({ length: 10 }, (_, index) => index + 1);

  tint(step: number) {
    return FEELING_TINT[step];
  }

  text() {
    return feelingLabel(this.value());
  }
}
