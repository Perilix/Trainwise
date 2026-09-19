import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent } from './icon.component';

/** Trois états d'un bloc de données : chargement, erreur, vide. */
@Component({
  selector: 'tw-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="wrap">
      @if (kind() === 'loading') {
        <span class="spin"></span>
        <p class="small muted">{{ message() || 'Chargement…' }}</p>
      } @else {
        <tw-icon [name]="kind() === 'error' ? 'alert' : icon()" [size]="24" />
        <p class="small muted">{{ message() }}</p>
        <ng-content />
      }
    </div>
  `,
  styles: [
    `
      /* L'état occupe la place que son parent lui laisse et se centre dedans :
         un chargement de page ne doit pas rester coincé en haut à gauche. */
      :host {
        display: flex;
        flex: 1;
        min-height: 160px;
      }

      .wrap {
        margin: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 32px 16px;
        text-align: center;
        color: var(--text3);
      }

      .spin {
        width: 22px;
        height: 22px;
        border-radius: var(--r-pill);
        border: 2px solid var(--border);
        border-top-color: var(--accent);
        animation: spin 0.7s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class StateViewComponent {
  readonly kind = input<'loading' | 'error' | 'empty'>('loading');
  readonly message = input('');
  readonly icon = input('info');
}
