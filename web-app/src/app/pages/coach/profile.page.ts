import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { AuthService } from '../../core/auth.service';
import { load } from '../../core/load';
import { ThemeService, type ThemeMode } from '../../core/theme.service';
import { CoachService } from '../../data/coach.service';
import { AvatarComponent } from '../../ui/avatar.component';
import { IconComponent } from '../../ui/icon.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { StateViewComponent } from '../../ui/state-view.component';

@Component({
  selector: 'tw-coach-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, PageHeaderComponent, StateViewComponent],
  template: `
    <main class="page">
      <tw-page-header title="Profil coach" subtitle="Votre fiche, votre code d'invitation et vos réglages." />

      <div class="cols">
        <div class="col">
          <section class="card card-pad">
            <div class="identity">
              <tw-avatar [initials]="auth.initials()" tone="violet" [size]="56" />
              <div class="stack grow">
                <span class="h2">{{ auth.fullName() }}</span>
                <span class="small muted">{{ auth.user()?.email }}</span>
              </div>
            </div>
          </section>

          <section class="card card-pad">
            <div class="card-head">
              <h2 class="h2">Fiche coach</h2>
              <button class="link" type="button" (click)="startEdit()">{{ editing() ? 'Annuler' : 'Modifier' }}</button>
            </div>

            @if (editing()) {
              <div class="form">
                <div class="two">
                  <div class="field">
                    <label for="firstName">Prénom</label>
                    <input id="firstName" class="input" [value]="draft().firstName ?? ''" (input)="patch('firstName', value($event))" />
                  </div>
                  <div class="field">
                    <label for="lastName">Nom</label>
                    <input id="lastName" class="input" [value]="draft().lastName ?? ''" (input)="patch('lastName', value($event))" />
                  </div>
                </div>
                <div class="field">
                  <label for="experience">Années d'expérience</label>
                  <input id="experience" class="input" inputmode="numeric" [value]="draft().experience ?? ''" (input)="patchNumber('experience', $event)" />
                </div>
                <div class="field">
                  <label for="disciplines">Disciplines (séparées par des virgules)</label>
                  <input id="disciplines" class="input" [value]="disciplines()" (input)="disciplines.set(value($event))" />
                </div>
                <div class="field">
                  <label for="diplomas">Diplômes (séparés par des virgules)</label>
                  <input id="diplomas" class="input" [value]="diplomas()" (input)="diplomas.set(value($event))" />
                </div>
                <div class="field">
                  <label for="bio">Présentation</label>
                  <textarea id="bio" class="input" rows="3" [value]="draft().bio ?? ''" (input)="patch('bio', text($event))"></textarea>
                </div>
                <button class="btn btn-primary btn-block" type="button" [disabled]="saving()" (click)="save()">
                  {{ saving() ? 'Enregistrement…' : 'Enregistrer' }}
                </button>
              </div>
            } @else {
              <div class="rows">
                <div class="line"><span class="grow body muted">Expérience</span><span class="h3">{{ user()?.experience ? user()!.experience + ' ans' : '—' }}</span></div>
                <div class="line">
                  <span class="grow body muted">Disciplines</span>
                  <span class="h3 right">{{ (user()?.disciplines ?? []).join(', ') || '—' }}</span>
                </div>
                <div class="line">
                  <span class="grow body muted">Diplômes</span>
                  <span class="h3 right">{{ (user()?.diplomas ?? []).join(', ') || '—' }}</span>
                </div>
              </div>
              @if (user()?.bio) {
                <p class="body muted bio">{{ user()!.bio }}</p>
              }
            }
          </section>

          <section class="card card-pad">
            <div class="connector">
              <span class="tile"><tw-icon name="sun" [size]="20" /></span>
              <div class="stack grow">
                <span class="h3">Apparence</span>
                <span class="small muted">Clair, sombre ou selon l'appareil</span>
              </div>
            </div>
            <div class="segmented">
              @for (mode of modes; track mode.value) {
                <button type="button" class="seg" [class.on]="theme.mode() === mode.value" (click)="theme.set(mode.value)">
                  {{ mode.label }}
                </button>
              }
            </div>
          </section>

          <button class="btn btn-danger btn-block" type="button" (click)="auth.logout()">
            <tw-icon name="logout" [size]="18" [strokeWidth]="2" />
            Se déconnecter
          </button>
        </div>

        <div class="col">
          <section class="card card-pad">
            <span class="h2">Code d'invitation</span>
            @if (invitations.data(); as invite) {
              @if (invite.code) {
                <div class="code">
                  <div class="stack grow">
                    <span class="caption muted">À transmettre à vos athlètes</span>
                    <span class="code-value num">{{ invite.code }}</span>
                  </div>
                  <button class="icon-btn" type="button" (click)="copy(invite.code!)" aria-label="Copier">
                    <tw-icon name="copy" [size]="18" />
                  </button>
                </div>
              } @else {
                <tw-state kind="empty" icon="mail" message="Aucun code pour l'instant." />
              }
              <button class="btn btn-ghost btn-block mt" type="button" (click)="newCode()">
                <tw-icon name="refresh" [size]="18" [strokeWidth]="2" />
                Générer un nouveau code
              </button>
              <span class="caption muted mt-sm">L'ancien code cesse de fonctionner dès qu'un nouveau est généré.</span>
            } @else {
              <tw-state kind="loading" />
            }
          </section>

          <section class="card card-pad">
            <span class="h2">Invitations en attente</span>
            @for (pending of invitations.data()?.pending ?? []; track pending.id) {
              <div class="row">
                <tw-avatar [initials]="pending.initials" tone="subtle" [size]="36" />
                <div class="stack grow">
                  <span class="h3">{{ pending.name }}</span>
                  <span class="small muted">{{ pending.sentLabel }}</span>
                </div>
                <span class="chip chip-warn">En attente</span>
              </div>
            } @empty {
              <p class="body muted mt-sm">Aucune invitation en attente.</p>
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
        gap: 24px;
      }

      .cols {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
        gap: 20px;
        align-items: start;
      }

      .col {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }

      .identity {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 16px;
      }

      .two {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .rows {
        display: flex;
        flex-direction: column;
        margin-top: 10px;
      }

      .line {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
      }

      .line + .line {
        border-top: 1px solid var(--border);
      }

      .right {
        text-align: right;
      }

      .bio {
        margin-top: 14px;
        padding: 12px;
        border-radius: var(--r-md);
        background: var(--bg);
      }

      .connector {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .tile {
        width: 40px;
        height: 40px;
        border-radius: var(--r-md);
        background: var(--subtle);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .segmented {
        display: flex;
        padding: 3px;
        border-radius: var(--r-md);
        background: var(--subtle);
        gap: 2px;
        margin-top: 14px;
      }

      .seg {
        flex: 1;
        height: 34px;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 500;
        color: var(--text2);
      }

      .seg.on {
        background: var(--surface);
        color: var(--ink);
        font-weight: 600;
      }

      .code {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 14px;
        padding: 14px;
        border-radius: var(--r-md);
        background: var(--subtle);
      }

      .code-value {
        font-size: 22px;
        font-weight: 600;
        letter-spacing: 0.1em;
      }

      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
      }

      .row + .row {
        border-top: 1px solid var(--border);
      }

      .icon-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--r-sm);
        color: var(--text2);
      }

      .mt {
        margin-top: 14px;
      }

      .mt-sm {
        display: block;
        margin-top: 12px;
      }
    `,
  ],
})
export class CoachProfilePage {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly coach = inject(CoachService);

