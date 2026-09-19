import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import {
  formatDayLong,
  formatDecimal,
  formatDayShort,
  formatHoursMinutes,
  formatMonthYear,
  formatPace,
  parseDay,
  toIsoDay,
} from '../../core/format';
import { load } from '../../core/load';
import { AthleteService } from '../../data/athlete.service';
import type { Activity, PlannedSession } from '../../domain/athlete.types';
import { IconComponent } from '../../ui/icon.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { StatComponent } from '../../ui/stat.component';
import { StateViewComponent } from '../../ui/state-view.component';

type Cell = {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  sessions: PlannedSession[];
  activities: Activity[];
  competition?: 'A' | 'B' | 'C';
};

const WEEKDAYS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];

/** Légende du calendrier : les couleurs exactes des pastilles, dans l'ordre où on les rencontre. */
const LEGEND = [
  { label: 'Planifiée par ton coach', swatch: 'coach' },
  { label: 'Séance planifiée', swatch: 'self' },
  { label: 'Réalisée', swatch: 'done' },
  { label: 'Compétition', swatch: 'comp' },
];

@Component({
  selector: 'tw-athlete-planning',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PageHeaderComponent, StatComponent, StateViewComponent],
  template: `
    <main class="page">
      <tw-page-header title="Planning">
        <div class="nav">
          <button class="sq" type="button" (click)="shiftMonth(-1)" aria-label="Mois précédent">
            <tw-icon name="chevron-left" [size]="18" />
          </button>
          <span class="month">{{ monthLabel() }}</span>
          <button class="sq" type="button" (click)="shiftMonth(1)" aria-label="Mois suivant">
            <tw-icon name="chevron-right" [size]="18" />
          </button>
        </div>
        <button class="btn btn-ghost" type="button" (click)="goToday()">Aujourd'hui</button>
      </tw-page-header>

      @if (planning.loading()) {
        <tw-state kind="loading" />
      } @else if (planning.error()) {
        <tw-state kind="error" [message]="planning.error()">
          <button class="btn btn-ghost btn-sm" (click)="planning.reload()">Réessayer</button>
        </tw-state>
      } @else if (planning.data(); as data) {
        <div class="cols">
          <div class="card calendar">
            <div class="head">
              @for (label of weekdays; track label) {
                <div class="head-cell overline">{{ label }}</div>
              }
            </div>
            <div class="grid">
              @for (cell of cells(); track cell.iso) {
                <div
                  role="button"
                  tabindex="0"
                  class="cell"
                  [class.out]="!cell.inMonth"
                  [class.selected]="cell.iso === selected()"
                  (click)="selected.set(cell.iso)"
                  (keydown.enter)="selected.set(cell.iso)"
                  (keydown.space)="selected.set(cell.iso)"
                >
                  <span class="day" [class.today]="cell.isToday">{{ cell.day }}</span>
                  @for (session of cell.sessions; track session.id) {
                    <button
                      type="button"
                      class="pill"
                      [class.coach]="session.plannedBy === 'coach'"
                      [class.done]="session.status === 'done'"
                      (click)="open(session.id); $event.stopPropagation()"
                    >
                      <span class="pill-head">
                        <tw-icon [name]="session.sport === 'strength' ? 'dumbbell' : 'run'" [size]="12" [strokeWidth]="2" />
                        <span class="truncate">{{ session.title }}</span>
                      </span>
                      <span class="pill-meta truncate num">{{ shortMeta(session) }}</span>
                    </button>
                  }
                  @for (activity of cell.activities; track activity.id) {
                    <button type="button" class="pill done" (click)="openActivity(activity); $event.stopPropagation()">
                      <span class="pill-head">
                        <tw-icon [name]="activity.sport === 'strength' ? 'dumbbell' : 'run'" [size]="12" [strokeWidth]="2" />
                        <span class="truncate">{{ activity.title }}</span>
                      </span>
                    </button>
                  }
                  @if (cell.competition) {
                    <span class="pill comp">
                      <span class="pill-head"><tw-icon name="flag" [size]="12" [strokeWidth]="2" />Compétition {{ cell.competition }}</span>
                    </span>
                  }
                </div>
              }
            </div>

            <div class="legend">
              @for (item of legend; track item.label) {
                <span class="leg">
                  <span class="swatch" [class]="item.swatch"></span>
                  {{ item.label }}
                </span>
              }
            </div>
          </div>

          <aside class="side">
            <section class="card card-pad">
              <div class="spread">
                <div class="stack">
                  <span class="h2">{{ selectedLabel() }}</span>
                  <span class="small muted">{{ selected() === today ? "Aujourd'hui" : relativeLabel() }}</span>
                </div>
              </div>

              @if (selectedSession(); as session) {
                <div class="chips">
                  @if (session.plannedBy === 'coach' && session.coachName) {
                    <span class="chip chip-coach"><tw-icon name="user" [size]="13" [strokeWidth]="2" />Planifiée par {{ session.coachName }}</span>
                  }
                  <span class="chip" [class.chip-done]="session.status === 'done'">
                    <tw-icon [name]="session.status === 'done' ? 'check' : 'clock'" [size]="13" [strokeWidth]="2" />
                    {{ session.status === 'done' ? 'Faite' : session.status === 'skipped' ? 'Passée' : 'À faire' }}
                  </span>
                </div>
                <span class="title">{{ session.title }}</span>
                @if (session.description) {
                  <p class="body muted desc">{{ session.description }}</p>
                }
                <div class="stats">
                  @for (stat of sessionStats(); track stat.label) {
                    <tw-stat [label]="stat.label" [value]="stat.value" [unit]="stat.unit" />
                  }
                </div>
                <div class="actions">
                  @if (session.status === 'planned') {
                    <button class="btn btn-ghost grow" type="button" (click)="skip(session.id)">Passer</button>
                  }
                  <button class="btn btn-primary grow" type="button" (click)="open(session.id)">Voir la séance</button>
                </div>
              } @else if (selectedActivities().length) {
                @for (activity of selectedActivities(); track activity.id) {
                  <div class="done-row" (click)="openActivity(activity)">
                    <span class="title">{{ activity.title }}</span>
                    <span class="small muted">{{ activityMeta(activity) }}</span>
                  </div>
                }
              } @else {
                <tw-state kind="empty" icon="calendar" message="Rien de prévu ce jour." />
              }
            </section>

            <section class="card card-pad list">
              <span class="h2">Ce mois</span>
              <div class="rows">
                <div class="line"><span class="grow body muted">Planifiées</span><span class="h3">{{ data.stats.planned }}</span></div>
                <div class="line"><span class="grow body muted">Effectuées</span><span class="h3">{{ data.stats.done }}</span></div>
                <div class="line">
                  <span class="grow body muted">Distance</span><span class="h3 num">{{ km(data.stats.distanceKm) }} km</span>
                </div>
                @if (nextCompetition(); as next) {
                  <div class="line"><span class="grow body muted">Prochaine compétition</span><span class="h3">{{ next }}</span></div>
                }
              </div>
            </section>
          </aside>
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

      .nav {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .month {
        font-size: 16px;
        line-height: 24px;
        font-weight: 600;
        width: 150px;
        text-align: center;
      }

      .sq {
        width: 40px;
        height: 40px;
        border-radius: var(--r-md);
        border: 1px solid var(--border-strong);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: var(--ink);
      }

      .sq.sm {
        width: 36px;
        height: 36px;
      }

      .sq:hover {
        background: var(--subtle);
      }

      .cols {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        gap: 20px;
        align-items: start;
      }

      .calendar {
        overflow: hidden;
      }

      .head {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        background: var(--bg);
        border-bottom: 1px solid var(--border);
      }

      .head-cell {
        height: 36px;
        display: flex;
        align-items: center;
        padding: 0 12px;
        color: var(--text3);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
      }

      .cell {
        min-height: 112px;
        padding: 8px 8px 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        text-align: left;
        border-right: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
        background: none;
      }

      .cell:nth-child(7n) {
        border-right: 0;
      }

      .cell:hover {
        background: var(--bg);
      }

      .cell.selected {
        background: color-mix(in srgb, var(--accent-soft) 40%, transparent);
        box-shadow: inset 0 0 0 2px var(--brand);
      }

      .day {
        height: 26px;
        display: flex;
        align-items: center;
        font-size: 13px;
        font-weight: 500;
        color: var(--ink);
      }

      .cell.out .day {
        color: var(--text3);
        font-weight: 400;
      }

      .day.today {
        width: 26px;
        justify-content: center;
        border-radius: var(--r-pill);
        background: var(--brand);
        color: var(--on-brand);
        font-weight: 600;
      }

      .pill {
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding: 5px 7px;
        border-radius: 8px;
        background: var(--accent-soft);
        color: var(--accent-ink);
        min-width: 0;
      }

      .pill.coach {
        background: var(--violet-soft);
        color: var(--violet-ink);
      }

      .pill.done {
        background: var(--success-soft);
        color: var(--success-ink);
      }

      .pill.comp {
        background: var(--warn-soft);
        color: var(--warn-ink);
      }

      .pill-head {
        display: flex;
        align-items: center;
        gap: 4px;
        min-width: 0;
        font-size: 12px;
        line-height: 16px;
        font-weight: 600;
      }

      .pill-meta {
        font-size: 11px;
        line-height: 14px;
        color: var(--text2);
      }

      button.pill {
        text-align: left;
        width: 100%;
        cursor: pointer;
      }

      button.pill:hover {
        filter: brightness(0.96);
      }

      .legend {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px 18px;
        padding: 12px 16px;
        border-top: 1px solid var(--border);
        background: var(--bg);
      }

      .leg {
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 12px;
        line-height: 16px;
        color: var(--text2);
      }

      .swatch {
        width: 12px;
        height: 12px;
        border-radius: 4px;
        flex-shrink: 0;
      }

      .swatch.coach {
        background: var(--violet-soft);
        box-shadow: inset 0 0 0 1px var(--violet-ink);
      }

      .swatch.self {
        background: var(--accent-soft);
        box-shadow: inset 0 0 0 1px var(--accent-ink);
      }

      .swatch.done {
        background: var(--success-soft);
        box-shadow: inset 0 0 0 1px var(--success-ink);
      }

      .swatch.comp {
        background: var(--warn-soft);
        box-shadow: inset 0 0 0 1px var(--warn-ink);
      }

      .side {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }

      .chips {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 16px;
        flex-wrap: wrap;
      }

      .title {
        font-size: 17px;
        line-height: 24px;
        font-weight: 600;
        display: block;
        margin-top: 10px;
      }

      .desc {
        margin-top: 2px;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-top: 14px;
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
      }

      .list .rows {
        display: flex;
        flex-direction: column;
        margin-top: 6px;
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

      .done-row {
        margin-top: 14px;
        cursor: pointer;
      }
    `,
  ],
})
export class AthletePlanningPage {
  private readonly athlete = inject(AthleteService);
  private readonly router = inject(Router);

