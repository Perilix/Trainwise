import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { load } from '../../core/load';
import { CoachService } from '../../data/coach.service';
import { ATHLETE_STATUS_STYLE } from '../../domain/coach.status';
import type { AthleteStatus } from '../../domain/coach.types';
import { AvatarComponent } from '../../ui/avatar.component';
import { IconComponent } from '../../ui/icon.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { StateViewComponent } from '../../ui/state-view.component';

const PERIODS = [
  { weeks: 8, label: '8 semaines' },
  { weeks: 13, label: '3 mois' },
  { weeks: 26, label: '6 mois' },
];

/**
 * Stats : l'activité du coach, et surtout ce qui attend une réponse.
 * Les demandes d'abonnement et les invitations vivaient sur l'accueil, où elles
 * poussaient la liste des athlètes vers le bas ; elles sont ici.
 */
@Component({
  selector: 'tw-coach-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, PageHeaderComponent, RouterLink, StateViewComponent],
  template: `
    <main class="page">
      <tw-page-header title="Stats" subtitle="Votre activité, et ce qui attend une réponse.">
        <div class="segmented">
          @for (option of periods; track option.weeks) {
            <button type="button" class="seg" [class.on]="weeks() === option.weeks" (click)="setWeeks(option.weeks)">{{ option.label }}</button>
          }
        </div>
      </tw-page-header>

      <div class="kpis">
        <div class="card kpi">
          <span class="small muted">Athlètes suivis</span>
          <span class="value num">{{ home.data()?.stats?.athletes ?? '—' }}</span>
        </div>
        <div class="card kpi">
          <span class="small muted">Séances cette semaine</span>
          <span class="value num">{{ currentWeek()?.planned ?? '—' }}</span>
        </div>
        <div class="card kpi">
          <span class="small muted">Taux de réalisation</span>
          <span class="value num">{{ weekly.data()?.completionRate ?? '—' }}<span class="unit">%</span></span>
        </div>
        <div class="card kpi">
          <span class="small muted">Séances planifiées</span>
          <span class="value num">{{ weekly.data()?.totals?.planned ?? '—' }}</span>
        </div>
      </div>

      <div class="cols">
        <div class="col">
          <section class="card card-pad">
            <div class="spread">
              <span class="h2">Planifié et réalisé</span>
              <div class="legend">
                <span class="leg"><span class="swatch planned"></span>Planifié</span>
                <span class="leg"><span class="swatch done"></span>Réalisé</span>
              </div>
            </div>

            @if (weekly.loading()) {
              <tw-state kind="loading" />
            } @else if (bars(); as series) {
              @if (series.length) {
                <div class="chart">
                  @for (bar of series; track bar.label) {
                    <div class="slot">
                      <div class="pair">
                        <span class="bar planned" [style.height.%]="bar.plannedPct"></span>
                        <span class="bar done" [style.height.%]="bar.donePct"></span>
                      </div>
                      <span class="caption muted-3">{{ bar.label }}</span>
                    </div>
                  }
                </div>
                <p class="caption muted note">
                  La semaine en cours n'est pas terminée : {{ currentWeek()?.done ?? 0 }} séances réalisées sur
                  {{ currentWeek()?.planned ?? 0 }} prévues. Elle ne compte pas dans le taux.
                </p>
              } @else {
                <tw-state kind="empty" icon="chart" message="Pas encore de séance planifiée." />
              }
            }
          </section>
        </div>

        <div class="col">
          <section class="card">
            <div class="head">
              <span class="h2">Demandes d'abonnement</span>
              @if (requests().length) {
                <span class="count">{{ requests().length }}</span>
              }
            </div>
            @for (request of requests(); track request.id) {
              <div class="row">
                <tw-avatar [initials]="request.initials" tone="accent" [size]="36" />
                <div class="stack grow">
                  <span class="h3">{{ request.name }}</span>
                  <span class="small muted">{{ request.offer }} · {{ request.requestedLabel }}</span>
                </div>
                <button class="icon-btn ok" type="button" [disabled]="busy()" (click)="respond(request.id, true)" aria-label="Accepter">
                  <tw-icon name="check" [size]="17" [strokeWidth]="2" />
                </button>
                <button class="icon-btn" type="button" [disabled]="busy()" (click)="respond(request.id, false)" aria-label="Refuser">
                  <tw-icon name="close" [size]="17" />
                </button>
              </div>
            } @empty {
              <p class="small muted pad">Aucune demande en attente.</p>
            }
          </section>

          <section class="card">
            <div class="head">
              <span class="h2">Invitations en attente</span>
              @if (pending().length) {
                <span class="count">{{ pending().length }}</span>
              }
            </div>
            @for (invitation of pending(); track invitation.id) {
              <div class="row">
                <tw-avatar [initials]="invitation.initials" tone="subtle" [size]="36" />
                <div class="stack grow">
                  <span class="h3">{{ invitation.name }}</span>
                  <span class="small muted">{{ invitation.sentLabel }}</span>
                </div>
                <span class="chip chip-warn">En attente</span>
              </div>
            } @empty {
              <p class="small muted pad">Aucune invitation en attente.</p>
            }
          </section>

          <section class="card">
            <div class="head">
              <span class="h2">À surveiller</span>
              @if (watch().length) {
                <span class="count">{{ watch().length }}</span>
              }
            </div>
            @for (athlete of watch(); track athlete.id) {
              <a class="row" [routerLink]="['/coach/athletes', athlete.id]">
                <tw-avatar [initials]="athlete.initials" tone="accent" [size]="36" />
                <div class="stack grow">
                  <span class="h3">{{ athlete.name }}</span>
                  <span class="small muted truncate">{{ athlete.subtitle }}</span>
                </div>
                <span class="chip" [class]="style(athlete.status).chip">{{ style(athlete.status).label }}</span>
              </a>
            } @empty {
              <p class="small muted pad">Tout le monde est à jour.</p>
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

      .kpis {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
      }

      .kpi {
        padding: 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .value {
        font-size: 28px;
        line-height: 36px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }

      .unit {
        font-size: 14px;
        color: var(--text3);
        margin-left: 2px;
      }

      .cols {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 380px;
        gap: 20px;
        align-items: start;
      }

      .col {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }

      .legend {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .leg {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--text2);
      }

      .swatch {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        display: block;
      }

      .swatch.planned,
      .bar.planned {
        background: var(--subtle);
      }

      .swatch.done,
      .bar.done {
        background: var(--accent);
      }

      /* Deux barres par semaine : le prévu derrière, le réalisé devant. */
      .chart {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        height: 190px;
        margin-top: 18px;
      }

      .slot {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        height: 100%;
      }

      .pair {
        flex: 1;
        width: 100%;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        gap: 4px;
      }

      .bar {
        width: 14px;
        min-height: 3px;
        border-radius: 3px;
        display: block;
      }

      .note {
        margin: 12px 0 0;
      }

      .head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 16px 20px 12px;
      }

      .count {
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        border-radius: var(--r-pill);
        background: var(--danger);
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 20px;
        border-top: 1px solid var(--border);
        color: var(--ink);
      }

      a.row:hover {
        background: var(--bg);
      }

      .icon-btn.ok {
        color: var(--success);
        background: var(--success-soft);
      }

      .pad {
        padding: 0 20px 16px;
        margin: 0;
      }
    `,
  ],
})
export class CoachStatsPage {
  private readonly coach = inject(CoachService);

