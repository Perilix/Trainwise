import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { CoachService } from '../data/coach.service';
import { IconComponent } from './icon.component';

/**
 * Le code d'invitation du coach : celui qu'il donne à un athlète pour être
 * rejoint. Il est affiché tel quel, et modifiable sur place — un code choisi
 * (« CAMILLE-2026 ») se transmet de vive voix, pas les 24 caractères tirés au
 * hasard à la création du compte.
 */
@Component({
  selector: 'tw-invite-code',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (editing()) {
      <div class="box editing">
        <div class="head">
          <span class="tile"><tw-icon name="ticket" [size]="20" /></span>
          <div class="stack grow">
            <span class="h3">Modifier le code d'invitation</span>
            <span class="small muted">Choisis quelque chose que tes athlètes retiennent.</span>
          </div>
        </div>

        <div class="edit-line">
          <input
            class="input code-input"
            [value]="draft()"
            (input)="onType($event)"
            (keydown.enter)="save()"
            (keydown.escape)="cancel()"
            maxlength="16"
            autocomplete="off"
            spellcheck="false"
            aria-label="Code d'invitation"
          />
          @if (state(); as status) {
            <span class="chip" [class.chip-done]="status.available" [class.chip-warn]="!status.available">
              @if (status.available) {
                <tw-icon name="check" [size]="13" [strokeWidth]="2" />
                Disponible
              } @else {
                {{ status.error }}
              }
            </span>
          } @else if (checking()) {
            <span class="chip">Vérification…</span>
          }
        </div>

        <div class="rules">
          <span class="caption muted grow">4 à 16 caractères · lettres, chiffres et tirets · les majuscules et minuscules se valent</span>
          <button class="btn btn-ghost btn-sm" type="button" (click)="cancel()">Annuler</button>
          <button class="btn btn-primary btn-sm" type="button" [disabled]="!canSave()" (click)="save()">
            {{ saving() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </div>

        <p class="warn small">
          <tw-icon name="alert" [size]="15" [strokeWidth]="2" />
          L'ancien code <strong>{{ code() }}</strong> cessera de fonctionner. Les athlètes déjà rattachés ne sont pas concernés.
        </p>

        @if (error()) {
          <p class="err small">{{ error() }}</p>
        }
      </div>
    } @else {
      <div class="box">
        <span class="tile"><tw-icon name="ticket" [size]="20" /></span>
        <div class="stack">
          <span class="overline">Code d'invitation</span>
          <span class="small muted">{{ hint() }}</span>
        </div>
        <span class="grow"></span>
        <span class="code num">{{ code() || '—' }}</span>
        <button class="icon-btn" type="button" (click)="copy()" [attr.aria-label]="copied() ? 'Code copié' : 'Copier le code'">
          <tw-icon [name]="copied() ? 'check' : 'copy'" [size]="18" />
        </button>
        <button class="btn btn-ghost btn-sm" type="button" (click)="edit()">
          <tw-icon name="edit" [size]="17" [strokeWidth]="2" />
          Modifier
        </button>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .box {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px 20px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--r-lg, 16px);
      }

      .box.editing {
        flex-direction: column;
        align-items: stretch;
        gap: 14px;
        border-color: var(--brand);
      }

      .head {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .tile {
        width: 44px;
        height: 44px;
        border-radius: var(--r-md);
        background: var(--accent-soft);
        color: var(--accent-ink);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .code {
        height: 44px;
        padding: 0 18px;
        border-radius: var(--r-md);
        background: var(--subtle);
        display: flex;
        align-items: center;
        font-size: 19px;
        font-weight: 600;
        letter-spacing: 0.1em;
        color: var(--ink);
      }

      .edit-line {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .code-input {
        flex: 1;
        height: 52px;
        font-size: 19px;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .rules {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .warn {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 12px 14px;
        border-radius: var(--r-md);
        background: var(--warn-soft);
        color: var(--warn-ink);
      }

      .err {
        color: var(--danger);
        margin: 0;
      }
    `,
  ],
})
export class InviteCodeComponent {
  private readonly coach = inject(CoachService);
  private readonly destroyRef = inject(DestroyRef);

  readonly code = input<string | null>(null);
  readonly hint = input('À transmettre à tes athlètes');

  /** Émis après enregistrement, pour que l'écran recharge ce qu'il affiche. */
  readonly changed = output<string>();

  readonly editing = signal(false);
  readonly draft = signal('');
  readonly checking = signal(false);
  readonly saving = signal(false);
  readonly copied = signal(false);
  readonly error = signal('');
  readonly state = signal<{ code: string; available: boolean; error?: string } | null>(null);

  private readonly typed = new Subject<string>();

  constructor() {
    // La disponibilité se demande pendant la frappe, mais pas à chaque touche.
    const subscription = this.typed
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((value) => this.coach.checkInviteCode$(value)),
      )
      .subscribe({
        next: (status) => {
          this.checking.set(false);
          this.state.set(status);
        },
        error: () => this.checking.set(false),
      });
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  canSave() {
    return !this.saving() && Boolean(this.state()?.available) && this.state()?.code !== this.code();
  }

  edit() {
    this.draft.set(this.code() ?? '');
    this.state.set(null);
    this.error.set('');
    this.editing.set(true);
  }

  cancel() {
    this.editing.set(false);
    this.state.set(null);
  }

  onType(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.draft.set(value);
    this.state.set(null);
    this.error.set('');
    if (value.trim().length >= 2) {
      this.checking.set(true);
      this.typed.next(value);
    }
  }

  save() {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.error.set('');
    this.coach.setInviteCode(this.draft()).subscribe({
      next: ({ code }) => {
        this.saving.set(false);
        this.editing.set(false);
        this.changed.emit(code);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        // Le code a pu être pris entre la vérification et l'enregistrement.
        this.error.set(err instanceof Error ? err.message : 'Enregistrement impossible.');
        this.state.set(null);
      },
    });
  }

  copy() {
    const code = this.code();
    if (!code) return;
    void navigator.clipboard?.writeText(code);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1600);
  }
}
