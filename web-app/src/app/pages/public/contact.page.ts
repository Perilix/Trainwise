import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError, ApiService } from '../../core/api.service';
import { PublicShellComponent } from './public-shell.component';

export const CONTACT_SUBJECTS = [
  { value: 'question', label: 'Une question' },
  { value: 'bug', label: 'Un problème technique' },
  { value: 'compte', label: 'Mon compte' },
  { value: 'donnees', label: 'Mes données personnelles' },
  { value: 'suggestion', label: 'Une suggestion' },
  { value: 'autre', label: 'Autre' },
] as const;

/**
 * Nous contacter.
 *
 * Le message part dans le back-office plutôt que dans une boîte mail : on sait
 * ce qui reste à traiter, et l'expéditeur n'a pas besoin d'un client mail
 * configuré pour nous joindre.
 */
@Component({
  selector: 'tw-contact',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PublicShellComponent],
  template: `
    <tw-public-shell title="Nous contacter" lead="Écrivez-nous, on lit tout. Réponse sous deux jours ouvrés.">
      @if (sent()) {
        <p class="done">Message envoyé. Merci — on vous répond à {{ email() }}.</p>
        <button class="btn btn-ghost" type="button" (click)="again()">Écrire un autre message</button>
      } @else {
        <form class="form" (submit)="submit($event)">
          <div class="two">
            <div class="field">
              <label for="c-name">Votre nom</label>
              <input id="c-name" class="input" autocomplete="name" [value]="name()" (input)="name.set(value($event))" />
            </div>
            <div class="field">
              <label for="c-email">Votre email</label>
              <input id="c-email" class="input" type="email" autocomplete="email" [value]="email()" (input)="email.set(value($event))" />
            </div>
          </div>

          <div class="field">
            <label for="c-subject">Sujet</label>
            <select id="c-subject" class="input" [value]="subject()" (change)="subject.set(value($event))">
              @for (option of subjects; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label for="c-message">Votre message</label>
            <textarea
              id="c-message"
              class="input"
              rows="7"
              placeholder="Décrivez votre demande. Pour un problème technique, précisez votre téléphone et ce que vous faisiez."
              [value]="message()"
              (input)="message.set(text($event))"
            ></textarea>
            <span class="caption muted-3">{{ message().length }} / 4000</span>
          </div>

          @if (error()) {
            <p class="err">{{ error() }}</p>
          }

          <button class="btn btn-primary" type="submit" [disabled]="!valid() || sending()">
            {{ sending() ? 'Envoi…' : 'Envoyer' }}
          </button>

          <p class="caption muted-3">
            Les informations saisies ne servent qu'à traiter votre demande. Elles sont conservées le temps de l'échange, puis supprimées.
          </p>
        </form>
      }
    </tw-public-shell>
  `,
  styles: [
    `
      .form {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-top: 24px;
      }

      .two {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .field label {
        font-size: 13px;
        font-weight: 500;
      }

      .done {
        margin-top: 24px;
        padding: 14px 16px;
        border-radius: var(--r-md);
        background: var(--success-soft);
        color: var(--success-ink);
      }

      .err {
        color: var(--danger);
        margin: 0;
      }

      @media (max-width: 640px) {
        .two {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ContactPage {
  private readonly api = inject(ApiService);

  readonly subjects = CONTACT_SUBJECTS;
  readonly name = signal('');
  readonly email = signal('');
  readonly subject = signal<string>('question');
  readonly message = signal('');
  readonly sending = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');

  readonly valid = computed(() => this.name().trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim()) && this.message().trim().length > 9);

  submit(event: Event) {
    event.preventDefault();
    if (!this.valid() || this.sending()) return;
    this.sending.set(true);
    this.error.set('');
    this.api
      .post('/api/contact', {
        name: this.name().trim(),
        email: this.email().trim(),
        subject: this.subject(),
        message: this.message().trim(),
        source: 'site',
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.sent.set(true);
        },
        error: (err: unknown) => {
          this.sending.set(false);
          this.error.set(err instanceof ApiError ? err.message : 'Envoi impossible. Réessayez dans un instant.');
        },
      });
  }

  again() {
    this.message.set('');
    this.sent.set(false);
  }

  value(event: Event) {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  text(event: Event) {
    return (event.target as HTMLTextAreaElement).value;
  }
}
