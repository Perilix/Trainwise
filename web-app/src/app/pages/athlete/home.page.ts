import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { formatDecimal, formatHoursMinutes, formatPace } from '../../core/format';
import { load } from '../../core/load';
import { AthleteService } from '../../data/athlete.service';
import { ActivityRowComponent } from '../../ui/activity-row.component';
import { AvatarComponent } from '../../ui/avatar.component';
import { IconComponent } from '../../ui/icon.component';
import type { Activity } from '../../domain/athlete.types';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { SessionRowComponent } from '../../ui/session-row.component';
import { StatComponent } from '../../ui/stat.component';
import { StateViewComponent } from '../../ui/state-view.component';
import { WeekStripComponent } from '../../ui/week-strip.component';

/** Une heure entre deux rattrapages : au-delà, c'est le webhook Strava qui fait le travail. */
const CATCH_UP_DELAY_MS = 60 * 60 * 1000;
const CATCH_UP_KEY = 'tw:strava-catch-up';

@Component({
  selector: 'tw-athlete-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActivityRowComponent,
    AvatarComponent,
    IconComponent,
    PageHeaderComponent,
    RouterLink,
    SessionRowComponent,
    StatComponent,
    StateViewComponent,
    WeekStripComponent,
  ],
  template: `
    <main class="page">
      @if (home.loading()) {
        <tw-state kind="loading" />
      } @else if (home.error()) {
        <tw-state kind="error" [message]="home.error()">
          <button class="btn btn-ghost btn-sm" (click)="home.reload()">Réessayer</button>
        </tw-state>
      } @else if (home.data(); as data) {
        <tw-page-header [title]="'Bonjour, ' + data.firstName" [subtitle]="data.motto">
          @if (data.streakWeeks > 0) {
            <span class="streak">
              <tw-icon name="flame" [size]="18" />
              {{ data.streakWeeks }} semaine{{ data.streakWeeks > 1 ? 's' : '' }} d'affilée
            </span>
          }
          <button class="btn btn-primary" routerLink="/sorties/nouvelle">
            <tw-icon name="plus" [size]="18" [strokeWidth]="2" />
            Enregistrer une séance
          </button>
        </tw-page-header>

        <div class="grid">
          <!-- Séance du jour : carte navy, l'élément mis en avant de l'écran (DA §6.3). -->
          <section class="today">
            @if (data.today; as today) {
              <div class="left">
                <div class="line">
                  <span class="overline on-brand-2">Aujourd'hui</span>
                  @if (today.plannedBy === 'coach' && today.coachName) {
                    <span class="chip chip-on-brand">
                      <tw-icon name="user" [size]="13" [strokeWidth]="2" />
                      Planifiée par {{ today.coachName }}
                    </span>
                  }
                </div>
                <h2 class="h1">{{ today.title }}</h2>
                @if (today.description) {
                  <p class="desc">{{ today.description }}</p>
                }
              </div>
              <div class="right">
                <div class="stats">
                  @for (stat of todayStats(); track stat.label) {
                    <tw-stat class="on-brand" [label]="stat.label" [value]="stat.value" [unit]="stat.unit" />
                  }
                </div>
                <div class="actions">
                  <button class="btn btn-inverse grow" (click)="openToday()">Voir la séance</button>
                  <button class="btn btn-outline-light grow" (click)="markTodayDone()">
                    <tw-icon name="check" [size]="18" [strokeWidth]="2" />
                    Marquer faite
                  </button>
                </div>
              </div>
            } @else {
              <div class="left">
                <span class="overline on-brand-2">Aujourd'hui</span>
                <h2 class="h1">Jour de repos</h2>
                <p class="desc">Rien de prévu aujourd'hui. La récupération fait partie du plan.</p>
              </div>
              <div class="right">
                <div class="actions">
                  <button class="btn btn-inverse grow" routerLink="/planning">Voir le planning</button>
                </div>
              </div>
            }
          </section>

          <!-- Cette semaine -->
          <section class="card card-pad">
            <div class="card-head">
              <h2 class="h2">Cette semaine</h2>
              <a class="link" routerLink="/planning">Voir tout</a>
            </div>
            <div class="week"><tw-week-strip [week]="data.week" /></div>
            <hr class="divider spaced" />
            <div class="week-stats">
              <tw-stat label="Sorties" [value]="data.weekStats.runs" />
              <tw-stat label="Distance" [value]="km(data.weekStats.distanceKm)" unit="km" />
              <tw-stat label="Temps" [value]="hours(data.weekStats.durationSec)" />
            </div>
          </section>

          <!-- Prochains entraînements -->
          <section class="card card-pad tight">
            <div class="card-head">
              <h2 class="h2">Prochains entraînements</h2>
              <a class="link" routerLink="/planning">Planning</a>
            </div>
            @if (data.upcoming.length) {
              <div class="rows">
                @for (session of data.upcoming; track session.id) {
                  <tw-session-row [session]="session" (click)="openSession(session.id)" />
                }
              </div>
            } @else {
              <tw-state kind="empty" icon="calendar" message="Rien de planifié pour l'instant." />
            }
          </section>

          <!-- Derniers entraînements -->
          <section class="card card-pad tight">
            <div class="card-head">
              <h2 class="h2">Derniers entraînements</h2>
              <a class="link" routerLink="/sorties">Sorties</a>
            </div>
            @if (data.recent.length) {
              <div class="rows">
                @for (activity of data.recent; track activity.id) {
                  <tw-activity-row [activity]="activity" (click)="openActivity(activity)" />
                }
              </div>
            } @else {
              <tw-state kind="empty" icon="run" message="Aucune séance enregistrée." />
            }
            <div class="sync">
              <div class="line">
                <span class="dot" [style.background]="data.strava.connected ? 'var(--success)' : 'var(--text3)'"></span>
                <span class="small muted">{{ data.strava.connected ? 'Strava connecté' : 'Strava non connecté' }}</span>
              </div>
              <button class="btn btn-ghost btn-sm" routerLink="/profil">
                <tw-icon name="refresh" [size]="16" [strokeWidth]="2" />
                {{ data.strava.connected ? 'Gérer' : 'Connecter' }}
              </button>
            </div>
          </section>

          <!-- Bloc coach -->
          @if (data.coach; as coach) {
            <section class="card card-pad">
              <div class="spread">
                <span class="h2">Ton coach</span>
                @if (coach.online) {
                  <span class="chip chip-done">En ligne</span>
                }
              </div>
              <div class="coach">
                <tw-avatar [initials]="coach.initials" tone="violet" [size]="48" />
                <div class="stack">
                  <span class="h3">{{ coach.name }}</span>
                  <span class="small muted">Ton coach sur Trainwise</span>
                </div>
              </div>
              @if (coach.lastMessage) {
                <p class="quote">« {{ coach.lastMessage }} »</p>
              }
              <button class="btn btn-ghost btn-block spaced-top" routerLink="/messages">
                <tw-icon name="chat" [size]="18" [strokeWidth]="2" />
                Envoyer un message
              </button>
            </section>
          } @else {
            <section class="card card-pad">
              <span class="h2">Pas encore de coach</span>
              <p class="body muted spaced-top">Rejoins un coach avec son code d'invitation pour recevoir un plan sur mesure.</p>
              <button class="btn btn-ghost btn-block spaced-top" routerLink="/profil">
                <tw-icon name="user" [size]="18" [strokeWidth]="2" />
                Rejoindre un coach
              </button>
            </section>
          }
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

      .streak {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 40px;
        padding: 0 14px 0 12px;
        border-radius: var(--r-md);
        background: var(--surface);
        border: 1px solid var(--border);
        font-size: 14px;
        font-weight: 600;
        color: var(--ink);
      }

      .streak tw-icon {
        color: var(--warn);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 20px;
        align-items: start;
      }

      .today {
        grid-column: span 2;
        background: var(--brand);
        border-radius: var(--r-lg);
        padding: 24px;
        color: var(--on-brand);
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 32px;
      }

      .today .left {
        display: flex;
        flex-direction: column;
      }

      .today .line {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .on-brand-2 {
        color: rgba(255, 255, 255, 0.64);
      }

      .today h2 {
        margin-top: 14px;
      }

      .desc {
        font-size: 15px;
        line-height: 23px;
        color: rgba(255, 255, 255, 0.72);
        margin-top: 6px;
      }

      .today .right {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        padding: 0 0 18px;
        border-bottom: 1px solid var(--brand-line);
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 18px;
      }

      .week {
        margin-top: 16px;
      }

      .divider.spaced {
        margin: 14px 0;
      }

      .week-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .card.tight {
        padding-bottom: 8px;
      }

      .rows {
        margin-top: 4px;
      }

      .rows > *:not(:first-child) {
        border-top: 1px solid var(--border);
      }

      .sync {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 0 4px;
        border-top: 1px solid var(--border);
      }

      .sync .line {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .coach {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 14px;
      }

      .quote {
        font-size: 14px;
        line-height: 21px;
        margin-top: 14px;
        padding: 12px;
        border-radius: var(--r-md);
        background: var(--bg);
      }

      .spaced-top {
        margin-top: 14px;
      }

      @media (max-width: 1280px) {
        .grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .today {
          grid-column: span 2;
        }
      }
    `,
  ],
})
export class AthleteHomePage {
  private readonly athlete = inject(AthleteService);
  private readonly router = inject(Router);

