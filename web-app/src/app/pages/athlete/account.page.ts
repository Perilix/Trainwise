import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { IconComponent } from '../../ui/icon.component';
import { PageHeaderComponent } from '../../ui/page-header.component';

/** Mon compte : identité, adresse email, mot de passe, suppression — comme sur mobile. */
@Component({
  selector: 'tw-athlete-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PageHeaderComponent],
  template: `
    <main class="page">
      <tw-page-header title="Mon compte" />

      <div class="cols">
        <div class="col">
          <section class="card card-pad">
            <span class="h2">Identité</span>
            <div class="two mt">
              <div class="field">
                <label for="first">Prénom</label>
                <input id="first" class="input" [value]="firstName()" (input)="firstName.set(text($event))" />
              </div>
              <div class="field">
                <label for="last">Nom</label>
                <input id="last" class="input" [value]="lastName()" (input)="lastName.set(text($event))" />
              </div>
            </div>
            @if (identityError()) {
              <p class="err small">{{ identityError() }}</p>
            }
            @if (identityDone()) {
              <p class="ok small">Identité enregistrée.</p>
            }
            <button class="btn btn-primary mt" type="button" [disabled]="busy() || !firstName().trim() || !lastName().trim()" (click)="saveIdentity()">
              Enregistrer
            </button>
          </section>

          <section class="card card-pad">
            <span class="h2">Adresse email</span>
            <p class="small muted mt-xs">Connectée aujourd'hui avec {{ auth.user()?.email }}.</p>
            <div class="two mt">
              <div class="field">
                <label for="email">Nouvelle adresse</label>
                <input id="email" class="input" type="email" autocomplete="email" [value]="email()" (input)="email.set(text($event))" />
              </div>
              <div class="field">
                <label for="email-pass">Mot de passe actuel</label>
                <input id="email-pass" class="input" type="password" autocomplete="current-password" [value]="emailPassword()" (input)="emailPassword.set(text($event))" />
              </div>
            </div>
            @if (emailError()) {
              <p class="err small">{{ emailError() }}</p>
            }
            @if (emailDone()) {
              <p class="ok small">Adresse mise à jour.</p>
            }
            <button class="btn btn-primary mt" type="button" [disabled]="busy() || !email().trim() || !emailPassword()" (click)="saveEmail()">
              Changer d'adresse
            </button>
          </section>
        </div>

        <div class="col">
          <section class="card card-pad">
            <span class="h2">Mot de passe</span>
            <div class="two mt">
              <div class="field">
                <label for="cur-pass">Mot de passe actuel</label>
                <input id="cur-pass" class="input" type="password" autocomplete="current-password" [value]="currentPassword()" (input)="currentPassword.set(text($event))" />
              </div>
              <div class="field">
                <label for="new-pass">Nouveau mot de passe</label>
                <input id="new-pass" class="input" type="password" autocomplete="new-password" [value]="newPassword()" (input)="newPassword.set(text($event))" />
              </div>
            </div>
            <div class="field mt-sm">
              <label for="confirm-pass">Confirmer</label>
              <input id="confirm-pass" class="input" type="password" autocomplete="new-password" [value]="confirmPassword()" (input)="confirmPassword.set(text($event))" />
            </div>
            @if (passwordError()) {
              <p class="err small">{{ passwordError() }}</p>
            }
            @if (passwordDone()) {
              <p class="ok small">Mot de passe changé.</p>
            }
            <button class="btn btn-primary mt" type="button" [disabled]="busy() || !passwordReady()" (click)="savePassword()">Changer de mot de passe</button>
          </section>

          <section class="card card-pad danger">
            <span class="h2">Supprimer mon compte</span>
            <p class="body muted mt-xs">
              Ton compte, tes séances et tes échanges avec ton coach sont supprimés définitivement. Cette action ne peut pas être annulée.
            </p>
            @if (confirming()) {
              <p class="small mt">Pour confirmer, écris <strong>SUPPRIMER</strong> ci-dessous.</p>
              <input class="input mt-sm" [value]="confirmWord()" (input)="confirmWord.set(text($event))" aria-label="Confirmation" />
              @if (deleteError()) {
                <p class="err small">{{ deleteError() }}</p>
              }
              <div class="row mt">
                <button class="btn btn-ghost" type="button" (click)="confirming.set(false)">Annuler</button>
                <button class="btn btn-danger" type="button" [disabled]="busy() || confirmWord().trim().toUpperCase() !== 'SUPPRIMER'" (click)="remove()">
                  <tw-icon name="trash" [size]="18" [strokeWidth]="2" />
                  Supprimer définitivement
                </button>
              </div>
            } @else {
              <button class="btn btn-danger mt" type="button" (click)="confirming.set(true)">
                <tw-icon name="trash" [size]="18" [strokeWidth]="2" />
                Supprimer mon compte
              </button>
            }
          </section>
        </div>
      </div>
    </main>
  `,
  styles: [
    `
      .page {
        flex: 1;
        min-width: 0;
        padding: 32px 40px 40px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .cols {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;
        align-items: start;
      }

      .col {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }

      @media (max-width: 1100px) {
        .cols {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      .two {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .mt {
        margin-top: 14px;
      }

      .mt-sm {
        margin-top: 10px;
      }

      .mt-xs {
        margin-top: 4px;
      }

      .danger {
        border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
      }

      .err {
        color: var(--danger);
        margin: 10px 0 0;
      }

      .ok {
        color: var(--success);
        margin: 10px 0 0;
      }
    `,
  ],
})
export class AthleteAccountPage {
  readonly auth = inject(AuthService);