  readonly weekdays = WEEKDAYS;
  readonly legend = LEGEND;
  readonly today = toIsoDay(new Date());

  readonly year = signal(new Date().getFullYear());
  readonly monthIndex = signal(new Date().getMonth());
  readonly selected = signal(this.today);

  readonly planning = load(() => this.athlete.planning$(this.year(), this.monthIndex()));

  readonly monthLabel = computed(() => formatMonthYear(this.year(), this.monthIndex()));

  readonly cells = computed<Cell[]>(() => {
    const data = this.planning.data();
    if (!data) return [];
    const first = new Date(this.year(), this.monthIndex(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const iso = toIsoDay(date);
      return {
        iso,
        day: date.getDate(),
        inMonth: date.getMonth() === this.monthIndex(),
        isToday: iso === this.today,
        sessions: data.sessionsByDay[iso] ?? [],
        activities: data.activitiesByDay[iso] ?? [],
        competition: data.competitionPriority[iso],
      };
    }).slice(0, this.rowsNeeded(start));
  });

  readonly selectedLabel = computed(() => formatDayLong(this.selected()));

  readonly relativeLabel = computed(() => {
    const diff = Math.round((parseDay(this.selected()).getTime() - parseDay(this.today).getTime()) / 86_400_000);
    if (diff === 1) return 'Demain';
    if (diff === -1) return 'Hier';
    return diff > 0 ? `Dans ${diff} jours` : `Il y a ${-diff} jours`;
  });