  readonly home = load(() => this.athlete.home$());

  readonly syncing = signal(false);

  constructor() {
    // Filet de sécurité : si un événement Strava s'est perdu, la séance manquante
    // arrive à la prochaine ouverture de l'accueil plutôt qu'à la prochaine
    // synchronisation manuelle.
    effect(() => {
      const data = this.home.data();
      if (data?.strava.connected) untracked(() => this.catchUpStrava());
    });
  }

  readonly todayStats = computed(() => {
    const today = this.home.data()?.today;
    if (!today) return [];
    if (today.sport === 'strength') {
      return [
        { label: 'Durée', value: today.durationMin ? formatHoursMinutes(today.durationMin * 60) : '—', unit: '' },
        { label: 'Exercices', value: today.exercisesCount ?? '—', unit: '' },
      ];
    }
    return [
      { label: 'Distance', value: today.distanceKm ? formatDecimal(today.distanceKm, today.distanceKm % 1 ? 1 : 0) : '—', unit: 'km' },
      { label: 'Durée', value: today.durationMin ? formatHoursMinutes(today.durationMin * 60) : '—', unit: '' },
      { label: 'Allure', value: today.paceSecPerKm ? formatPace(today.paceSecPerKm) : '—', unit: today.paceSecPerKm ? '/km' : '' },
    ];
  });