  readonly periods = PERIODS;
  readonly weeks = signal(8);
  readonly busy = signal(false);

  readonly home = load(() => this.coach.home$());
  readonly invitations = load(() => this.coach.invitations$());
  readonly weekly = load(() => this.coach.weeklyStats$(this.weeks()));

  readonly requests = computed(() => this.home.data()?.requests ?? []);
  readonly pending = computed(() => this.invitations.data()?.pending ?? []);

  /** Ceux qui ne sont ni en forme ni à jour : c'est là que le coach doit regarder. */
  readonly watch = computed(() => (this.home.data()?.athletes ?? []).filter((athlete) => athlete.status !== 'green'));

  readonly currentWeek = computed(() => {
    const series = this.weekly.data()?.weeks ?? [];
    return series.length ? series[series.length - 1] : null;
  });

  readonly bars = computed(() => {
    const series = this.weekly.data()?.weeks ?? [];
    const top = Math.max(1, ...series.map((week) => Math.max(week.planned, week.done)));
    if (!series.some((week) => week.planned || week.done)) return [];
    return series.map((week) => ({
      label: week.label,
      plannedPct: (week.planned / top) * 100,
      donePct: (week.done / top) * 100,
    }));
  });

  setWeeks(weeks: number) {
    if (weeks === this.weeks()) return;
    this.weeks.set(weeks);
    this.weekly.reload();
  }

  style(status: AthleteStatus) {
    return ATHLETE_STATUS_STYLE[status];
  }

  respond(id: string, accept: boolean) {
    if (this.busy()) return;
    this.busy.set(true);
    this.coach.respondToRequest(id, accept).subscribe({
      next: () => {
        this.busy.set(false);
        this.home.reload(true);
      },
      error: () => this.busy.set(false),
    });
  }
}
