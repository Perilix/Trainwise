import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AuthLayoutComponent } from './auth-layout.component';

@Component({
  selector: 'tw-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthLayoutComponent, FormsModule, RouterLink],
  template: `
    <tw-auth-layout>
      <div class="titles">
        <h1>Mot de passe oublié</h1>
        <p class="body muted">On t'envoie un lien pour en choisir un nouveau.</p>
      </div>

      @if (sent()) {
        <p class="done body">Si un compte existe pour cette adresse, le lien est parti. Pense à regarder les indésirables.</p>
      } @else {
        <form (ngSubmit)="submit()">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" class="input" placeholder="ton@email.com" [(ngModel)]="email" required />
          </div>
          @if (error()) {
            <p class="error small">{{ error() }}</p>
          }
          <button class="btn btn-primary btn-block" type="submit" [disabled]="busy()">
            {{ busy() ? 'Envoi…' : 'Envoyer le lien' }}
          </button>
        </form>
      }

      <p class="foot body"><a routerLink="/connexion">Revenir à la connexion</a></p>
    </tw-auth-layout>
  `,
  styles: [
    `
      .titles {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      h1 {
        font-size: 30px;
        line-height: 38px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-top: 32px;
      }

      .field > label {
        color: var(--ink);
      }

      .done {
        margin-top: 28px;
        padding: 14px;
        border-radius: var(--r-md);
        background: var(--success-soft);
        color: var(--success-ink);
      }

      .error {
        color: var(--danger);
        margin: 0;
      }

      .foot {
        display: flex;
        justify-content: center;
        margin-top: 24px;
      }
    `,
  ],
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);

  email = '';
  readonly busy = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');

  submit() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.auth.forgotPassword(this.email.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.sent.set(true);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(err instanceof ApiError ? err.message : 'Envoi impossible.');
      },
    });
  }
}
