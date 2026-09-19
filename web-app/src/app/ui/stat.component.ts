import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Libellé + grand chiffre + unité. `onBrand` pour la carte navy. */
@Component({
  selector: 'tw-stat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="label">{{ label() }}</span>
    <span class="line">
      <span class="value num">{{ value() }}</span>
      @if (unit()) {
        <span class="unit">{{ unit() }}</span>
      }
    </span>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .label {
        font-size: 12px;
        line-height: 16px;
        font-weight: 500;
        color: var(--text2);
      }

      .line {
        display: flex;
        align-items: baseline;
        gap: 4px;
      }

      .value {
        font-size: 20px;
        line-height: 28px;
        font-weight: 600;
        color: var(--ink);
      }

      .unit {
        font-size: 13px;
        font-weight: 500;
        color: var(--text2);
      }

      :host(.on-brand) .label,
      :host(.on-brand) .unit {
        color: rgba(255, 255, 255, 0.6);
      }

      :host(.on-brand) .value {
        color: #ffffff;
        font-size: 22px;
      }
    `,
  ],
})
export class StatComponent {
  readonly label = input('');
  readonly value = input<string | number>('—');
  readonly unit = input('');
}
