import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ApiError } from '../../core/api.service';
import { load } from '../../core/load';
import { CoachService } from '../../data/coach.service';
import { ATHLETE_STATUS_STYLE } from '../../domain/coach.status';
import type { CoachGroup, GroupColor } from '../../domain/coach.types';
import { AvatarComponent } from '../../ui/avatar.component';
import { IconComponent } from '../../ui/icon.component';
import { InviteCodeComponent } from '../../ui/invite-code.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { StateViewComponent } from '../../ui/state-view.component';

/**
 * Les couleurs proposées pour un groupe. Elles sont pastel : un groupe
 * étiquette, il ne signale pas. C'est ce qui leur permet de côtoyer le code
 * couleur de l'app (violet = coach, orange = Strava, rouge = alerte,
 * vert = fait) sans s'y confondre.
 */
const GROUP_TINT: Record<GroupColor, { soft: string; ink: string }> = {
  rouge: { soft: '#FBE4E2', ink: '#B4463D' },
  bleu: { soft: '#E2EFFA', ink: '#2F76AE' },
  vert: { soft: '#E4F1E6', ink: '#41815A' },
  jaune: { soft: '#FAF0D8', ink: '#96731C' },
  orange: { soft: '#FBE8D8', ink: '#B4662F' },
  violet: { soft: '#EDE6F8', ink: '#6F52A8' },
  rose: { soft: '#FAE4EE', ink: '#AE5081' },
};

const GROUP_COLORS = (Object.keys(GROUP_TINT) as GroupColor[]).map((id) => ({
  id,
  label: id[0].toUpperCase() + id.slice(1),
  dot: GROUP_TINT[id].ink,
}));

