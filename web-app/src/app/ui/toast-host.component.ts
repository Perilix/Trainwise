import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService } from '../core/toast.service';
import { IconComponent } from './icon.component';

/** Les toasts de l'app, empilés en bas au centre de la zone de contenu. */
@Component({
  selector: 'tw-toast-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="stack" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class.error]="toast.kind === 'error'" role="status">
          <span class="badge"><tw-icon [name]="toast.kind === 'error' ? 'alert' : 'check'" [size]="15" [strokeWidth]="2.25" /></span>
          <span class="msg">{{ toast.message }}</span>
          <button type="button" class="close" (click)="toasts.dismiss(toast.id)" aria-label="Fermer"><tw-icon name="close" [size]="15" /></button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .stack {
        position: fixed;
        left: calc(var(--sidebar-w) + (100vw - var(--sidebar-w)) / 2);
        bottom: 28px;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        z-index: 1000;
        pointer-events: none;
      }

      .toast {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 280px;
        max-width: 480px;
        padding: 10px 10px 10px 12px;
        border-radius: var(--r-md);
        background: var(--brand);
        color: var(--on-brand);
        box-shadow: 0 10px 30px rgba(5, 25, 35, 0.22);
        font-size: 14px;
        line-height: 20px;
        font-weight: 500;
        animation: rise 0.18s ease-out;
      }

      .badge {
        width: 24px;
        height: 24px;
        border-radius: var(--r-pill);
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--success);
        color: #fff;
        flex-shrink: 0;
      }

      .error .badge {
        background: var(--danger);
      }

      .msg {
        flex: 1;
      }

      .close {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--r-sm);
        color: var(--brand-text2);
        background: none;
        cursor: pointer;
      }

      .close:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
      }

      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
      }
    `,
  ],
})
export class ToastHostComponent {
  readonly toasts = inject(ToastService);
}
