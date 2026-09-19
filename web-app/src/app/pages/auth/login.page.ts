import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { IconComponent } from '../../ui/icon.component';
import { AuthLayoutComponent } from './auth-layout.component';
import { GoogleButtonComponent } from './google-button.component';

@Component({
  selector: 'tw-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthLayoutComponent, FormsModule, GoogleButtonComponent, IconComponent, RouterLink],
  template: `
    <tw-auth-layout>
      <div class="titles">
        <h1>Connexion</h1>
        <p class="body muted">Retrouve ton planning et tes séances.</p>
      </div>

      <form (ngSubmit)="submit()">
        <div class="field">
          <label for="email">Email</label>
          <div class="wrap">
            <tw-icon name="mail" [size]="18" />
            <input
              id="email"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="ton@email.com"
              [(ngModel)]="email"
              required
            />
          </div>
        </div>

        <div class="field">
          <label for="password">Mot de passe</label>
          <div class="wrap">
            <tw-icon name="lock" [size]="18" />
            <input
              id="password"
              name="password"
              [type]="visible() ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="Ton mot de passe"
              [(ngModel)]="password"
              required
            />
            <button type="button" class="reveal" (click)="visible.set(!visible())" aria-label="Afficher le mot de passe">
              <tw-icon [name]="visible() ? 'ban' : 'eye'" [size]="18" />
            </button>
          </div>
        </div>

        <div class="forgot">
          <a routerLink="/mot-de-passe-oublie">Mot de passe oublié ?</a>
        </div>

        @if (error()) {
          <p class="error small">{{ error() }}</p>
        }

        <button class="btn btn-primary btn-block" type="submit" [disabled]="busy()">
          {{ busy() ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>

      <tw-google-button (credential)="withGoogle($event)" />

      <p class="foot body">
        <span class="muted">Pas encore de compte ?</span>
        <a routerLink="/inscription">S'inscrire</a>
      </p>
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

      .wrap {
        height: 48px;
        border-radius: var(--r-md);
        background: var(--surface);
        border: 1px solid var(--border-strong);
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 14px;
        color: var(--text3);
      }

      .wrap:focus-within {
        border-color: var(--accent);
      }

      .wrap input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: none;
        background: none;
        font-size: 14px;
        color: var(--ink);
      }

      .wrap input::placeholder {
        color: var(--text3);
      }

      .reveal {
        display: flex;
        color: var(--text3);
      }

      .forgot {
        display: flex;
        justify-content: flex-end;
        font-size: 13px;
        font-weight: 500;
      }

      .error {
        color: var(--danger);
        margin: 0;
      }

      .btn {
        margin-top: 10px;
      }

      .foot {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin-top: 24px;
      }

      .foot a {
        font-weight: 600;
      }
    `,
  ],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly visible = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  /** Retour de Google Identity Services : l'API vérifie le jeton et ouvre la session. */
  withGoogle(idToken: string) {
    if (this.busy()) return;
    this.error.set('');
    this.busy.set(true);
    this.auth.googleSignIn(idToken).subscribe({
      next: (res) => {
        this.busy.set(false);
        void this.router.navigate([res.user.role === 'coach' ? '/coach' : '/accueil']);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(err instanceof ApiError ? err.message : 'Connexion Google impossible.');
      },
    });
  }

  submit() {
    if (this.busy()) return;
    this.error.set('');
    this.busy.set(true);
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: (res) => {
        this.busy.set(false);
        void this.router.navigate([res.user.role === 'coach' ? '/coach' : '/accueil']);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(err instanceof ApiError ? err.message : 'Connexion impossible.');
      },
    });
  }
}
