import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AuthLayoutComponent } from './auth-layout.component';

@Component({
  selector: 'tw-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthLayoutComponent, FormsModule, RouterLink],
  template: `
    <tw-auth-layout>
      <div class="titles">
        <h1>Créer un compte</h1>
        <p class="body muted">Quelques informations et on démarre.</p>
      </div>

      <form (ngSubmit)="submit()">
        <div class="two">
          <div class="field">
            <label for="firstName">Prénom</label>
            <input id="firstName" name="firstName" class="input" [(ngModel)]="firstName" required />
          </div>
          <div class="field">
            <label for="lastName">Nom</label>
            <input id="lastName" name="lastName" class="input" [(ngModel)]="lastName" required />
          </div>
        </div>

        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" class="input" placeholder="ton@email.com" [(ngModel)]="email" required />
        </div>

        <div class="field">
          <label for="password">Mot de passe</label>
          <input
            id="password"
            name="password"
            type="password"
            class="input"
            placeholder="8 caractères minimum"
            [(ngModel)]="password"
            required
            minlength="8"
          />
        </div>

        <div class="field">
          <label>Je suis</label>
          <div class="roles">
            <button type="button" class="role" [class.on]="role() === 'athlete'" (click)="role.set('athlete')">Athlète</button>
            <button type="button" class="role" [class.on]="role() === 'coach'" (click)="role.set('coach')">Coach</button>
          </div>
        </div>

        @if (error()) {
          <p class="error small">{{ error() }}</p>
        }

        <button class="btn btn-primary btn-block" type="submit" [disabled]="busy()">
          {{ busy() ? 'Création…' : 'Créer mon compte' }}
        </button>
      </form>

      <p class="foot body">
        <span class="muted">Déjà un compte ?</span>
        <a routerLink="/connexion">Se connecter</a>
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

      .two {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .field > label {
        color: var(--ink);
      }

      .roles {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .role {
        height: 44px;
        border-radius: var(--r-md);
        border: 1px solid var(--border);
        background: var(--surface);
        font-weight: 600;
        font-size: 14px;
      }

      .role.on {
        border-color: var(--brand);
        background: var(--brand);
        color: var(--on-brand);
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
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  firstName = '';
  lastName = '';
  email = '';
  password = '';
  readonly role = signal<'athlete' | 'coach'>('athlete');
  readonly busy = signal(false);
  readonly error = signal('');

  submit() {
    if (this.busy()) return;
    this.error.set('');
    this.busy.set(true);
    this.auth
      .register({
        firstName: this.firstName.trim(),
        lastName: this.lastName.trim(),
        email: this.email.trim(),
        password: this.password,
        role: this.role(),
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          void this.router.navigate([res.user.role === 'coach' ? '/coach' : '/accueil']);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(err instanceof ApiError ? err.message : 'Création impossible.');
        },
      });
  }
}