  readonly selectedSession = computed(() => this.planning.data()?.sessionsByDay[this.selected()]?.[0]);
  readonly selectedActivities = computed(() => this.planning.data()?.activitiesByDay[this.selected()] ?? []);

  readonly sessionStats = computed(() => {
    const session = this.selectedSession();
    if (!session) return [];
    if (session.sport === 'strength') {
      return [
        { label: 'Durée', value: session.durationMin ? formatHoursMinutes(session.durationMin * 60) : '—', unit: '' },
        { label: 'Exercices', value: session.exercisesCount ?? '—', unit: '' },
      ];
    }
    return [
      { label: 'Distance', value: session.distanceKm ? formatDecimal(session.distanceKm, session.distanceKm % 1 ? 1 : 0) : '—', unit: 'km' },
      { label: 'Durée', value: session.durationMin ? formatHoursMinutes(session.durationMin * 60) : '—', unit: '' },
      { label: 'Allure', value: session.paceSecPerKm ? formatPace(session.paceSecPerKm) : '—', unit: session.paceSecPerKm ? '/km' : '' },
    ];
  });

  readonly nextCompetition = computed(() => {
    const data = this.planning.data();
    if (!data) return null;
    const next = Object.keys(data.competitionPriority)
      .filter((iso) => iso >= this.today)
      .sort()[0];
    return next ? formatDayShort(next) : null;
  });

