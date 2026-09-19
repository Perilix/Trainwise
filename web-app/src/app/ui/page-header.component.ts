import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** En-tête d'écran : titre, sous-titre, et actions à droite. */
@Component({
  selector: 'tw-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <div class="titles">
        <h1 class="display">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="body muted">{{ subtitle() }}</p>
        }
      </div>
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: [
    `
      .head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
      }

      .titles {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }
    `,
  ],
})
export class PageHeaderComponent {
  readonly title = input('');
  readonly subtitle = input('');
}