  /** Importe ce que le webhook n'a pas apporté, au plus une fois par heure. */
  private catchUpStrava() {
    if (this.syncing() || !this.dueForCatchUp()) return;
    this.syncing.set(true);
    this.athlete.syncStrava$().subscribe({
      next: (result) => {
        this.syncing.set(false);
        this.remember();
        if (result.imported.length || result.importedStrength.length) this.home.reload(true);
      },
      // Strava indisponible ou compte délié : l'accueil reste affiché tel quel.
      error: () => {
        this.syncing.set(false);
        this.remember();
      },
    });
  }

  private dueForCatchUp() {
    try {
      return Date.now() - Number(localStorage.getItem(CATCH_UP_KEY) ?? 0) > CATCH_UP_DELAY_MS;
    } catch {
      return false;
    }
  }

  private remember() {
    try {
      localStorage.setItem(CATCH_UP_KEY, String(Date.now()));
    } catch {
      // Navigation privée : on se contente du webhook.
    }
  }

  km(value: number) {
    return formatDecimal(value, 1);
  }

  hours(seconds: number) {
    return formatHoursMinutes(seconds);
  }

  openToday() {
    const today = this.home.data()?.today;
    if (today) this.openSession(today.id);
  }

  openSession(id: string) {
    void this.router.navigate(['/seance', id]);
  }

  /** Sortie ou séance muscu : les deux ont leur écran de détail. */
  openActivity(activity: Activity) {
    const path = activity.sport === 'strength' ? '/muscu-realisee' : '/sorties';
    void this.router.navigate([path, activity.id]);
  }

  markTodayDone() {
    const today = this.home.data()?.today;
    if (!today) return;
    this.athlete.setSessionStatus(today.id, 'completed').subscribe({ next: () => this.home.reload(true) });
  }
}
