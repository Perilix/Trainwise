import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { load } from '../../core/load';
import { CoachService } from '../../data/coach.service';
import { ATHLETE_STATUS_STYLE } from '../../domain/coach.status';
import { AvatarComponent } from '../../ui/avatar.component';
import { IconComponent } from '../../ui/icon.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { StateViewComponent } from '../../ui/state-view.component';

@Component({
  selector: 'tw-coach-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, PageHeaderComponent, RouterLink, StateViewComponent],
  template: `
    <main class="page">
      <tw-page-header title="Espace coach" subtitle="Gérez vos athlètes et leurs entraînements.">
        <button class="btn btn-ghost" routerLink="/coach/exercices">
          <tw-icon name="dumbbell" [size]="18" [strokeWidth]="2" />
          Exercices
        </button>
        <button class="btn btn-primary" type="button" (click)="openInvite()">
          <tw-icon name="plus" [size]="18" [strokeWidth]="2" />
          Inviter un athlète
        </button>
      </tw-page-header>

      @if (home.loading()) {
        <tw-state kind="loading" />
      } @else if (home.error()) {
        <tw-state kind="error" [message]="home.error()">
          <button class="btn btn-ghost btn-sm" (click)="home.reload()">Réessayer</button>
        </tw-state>
      } @else if (home.data(); as data) {
        <div class="kpis">
          <div class="card kpi"><span class="small muted">Athlètes</span><span class="value num">{{ data.stats.athletes }}</span></div>
          <div class="card kpi"><span class="small muted">Invitations en attente</span><span class="value num">{{ data.stats.pendingInvitations }}</span></div>
          <div class="card kpi"><span class="small muted">Séances cette semaine</span><span class="value num">{{ data.stats.sessionsThisWeek }}</span></div>
          <div class="card kpi"><span class="small muted">Séances totales</span><span class="value num">{{ data.stats.sessionsTotal }}</span></div>
        </div>

        <div class="cols">
          <section class="card table">
            <div class="table-head">
              <span class="h2">Mes athlètes</span>
              <div class="search">
                <tw-icon name="search" [size]="16" />
                <input placeholder="Rechercher un athlète" [value]="search()" (input)="search.set(value($event))" />
              </div>
            </div>

            <div class="row head">
              <span class="overline muted-3">Athlète</span>
              <span class="overline muted-3">Statut</span>
              <span class="overline muted-3">Offre</span>
              <span class="overline muted-3">Prochaine course</span>
              <span></span>
            </div>

            @for (athlete of filtered(); track athlete.id) {
              <div class="row">
                <div class="who">
                  <tw-avatar [initials]="athlete.initials" tone="accent" [size]="36" />
                  <div class="stack min">
                    <span class="h3 truncate">{{ athlete.name }}</span>
                    <span class="small muted truncate">{{ athlete.level ?? athlete.email }}</span>
                  </div>
                </div>
                <div class="status">
                  <span class="dot" [style.background]="statusOf(athlete.status).color"></span>
                  <span class="body">{{ statusOf(athlete.status).label }}</span>
                </div>
                <div><span class="chip">{{ athlete.offer }}</span></div>
                @if (athlete.nextRace; as race) {
                  <div class="stack min">
                    <span class="h3 truncate">{{ race.name }}</span>
                    <span class="small muted">{{ race.meta }}</span>
                  </div>
                } @else {
                  <span class="body muted">Aucune</span>
                }
                <div class="row-actions">
                  <button class="icon-btn" type="button" (click)="openAthlete(athlete.id)" aria-label="Ouvrir la fiche">
                    <tw-icon name="chevron-right" [size]="18" />
                  </button>
                  <button class="icon-btn" type="button" (click)="openPlanning(athlete.id)" aria-label="Ouvrir le planning">
                    <tw-icon name="calendar" [size]="18" />
                  </button>
                </div>
              </div>
            } @empty {
              <tw-state kind="empty" icon="friends" message="Aucun athlète pour l'instant." />
            }
          </section>

          <div class="side">
            @if (data.requests.length) {
              <section class="card card-pad">
                <div class="title-row">
                  <span class="h2">Demandes d'abonnement</span>
                  <span class="chip chip-accent">{{ data.requests.length }}</span>
                </div>
                @for (request of data.requests; track request.id) {
                  <div class="request">
                    <div class="who">
                      <tw-avatar [initials]="request.initials" tone="accent" [size]="40" />
                      <div class="stack grow">
                        <span class="h3">{{ request.name }}</span>
                        <span class="small muted">{{ request.requestedLabel }}</span>
                      </div>
                      <span class="chip">{{ request.offer }}</span>
                    </div>
                    <div class="request-actions">
                      <button class="btn btn-primary btn-sm grow" type="button" (click)="respond(request.id, true)">
                        <tw-icon name="check" [size]="16" [strokeWidth]="2" />
                        Accepter
                      </button>
                      <button class="btn btn-ghost btn-sm grow" type="button" (click)="respond(request.id, false)">Refuser</button>
                    </div>
                  </div>
                }
              </section>
            }

            <section class="card card-pad">
              <span class="h2">Invitations en attente</span>
              @if (invitations.data(); as invite) {
                @for (pending of invite.pending; track pending.id) {
                  <div class="who mt">
                    <tw-avatar [initials]="pending.initials" tone="subtle" [size]="40" />
                    <div class="stack grow">
                      <span class="h3">{{ pending.name }}</span>
                      <span class="small muted">{{ pending.sentLabel }}</span>
                    </div>
                    <span class="chip chip-warn"><tw-icon name="clock" [size]="13" [strokeWidth]="2" />En attente</span>
                  </div>
                } @empty {
                  <p class="body muted mt-sm">Aucune invitation en attente.</p>
                }
                @if (invite.code) {
                  <div class="code">
                    <div class="stack grow">
                      <span class="caption muted">Code d'invitation</span>
                      <span class="code-value num">{{ invite.code }}</span>
                    </div>
                    <button class="icon-btn" type="button" (click)="copyCode(invite.code!)" aria-label="Copier le code">
                      <tw-icon name="copy" [size]="18" />
                    </button>
                  </div>
                }
              }
            </section>
          </div>
        </div>
      }

      @if (inviteOpen()) {
        <div class="scrim" (click)="inviteOpen.set(false)">
          <div class="modal card" (click)="$event.stopPropagation()">
            <div class="spread">
              <span class="h2">Inviter un athlète</span>
              <button class="icon-btn" type="button" (click)="inviteOpen.set(false)" aria-label="Fermer">
                <tw-icon name="close" [size]="18" />
              </button>
            </div>
            <div class="field mt">
              <label for="invite-email">Adresse email</label>
              <input id="invite-email" class="input" type="email" placeholder="athlete@email.com" [value]="inviteEmail()" (input)="inviteEmail.set(value($event))" />
            </div>
            @if (inviteError()) {
              <p class="err small">{{ inviteError() }}</p>
            }
            @if (inviteDone()) {
              <p class="ok small">Invitation envoyée.</p>
            }
            <div class="modal-actions">
              <button class="btn btn-ghost grow" type="button" (click)="newCode()">Générer un nouveau code</button>
              <button class="btn btn-primary grow" type="button" [disabled]="!inviteEmail()" (click)="invite()">Envoyer</button>
            </div>
          </div>
        </div>
      }
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

      .kpis {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
      }

      .kpi {
        padding: 18px 20px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .kpi .value {
        font-size: 28px;
        line-height: 36px;
        font-weight: 600;
      }

      .cols {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 360px;
        gap: 20px;
        align-items: start;
      }

      .table {
        overflow: hidden;
      }

      .table-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
      }

      .search {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 36px;
        padding: 0 12px;
        border-radius: var(--r-md);
        border: 1px solid var(--border-strong);
        color: var(--text3);
      }

      .search input {
        border: 0;
        outline: none;
        background: none;
        font-size: 13px;
        color: var(--ink);
        width: 180px;
      }

      .row {
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) 120px 90px minmax(0, 1fr) 80px;
        align-items: center;
        gap: 12px;
        padding: 12px 20px;
        border-top: 1px solid var(--border);
      }

      .row.head {
        background: var(--bg);
        padding-top: 10px;
        padding-bottom: 10px;
      }

      .who {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }

      .stack.min {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .status {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .row-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        justify-content: flex-end;
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

      .icon-btn:hover {
        background: var(--subtle);
        color: var(--ink);
      }

      .side {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .title-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .request {
        padding: 14px 0;
      }

      .request + .request {
        border-top: 1px solid var(--border);
      }

      .request-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .code {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 16px;
        padding: 12px 14px;
        border-radius: var(--r-md);
        background: var(--subtle);
      }

      .code-value {
        font-size: 18px;
        font-weight: 600;
        letter-spacing: 0.08em;
      }

      .mt {
        margin-top: 14px;
      }

      .mt-sm {
        margin-top: 8px;
      }

      .err {
        color: var(--danger);
        margin-top: 10px;
      }

      .ok {
        color: var(--success-ink);
        margin-top: 10px;
      }

      .scrim {
        position: fixed;
        inset: 0;
        background: var(--overlay);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 40;
      }

      .modal {
        width: 480px;
        max-width: calc(100vw - 48px);
        padding: 24px;
      }

      .modal-actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
      }
    `,
  ],
})
export class CoachDashboardPage {
  private readonly coach = inject(CoachService);
  private readonly router = inject(Router);