  readonly firstName = signal(this.auth.user()?.firstName ?? '');
  readonly lastName = signal(this.auth.user()?.lastName ?? '');
  readonly email = signal('');
  readonly emailPassword = signal('');
  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly confirmWord = signal('');

  readonly busy = signal(false);
  readonly confirming = signal(false);
  readonly identityError = signal('');
  readonly identityDone = signal(false);
  readonly emailError = signal('');
  readonly emailDone = signal(false);
  readonly passwordError = signal('');
  readonly passwordDone = signal(false);
  readonly deleteError = signal('');

  readonly passwordReady = computed(() => this.currentPassword().length > 0 && this.newPassword().length >= 8 && this.confirmPassword().length > 0);

  saveIdentity() {
    if (this.busy()) return;
    this.identityError.set('');
    this.identityDone.set(false);
    this.busy.set(true);
    this.auth.updateProfile({ firstName: this.firstName().trim(), lastName: this.lastName().trim() }).subscribe({
      next: () => {
        this.busy.set(false);
        this.identityDone.set(true);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.identityError.set(this.message(err, 'Enregistrement impossible.'));
      },
    });
  }

  saveEmail() {
    if (this.busy()) return;
    this.emailError.set('');
    this.emailDone.set(false);
    this.busy.set(true);
    this.auth.changeEmail(this.email().trim(), this.emailPassword()).subscribe({
      next: () => {
        this.busy.set(false);
        this.emailDone.set(true);
        this.email.set('');
        this.emailPassword.set('');
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.emailError.set(this.message(err, "Changement d'adresse impossible."));
      },
    });
  }

  savePassword() {
    if (this.busy()) return;
    this.passwordError.set('');
    this.passwordDone.set(false);
    if (this.newPassword() !== this.confirmPassword()) {
      this.passwordError.set('Les deux mots de passe ne correspondent pas.');
      return;
    }
    this.busy.set(true);
    this.auth.changePassword(this.currentPassword(), this.newPassword()).subscribe({
      next: () => {
        this.busy.set(false);
        this.passwordDone.set(true);
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.passwordError.set(this.message(err, 'Changement de mot de passe impossible.'));
      },
    });
  }

  remove() {
    if (this.busy()) return;
    this.deleteError.set('');
    this.busy.set(true);
    this.auth.deleteAccount().subscribe({
      next: () => {
        this.busy.set(false);
        this.auth.logout();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.deleteError.set(this.message(err, 'Suppression impossible.'));
      },
    });
  }

  text(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  private message(err: unknown, fallback: string) {
    return err instanceof ApiError ? err.message : fallback;
  }
}