  shiftMonth(delta: number) {
    const date = new Date(this.year(), this.monthIndex() + delta, 1);
    this.year.set(date.getFullYear());
    this.monthIndex.set(date.getMonth());
    this.planning.reload();
  }

  goToday() {
    const now = new Date();
    this.year.set(now.getFullYear());
    this.monthIndex.set(now.getMonth());
    this.selected.set(this.today);
    this.planning.reload();
  }

  shortMeta(session: PlannedSession) {
    if (session.sport === 'strength') return session.exercisesCount ? `${session.exercisesCount} exercices` : 'Renforcement';
    if (session.distanceKm) return `${formatDecimal(session.distanceKm, session.distanceKm % 1 ? 1 : 0)} km`;
    return session.durationMin ? `${session.durationMin} min` : '';
  }

  activityMeta(activity: Activity) {
    const parts = [formatHoursMinutes(activity.durationSec)];
    if (activity.distanceKm) parts.unshift(`${formatDecimal(activity.distanceKm, 1)} km`);
    return parts.join(' · ');
  }

  km(value: number) {
    return formatDecimal(value, value % 1 ? 1 : 0);
  }

  open(id: string) {
    void this.router.navigate(['/seance', id]);
  }

  openActivity(activity: Activity) {
    const path = activity.sport === 'strength' ? '/muscu-realisee' : '/sorties';
    void this.router.navigate([path, activity.id]);
  }

  skip(id: string) {
    this.athlete.setSessionStatus(id, 'skipped').subscribe({ next: () => this.planning.reload(true) });
  }

  /** 5 ou 6 rangées selon le mois : une sixième rangée vide serait du vide inutile. */
  private rowsNeeded(start: Date) {
    const last = new Date(this.year(), this.monthIndex() + 1, 0);
    const days = Math.round((last.getTime() - start.getTime()) / 86_400_000) + 1;
    return Math.ceil(days / 7) * 7;
  }
}