@Component({
  selector: 'tw-coach-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, InviteCodeComponent, PageHeaderComponent, RouterLink, StateViewComponent],
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
        <tw-invite-code [code]="invitations.data()?.code ?? null" (changed)="onCodeChanged()" />

        <div class="tabs">
          <button type="button" class="tab" [class.on]="tab() === 'athletes'" (click)="tab.set('athletes')">
            Athlètes<span class="count num">{{ data.athletes.length }}</span>
          </button>
          <button type="button" class="tab" [class.on]="tab() === 'groups'" (click)="tab.set('groups')">
            Groupes<span class="count num">{{ groups.data()?.length ?? 0 }}</span>
          </button>
        </div>

        @if (tab() === 'groups') {
          <div class="group-head">
            <div class="search wide">
              <tw-icon name="search" [size]="16" />
              <input placeholder="Rechercher un groupe" [value]="groupSearch()" (input)="groupSearch.set(value($event))" />
            </div>
            <span class="caption muted grow">Un athlète peut appartenir à plusieurs groupes.</span>
            <button class="btn btn-primary btn-sm" type="button" (click)="openGroup(null)">
              <tw-icon name="plus" [size]="17" [strokeWidth]="2" />
              Nouveau groupe
            </button>
          </div>

          @if (groups.loading()) {
            <tw-state kind="loading" />
          } @else {
            <div class="groups">
              @for (group of visibleGroups(); track group.id) {
                <section class="card group">
                  <div class="group-top">
                    <span class="tile" [style.background]="tint(group.color).soft" [style.color]="tint(group.color).ink">
                      <tw-icon name="friends" [size]="20" />
                    </span>
                    <div class="stack grow">
                      <span class="h3">{{ group.name }}</span>
                      <span class="small muted">{{ groupSubtitle(group) }}</span>
                    </div>
                    <button class="icon-btn" type="button" (click)="openGroup(group)" aria-label="Modifier le groupe">
                      <tw-icon name="edit" [size]="17" />
                    </button>
                  </div>

                  <div class="members">
                    @for (member of group.athletes.slice(0, 5); track member.id) {
                      <tw-avatar [initials]="member.initials" tone="accent" [size]="30" />
                    }
                    @if (group.athletes.length > 5) {
                      <span class="more num">+{{ group.athletes.length - 5 }}</span>
                    }
                    <span class="small muted">{{ group.athletes.length }} athlète{{ group.athletes.length > 1 ? 's' : '' }}</span>
                  </div>

                  <div class="group-actions">
                    <button class="btn btn-ghost btn-sm grow" type="button" (click)="showGroup(group)">
                      <tw-icon name="friends" [size]="16" [strokeWidth]="2" />
                      Voir
                    </button>
                    <button
                      class="btn btn-ghost btn-sm grow"
                      type="button"
                      [disabled]="!group.athletes.length || busyGroup() === group.id"
                      (click)="messageGroup(group)"
                    >
                      <tw-icon name="chat" [size]="16" [strokeWidth]="2" />
                      Message
                    </button>
                    <button class="btn btn-ghost btn-sm grow" type="button" [disabled]="!group.athletes.length" (click)="openPlan(group)">
                      <tw-icon name="calendar" [size]="16" [strokeWidth]="2" />
                      Planifier
                    </button>
                  </div>
                  @if (groupActionError() && busyGroup() === group.id) {
                    <p class="err small">{{ groupActionError() }}</p>
                  }
                </section>
              }

              <button type="button" class="card new-group" (click)="openGroup(null)">
                <span class="plus"><tw-icon name="plus" [size]="20" [strokeWidth]="2" /></span>
                <span class="h3">Nouveau groupe</span>
                <span class="small muted">Rassemblez les athlètes qui visent la même course ou suivent le même plan.</span>
              </button>
            </div>
          }
        }

        @if (tab() === 'athletes') {
        <div class="cols">
          <section class="card table">
            <div class="table-head">
              @if (activeGroup(); as group) {
                <div class="filter">
                  <span class="h2">{{ group.name }}</span>
                  <button
                    class="chip"
                    type="button"
                    [style.background]="tint(group.color).soft"
                    [style.color]="tint(group.color).ink"
                    (click)="groupFilter.set(null)"
                  >
                    Groupe · {{ group.athletes.length }}
                    <tw-icon name="close" [size]="13" [strokeWidth]="2" />
                  </button>
                </div>
              } @else {
                <span class="h2">Mes athlètes</span>
              }
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

        </div>
        }
      }

      @if (groupOpen()) {
        <div class="scrim" (click)="closeGroup()">
          <div class="modal card" (click)="$event.stopPropagation()">
            <div class="spread">
              <span class="h2">{{ editing() ? 'Modifier le groupe' : 'Nouveau groupe' }}</span>
              <button class="icon-btn" type="button" (click)="closeGroup()" aria-label="Fermer">
                <tw-icon name="close" [size]="18" />
              </button>
            </div>

            <div class="field mt">
              <label for="group-name">Nom du groupe</label>
              <input id="group-name" class="input" placeholder="Marathon de Lyon" [value]="groupName()" (input)="groupName.set(value($event))" />
            </div>

            <div class="field mt-sm">
              <label>Couleur</label>
              <div class="swatches">
                @for (choice of colors; track choice.id) {
                  <button
                    type="button"
                    class="swatch"
                    [class.on]="color() === choice.id"
                    [style.background]="choice.dot"
                    [attr.aria-label]="choice.label"
                    [title]="choice.label"
                    (click)="color.set(choice.id)"
                  ></button>
                }
              </div>
            </div>

            <div class="two mt-sm">
              <div class="field">
                <label for="group-race">Course visée <span class="muted">— facultatif</span></label>
                <input id="group-race" class="input" placeholder="Marathon de Lyon" [value]="raceName()" (input)="raceName.set(value($event))" />
              </div>
              <div class="field">
                <label for="group-date">Date</label>
                <input id="group-date" class="input" type="date" [value]="raceDate()" (change)="raceDate.set(value($event))" />
              </div>
            </div>

            <div class="picker-head">
              <span class="caption muted grow">Athlètes</span>
              <span class="caption muted-3">
                <span class="num">{{ picked().size }}</span> sélectionné{{ picked().size > 1 ? 's' : '' }} sur
                <span class="num">{{ home.data()?.athletes?.length ?? 0 }}</span>
              </span>
            </div>
            <div class="picker scroll-y">
              @for (athlete of home.data()?.athletes ?? []; track athlete.id) {
                <button type="button" class="pick" (click)="togglePick(athlete.id)">
                  <span class="box" [class.on]="picked().has(athlete.id)">
                    @if (picked().has(athlete.id)) {
                      <tw-icon name="check" [size]="12" [strokeWidth]="3" />
                    }
                  </span>
                  <tw-avatar [initials]="athlete.initials" tone="accent" [size]="30" />
                  <span class="h3 grow">{{ athlete.name }}</span>
                  <span class="caption muted">{{ athlete.level }}</span>
                </button>
              }
            </div>

            @if (groupError()) {
              <p class="err small">
                {{ groupError() }}
                @if (groupBlocked()) {
                  <a class="link" routerLink="/coach/abonnement" (click)="closeGroup()">Voir les plans</a>
                }
              </p>
            }

            <div class="modal-actions">
              @if (editing()) {
                <button class="btn btn-ghost btn-sm danger-text" type="button" (click)="removeGroup()">Supprimer</button>
              }
              <span class="grow"></span>
              <button class="btn btn-ghost" type="button" (click)="closeGroup()">Annuler</button>
              <button class="btn btn-primary" type="button" [disabled]="!groupName().trim() || savingGroup()" (click)="saveGroup()">
                {{ savingGroup() ? 'Enregistrement…' : editing() ? 'Enregistrer' : 'Créer le groupe' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (planGroup(); as group) {
        <div class="scrim" (click)="closePlan()">
          <div class="modal card" (click)="$event.stopPropagation()">
            <div class="spread">
              <span class="h2">Planifier pour {{ group.name }}</span>
              <button class="icon-btn" type="button" (click)="closePlan()" aria-label="Fermer">
                <tw-icon name="close" [size]="18" />
              </button>
            </div>
            <p class="small muted mt-sm">
              La même séance pour les {{ group.athletes.length }} athlètes du groupe. Chacun la reçoit à son allure, calculée depuis sa VMA.
            </p>

            <div class="field mt">
              <label for="plan-date">Date</label>
              <input id="plan-date" class="input" type="date" [value]="planDate()" (change)="planDate.set(value($event))" />
            </div>

            <div class="picker-head">
              <span class="caption muted grow">Séance de la bibliothèque</span>
            </div>
            @if (templates.loading()) {
              <tw-state kind="loading" />
            } @else {
              <div class="picker scroll-y">
                @for (template of runTemplates(); track template._id) {
                  <button type="button" class="pick" [class.on]="planTemplate() === template._id" (click)="planTemplate.set(template._id)">
                    <span class="box round" [class.on]="planTemplate() === template._id"></span>
                    <span class="stack grow min">
                      <span class="h3 truncate">{{ template.name }}</span>
                      <span class="caption muted truncate">{{ template.description || template.sessionType }}</span>
                    </span>
                  </button>
                } @empty {
                  <p class="small muted pad">Aucune séance type. Créez-en une depuis la bibliothèque.</p>
                }
              </div>
            }

            @if (planError()) {
              <p class="err small">{{ planError() }}</p>
            }
            @if (planDone()) {
              <p class="ok small">{{ planDone() }}</p>
            }

            <div class="modal-actions">
              <span class="grow"></span>
              <button class="btn btn-ghost" type="button" (click)="closePlan()">Fermer</button>
              <button class="btn btn-primary" type="button" [disabled]="!planTemplate() || !planDate() || planning()" (click)="assignToGroup(group)">
                {{ planning() ? 'Planification…' : 'Planifier' }}
              </button>
            </div>
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




      .tabs {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px;
        border-radius: 14px;
        background: var(--surface);
        border: 1px solid var(--border);
        align-self: flex-start;
      }

      /* Onglet actif : pastille sobre et encre, jamais du bleu (DA). */
      .tab {
        height: 38px;
        padding: 0 16px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 500;
        color: var(--text3);
        cursor: pointer;
      }

      .tab.on {
        background: var(--subtle);
        color: var(--ink);
        font-weight: 600;
      }

      .tab .count {
        font-size: 12px;
        font-weight: 600;
        color: var(--text3);
      }

      .tab.on .count {
        color: var(--text2);
      }

      .filter {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .filter .chip {
        cursor: pointer;
      }

      .group-head {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .search.wide {
        width: 300px;
      }

      .groups {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        align-items: start;
      }

      .group {
        padding: 18px 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .group-top {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .tile {
        width: 40px;
        height: 40px;
        border-radius: var(--r-md);
        background: var(--subtle);
        color: var(--text2);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .members {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .more {
        width: 30px;
        height: 30px;
        border-radius: var(--r-pill);
        background: var(--subtle);
        color: var(--text2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 600;
      }

      .group-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-top: 12px;
        border-top: 1px solid var(--border);
      }

      .two {
        display: grid;
        grid-template-columns: 1fr 140px;
        gap: 12px;
      }

      .picker-head {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-top: 16px;
      }

      .picker {
        max-height: 260px;
        margin-top: 4px;
        border: 1px solid var(--border);
        border-radius: var(--r-md);
      }

      .pick {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 9px 12px;
        text-align: left;
        cursor: pointer;
        color: var(--ink);
      }

      .pick + .pick {
        border-top: 1px solid var(--border);
      }

      .pick:hover {
        background: var(--bg);
      }

      .box {
        width: 18px;
        height: 18px;
        border-radius: 5px;
        border: 1.5px solid var(--border-strong);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: #fff;
      }

      .box.on {
        background: var(--brand);
        border-color: var(--brand);
      }

      .swatches {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .swatch {
        width: 30px;
        height: 30px;
        border-radius: var(--r-pill);
        cursor: pointer;
        box-shadow: 0 0 0 0 transparent;
        transition: box-shadow 0.12s ease;
      }

      .swatch.on {
        box-shadow:
          0 0 0 2px var(--surface),
          0 0 0 4px var(--ink);
      }

      /* Ajouter un groupe depuis la grille elle-même, à la place qu'il occupera. */
      .new-group {
        min-height: 168px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-align: center;
        border-style: dashed;
        background: none;
        cursor: pointer;
      }

      .new-group:hover {
        background: var(--surface);
        border-color: var(--border-strong);
      }

      .new-group .plus {
        width: 44px;
        height: 44px;
        border-radius: var(--r-pill);
        background: var(--subtle);
        color: var(--text2);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 2px;
      }

      .new-group .small {
        max-width: 240px;
      }

      .box.round {
        border-radius: var(--r-pill);
      }

      .box.round.on::after {
        content: '';
        width: 8px;
        height: 8px;
        border-radius: var(--r-pill);
        background: #fff;
      }

      .stack.min {
        min-width: 0;
      }

      .pick.on {
        background: var(--subtle);
      }

      .pad {
        padding: 12px 14px;
        margin: 0;
      }

      .danger-text {
        color: var(--danger);
      }

      @media (max-width: 1280px) {
        .groups {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      .cols {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
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




      .request + .request {
        border-top: 1px solid var(--border);
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
  readonly groups = load(() => this.coach.groups$());

  readonly tab = signal<'athletes' | 'groups'>('athletes');
  readonly groupSearch = signal('');

  readonly groupOpen = signal(false);
  readonly editing = signal<CoachGroup | null>(null);
  readonly groupName = signal('');
  readonly color = signal<GroupColor>('bleu');
  readonly raceName = signal('');
  readonly raceDate = signal('');
  readonly picked = signal<Set<string>>(new Set());
  readonly savingGroup = signal(false);
  readonly groupError = signal('');
  /** Vrai quand c'est l'abonnement qui bloque : on propose alors les plans. */
  readonly groupBlocked = signal(false);

  readonly colors = GROUP_COLORS;

  tint(color: GroupColor) {
    return GROUP_TINT[color] ?? GROUP_TINT.bleu;
  }

  readonly visibleGroups = computed(() => {
    const term = this.groupSearch().trim().toLowerCase();
    const groups = this.groups.data() ?? [];
    return term ? groups.filter((group) => group.name.toLowerCase().includes(term)) : groups;
  });

  readonly templates = load(() => this.coach.templates$());

  /** Seules les séances de course se planifient à l'allure de chacun. */
  readonly runTemplates = computed(() => (this.templates.data() ?? []).filter((template) => template.sport === 'running'));

  readonly busyGroup = signal<string | null>(null);
  readonly groupActionError = signal('');

  readonly planGroup = signal<CoachGroup | null>(null);
  readonly planDate = signal(new Date().toISOString().slice(0, 10));
  readonly planTemplate = signal<string | null>(null);
  readonly planning = signal(false);
  readonly planError = signal('');
  readonly planDone = signal('');

  readonly search = signal('');
  readonly inviteOpen = signal(false);
  readonly inviteEmail = signal('');
  readonly inviteError = signal('');
  readonly inviteDone = signal(false);

  /** Groupe sur lequel la liste est filtrée, quand on arrive depuis l'onglet Groupes. */
  readonly groupFilter = signal<string | null>(null);

  readonly activeGroup = computed(() => (this.groups.data() ?? []).find((group) => group.id === this.groupFilter()) ?? null);

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const group = this.activeGroup();
    let athletes = this.home.data()?.athletes ?? [];
    if (group) {
      const members = new Set(group.athletes.map((athlete) => athlete.id));
      athletes = athletes.filter((athlete) => members.has(athlete.id));
    }
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

  groupSubtitle(group: CoachGroup) {
    if (!group.race) return 'Aucune course visée';
    return [group.race.name, group.race.countdown ?? group.race.dateLabel].filter(Boolean).join(' · ');
  }

  /** Voir les athlètes d'un groupe : on revient à la liste, filtrée sur eux. */
  showGroup(group: CoachGroup) {
    this.search.set('');
    this.groupFilter.set(group.id);
    this.tab.set('athletes');
  }

  openGroup(group: CoachGroup | null) {
    this.editing.set(group);
    this.groupName.set(group?.name ?? '');
    this.color.set(group?.color ?? 'bleu');
    this.raceName.set(group?.race?.name ?? '');
    this.raceDate.set('');
    this.picked.set(new Set(group?.athletes.map((athlete) => athlete.id) ?? []));
    this.groupError.set('');
    this.groupBlocked.set(false);
    this.groupOpen.set(true);
  }

  closeGroup() {
    this.groupOpen.set(false);
    this.editing.set(null);
  }

  togglePick(id: string) {
    this.picked.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  saveGroup() {
    if (this.savingGroup()) return;
    this.savingGroup.set(true);
    this.groupError.set('');
    this.groupBlocked.set(false);
    const body = {
      name: this.groupName().trim(),
      color: this.color(),
      athletes: [...this.picked()],
      raceName: this.raceName().trim() || undefined,
      raceDate: this.raceDate() || undefined,
    };
    const current = this.editing();
    const request = current ? this.coach.updateGroup(current.id, body) : this.coach.createGroup(body);
    request.subscribe({
      next: () => {
        this.savingGroup.set(false);
        this.closeGroup();
        this.groups.reload(true);
      },
      error: (err: unknown) => {
        this.savingGroup.set(false);
        this.groupBlocked.set(err instanceof ApiError && err.status === 402);
        this.groupError.set(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
      },
    });
  }

  /** Supprimer le groupe ne touche pas aux athlètes : ils restent suivis. */
  removeGroup() {
    const current = this.editing();
    if (!current || this.savingGroup()) return;
    this.savingGroup.set(true);
    this.coach.deleteGroup(current.id).subscribe({
      next: () => {
        this.savingGroup.set(false);
        this.closeGroup();
        if (this.groupFilter() === current.id) this.groupFilter.set(null);
        this.groups.reload(true);
      },
      error: () => this.savingGroup.set(false),
    });
  }

  /** Ouvre la discussion du groupe : une conversation à plusieurs, pas N messages. */
  messageGroup(group: CoachGroup) {
    if (this.busyGroup()) return;
    this.busyGroup.set(group.id);
    this.groupActionError.set('');
    this.coach.openGroupConversation(group.id).subscribe({
      next: ({ conversationId }) => {
        this.busyGroup.set(null);
        void this.router.navigate(['/messages'], { queryParams: { conversation: conversationId } });
      },
      error: (err: unknown) => {
        this.groupActionError.set(err instanceof ApiError ? err.message : 'Discussion impossible.');
        setTimeout(() => this.busyGroup.set(null), 2500);
      },
    });
  }

  openPlan(group: CoachGroup) {
    this.planGroup.set(group);
    this.planTemplate.set(null);
    this.planError.set('');
    this.planDone.set('');
  }

  closePlan() {
    this.planGroup.set(null);
  }

  /** La même séance pour tout le groupe : le serveur résout l'allure de chacun. */
  assignToGroup(group: CoachGroup) {
    const templateId = this.planTemplate();
    if (!templateId || this.planning()) return;
    this.planning.set(true);
    this.planError.set('');
    this.planDone.set('');
    this.coach.assignTemplate(templateId, { athleteIds: group.athletes.map((athlete) => athlete.id), date: this.planDate() }).subscribe({
      next: () => {
        this.planning.set(false);
        this.planDone.set(`Séance planifiée pour ${group.athletes.length} athlète${group.athletes.length > 1 ? 's' : ''}.`);
      },
      error: (err: unknown) => {
        this.planning.set(false);
        this.planError.set(err instanceof ApiError ? err.message : 'Planification impossible.');
      },
    });
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
      // Le serveur sait pourquoi il refuse : plan plein, athlète déjà suivi…
      error: (err: unknown) =>
        this.inviteError.set(err instanceof ApiError ? err.message : 'Cette adresse ne correspond à aucun compte Trainwise.'),
    });
  }

  /** Tirer un code au hasard reste possible depuis la fenêtre d'invitation. */
  newCode() {
    this.coach.generateInviteCode().subscribe({ next: () => this.invitations.reload(true) });
  }

  onCodeChanged() {
    this.invitations.reload(true);
  }

  value(event: Event) {
    return (event.target as HTMLInputElement).value;
  }
}
