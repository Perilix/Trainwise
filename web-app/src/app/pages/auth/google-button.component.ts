import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, output, signal, viewChild } from '@angular/core';

import { environment } from '../../../environments/environment';

type GoogleId = {
  initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void; use_fedcm_for_prompt?: boolean }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/**
 * Bouton « Continuer avec Google ». C'est Google qui dessine le bouton (Identity
 * Services) : il renvoie un jeton d'identité, que l'API vérifie sur /api/auth/google.
 * Sans identifiant client configuré, on n'affiche rien plutôt qu'un bouton mort.
 */
@Component({
  selector: 'tw-google-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (clientId) {
      <div class="sep"><span>ou</span></div>
      <div class="host" #host></div>
      @if (failed()) {
        <p class="error small">Connexion Google indisponible.</p>
      }
    }
  `,
  styles: [
    `
      .sep {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 22px 0 18px;
        font-size: 12px;
        color: var(--text3);
      }

      .sep::before,
      .sep::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--border);
      }

      .host {
        display: flex;
        justify-content: center;
        min-height: 44px;
      }

      .error {
        color: var(--danger);
        margin: 8px 0 0;
        text-align: center;
      }
    `,
  ],
})
export class GoogleButtonComponent {
  private readonly host = viewChild<ElementRef<HTMLElement>>('host');

  readonly clientId = environment.googleClientId;
  readonly failed = signal(false);

  /** Jeton d'identité Google, à envoyer à l'API. */
  readonly credential = output<string>();

  constructor() {
    afterNextRender(() => {
      if (!this.clientId) return;
      this.loadScript()
        .then(() => this.render())
        .catch(() => this.failed.set(true));
    });
  }

  private loadScript(): Promise<void> {
    if (window.google?.accounts?.id) return Promise.resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('gsi')));
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('gsi'));
      document.head.appendChild(script);
    });
  }

  private render() {
    const id = window.google?.accounts?.id;
    const parent = this.host()?.nativeElement;
    if (!id || !parent) {
      this.failed.set(true);
      return;
    }
    id.initialize({
      client_id: this.clientId,
      callback: (response) => {
        if (response.credential) this.credential.emit(response.credential);
      },
    });
    id.renderButton(parent, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', logo_alignment: 'left', width: 400, locale: 'fr' });
  }
}