  readonly modes: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: 'Clair' },
    { value: 'dark', label: 'Sombre' },
    { value: 'system', label: 'Auto' },
  ];

  readonly invitations = load(() => this.coach.invitations$());

  readonly user = this.auth.user;
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly draft = signal<Record<string, string | number | undefined>>({});
  readonly disciplines = signal('');
  readonly diplomas = signal('');

  startEdit() {
    if (this.editing()) {
      this.editing.set(false);
      return;
    }
    const user = this.auth.user();
    this.draft.set({
      firstName: user?.firstName,
      lastName: user?.lastName,
      experience: user?.experience,
      bio: user?.bio,
    });
    this.disciplines.set((user?.disciplines ?? []).join(', '));
    this.diplomas.set((user?.diplomas ?? []).join(', '));
    this.editing.set(true);
  }

  patch(key: string, value: string) {
    this.draft.update((draft) => ({ ...draft, [key]: value }));
  }

  patchNumber(key: string, event: Event) {
    const raw = (event.target as HTMLInputElement).value;
    const parsed = Number(raw);
    this.draft.update((draft) => ({ ...draft, [key]: raw === '' || !Number.isFinite(parsed) ? undefined : parsed }));
  }

  save() {
    this.saving.set(true);
    const list = (value: string) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    this.auth.updateProfile({ ...this.draft(), disciplines: list(this.disciplines()), diplomas: list(this.diplomas()) }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  newCode() {
    this.coach.generateInviteCode().subscribe({ next: () => this.invitations.reload(true) });
  }

  copy(code: string) {
    void navigator.clipboard?.writeText(code);
  }

  value(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  text(event: Event) {
    return (event.target as HTMLTextAreaElement).value;
  }
}