  readonly home = load(() => this.coach.home$());
  readonly invitations = load(() => this.coach.invitations$());

  readonly search = signal('');
  readonly inviteOpen = signal(false);
  readonly inviteEmail = signal('');
  readonly inviteError = signal('');
  readonly inviteDone = signal(false);

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const athletes = this.home.data()?.athletes ?? [];
    if (!term) return athletes;
    return athletes.filter((athlete) => `${athlete.name} ${athlete.email}`.toLowerCase().includes(term));
  });

  statusOf(status: 'green' | 'orange' | 'red') {
    return ATHLETE_STATUS_STYLE[status];
  }

  openAthlete(id: string) {
    void this.router.navigate(['/coach/athletes', id]);
  }

  openPlanning(id: string) {
    void this.router.navigate(['/coach/athletes', id], { queryParams: { vue: 'planning' } });
  }

  respond(id: string, accept: boolean) {
    this.coach.respondToRequest(id, accept).subscribe({ next: () => this.home.reload(true) });
  }

  openInvite() {
    this.inviteError.set('');
    this.inviteDone.set(false);
    this.inviteOpen.set(true);
  }

  invite() {
    this.inviteError.set('');
    this.coach.inviteByEmail(this.inviteEmail().trim()).subscribe({
      next: () => {
        this.inviteDone.set(true);
        this.inviteEmail.set('');
        this.invitations.reload(true);
        this.home.reload(true);
      },
      error: () => this.inviteError.set("Cette adresse ne correspond à aucun compte Trainwise."),
    });
  }

  newCode() {
    this.coach.generateInviteCode().subscribe({ next: () => this.invitations.reload(true) });
  }

  copyCode(code: string) {
    void navigator.clipboard?.writeText(code);
  }

  value(event: Event) {
    return (event.target as HTMLInputElement).value;
  }
}
