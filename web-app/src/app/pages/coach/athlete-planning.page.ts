import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs';

import { formatDayLong, formatDecimal, formatMonthYear, toIsoDay } from '../../core/format';
import { load } from '../../core/load';
import { CoachService } from '../../data/coach.service';
import { buildPlanning } from '../../domain/athlete.mappers';
import type { Activity, PlannedSession } from '../../domain/athlete.types';
import { AvatarComponent } from '../../ui/avatar.component';
import { IconComponent } from '../../ui/icon.component';
import { StateViewComponent } from '../../ui/state-view.component';

const WEEKDAYS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];

/** Planning d'un athlète, côté coach : on y pose, déplace et retire les séances. */
@Component({
  selector: 'tw-coach-planning',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, StateViewComponent],
  template: `
    <main class="page">
      <header>
        <button type="button" class="back" (click)="goBack()">
          <tw-icon name="chevron-left" [size]="16" />
          <span class="small">{{ fiche.data()?.name || 'Fiche athlète' }}</span>
        </button>
        <div class="title-line">
          <div class="who">
            @if (fiche.data(); as athlete) {
              <tw-avatar [initials]="athlete.initials" tone="accent" [size]="48" />
            }
            <div class="stack">
              <h1 class="display">Planning</h1>
              <span class="body muted">{{ fiche.data()?.name }}</span>
            </div>
          </div>
          <div class="actions">
            <div class="nav">
              <button class="sq" type="button" (click)="shiftMonth(-1)" aria-label="Mois précédent">
                <tw-icon name="chevron-left" [size]="18" />
              </button>
              <span class="month">{{ monthLabel() }}</span>
              <button class="sq" type="button" (click)="shiftMonth(1)" aria-label="Mois suivant">
                <tw-icon name="chevron-right" [size]="18" />
              </button>
            </div>
            <button class="btn btn-ghost" type="button" (click)="assignFromLibrary()">
              <tw-icon name="folder" [size]="18" [strokeWidth]="2" />
              Depuis la bibliothèque
            </button>
            <button class="btn btn-primary" type="button" (click)="openCreate()">
              <tw-icon name="plus" [size]="18" [strokeWidth]="2" />
              Ajouter une séance
            </button>
          </div>
        </div>
      </header>

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
                      [class.done]="session.status === 'done'"
                      [class.coach]="session.plannedBy === 'coach'"
                      (click)="openSession(session.id); $event.stopPropagation()"
                    >
                      <span class="pill-head">
                        <tw-icon [name]="session.sport === 'strength' ? 'dumbbell' : 'run'" [size]="12" [strokeWidth]="2" />
                        <span class="truncate">{{ session.title }}</span>
                      </span>
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
                </div>
              }
            </div>
          </div>

          <aside class="side">
            <section class="card card-pad">
              <span class="h2">{{ selectedLabel() }}</span>

              @if (selectedSessions().length) {
                <div class="rows">
                  @for (session of selectedSessions(); track session.id) {
                    <div class="row">
                      <div class="stack grow">
                        <span class="h3">{{ session.title }}</span>
                        <span class="small muted">{{ meta(session) }}</span>
                      </div>
                      <button class="icon-btn" type="button" (click)="openSession(session.id)" aria-label="Ouvrir">
                        <tw-icon name="chevron-right" [size]="18" />
                      </button>
                      <button class="icon-btn" type="button" (click)="remove(session.id)" aria-label="Supprimer">
                        <tw-icon name="trash" [size]="18" />
                      </button>
                    </div>
                  }
                </div>
              } @else {
                <tw-state kind="empty" icon="calendar" message="Rien de prévu ce jour." />
              }

              @for (activity of selectedActivities(); track activity.id) {
                <div class="row" (click)="openRun(activity.id)">
                  <span class="chip chip-done">Réalisée</span>
                  <div class="stack grow">
                    <span class="h3">{{ activity.title }}</span>
                    <span class="small muted">{{ activityMeta(activity) }}</span>
                  </div>
                  <tw-icon name="chevron-right" [size]="18" />
                </div>
              }

              <button class="btn btn-ghost btn-block mt" type="button" (click)="openCreate()">
                <tw-icon name="plus" [size]="18" [strokeWidth]="2" />
                Ajouter ce jour-là
              </button>
            </section>

            <section class="card card-pad">
              <span class="h2">Ce mois</span>
              <div class="rows">
                <div class="line"><span class="grow body muted">Planifiées</span><span class="h3">{{ data.stats.planned }}</span></div>
                <div class="line"><span class="grow body muted">Effectuées</span><span class="h3">{{ data.stats.done }}</span></div>
                <div class="line"><span class="grow body muted">Distance</span><span class="h3 num">{{ km(data.stats.distanceKm) }} km</span></div>
              </div>
            </section>
          </aside>
        </div>
      }

      @if (creating()) {
        <div class="scrim" (click)="creating.set(false)">
          <div class="modal card" (click)="$event.stopPropagation()">
            <div class="spread">
              <span class="h2">Ajouter une séance</span>
              <button class="icon-btn" type="button" (click)="creating.set(false)" aria-label="Fermer">
                <tw-icon name="close" [size]="18" />
              </button>
            </div>
            <div class="form">
              <div class="two">
                <div class="field">
                  <label for="c-date">Date</label>
                  <input id="c-date" type="date" class="input" [value]="selected()" (change)="selected.set(value($event))" />
                </div>
                <div class="field">
                  <label for="c-sport">Discipline</label>
                  <select id="c-sport" class="input" [value]="draftSport()" (change)="draftSport.set(sportValue($event))">
                    <option value="running">Course</option>
                    <option value="strength">Renforcement</option>
                  </select>
                </div>
              </div>
              <div class="field">
                <label for="c-title">Titre</label>
                <input id="c-title" class="input" placeholder="Fractionné 10 × 400 m" [value]="draftTitle()" (input)="draftTitle.set(value($event))" />
              </div>
              <div class="two">
                <div class="field">
                  <label for="c-distance">Distance (km)</label>
                  <input id="c-distance" class="input" inputmode="decimal" [value]="draftDistance()" (input)="draftDistance.set(value($event))" />
                </div>
                <div class="field">
                  <label for="c-duration">Durée (min)</label>
                  <input id="c-duration" class="input" inputmode="numeric" [value]="draftDuration()" (input)="draftDuration.set(value($event))" />
                </div>
              </div>
              <div class="field">
                <label for="c-desc">Consignes</label>
                <textarea id="c-desc" class="input" rows="3" [value]="draftDesc()" (input)="draftDesc.set(text($event))"></textarea>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn btn-ghost grow" type="button" (click)="creating.set(false)">Annuler</button>
              <button class="btn btn-primary grow" type="button" [disabled]="saving()" (click)="create()">
                {{ saving() ? 'Ajout…' : 'Ajouter' }}
              </button>
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
        gap: 20px;
      }

      .back {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--text2);
        font-weight: 500;
        margin-bottom: 10px;
      }

      .title-line {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
      }

      .who {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .nav {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .month {
        font-size: 15px;
        font-weight: 600;
        width: 140px;
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
        color: var(--ink);
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
        min-height: 104px;
        padding: 8px 8px 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        text-align: left;
        border-right: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
      }

      .cell:nth-child(7n) {
        border-right: 0;
      }

      .cell:hover {
        background: var(--bg);
      }

      .cell.selected {
        box-shadow: inset 0 0 0 2px var(--brand);
      }

      .day {
        height: 26px;
        display: flex;
        align-items: center;
        font-size: 13px;
        font-weight: 500;
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
        padding: 5px 7px;
        border-radius: 8px;
        background: var(--accent-soft);
        color: var(--accent-ink);
        min-width: 0;
      }

      /* La pastille ouvre la séance ; le reste de la case sélectionne le jour. */
      button.pill {
        display: block;
        width: 100%;
        text-align: left;
        cursor: pointer;
      }

      button.pill:hover {
        filter: brightness(0.96);
      }

      .pill.coach {
        background: var(--violet-soft);
        color: var(--violet-ink);
      }

      .pill.done {
        background: var(--success-soft);
        color: var(--success-ink);
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

      .side {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }

      .rows {
        display: flex;
        flex-direction: column;
        margin-top: 10px;
      }

      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 0;
      }

      .row + .row {
        border-top: 1px solid var(--border);
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

      .mt {
        margin-top: 14px;
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
        width: 520px;
        max-width: calc(100vw - 48px);
        padding: 24px;
      }

      .form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 18px;
      }

      .two {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .modal-actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
      }
    `,
  ],
})
export class CoachAthletePlanningPage {
  private readonly coach = inject(CoachService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  readonly weekdays = WEEKDAYS;
  readonly today = toIsoDay(new Date());

  readonly year = signal(new Date().getFullYear());
  readonly monthIndex = signal(new Date().getMonth());
  readonly selected = signal(this.today);

  readonly creating = signal(false);
  readonly saving = signal(false);
  readonly draftSport = signal<'running' | 'strength'>('running');
  readonly draftTitle = signal('');
  readonly draftDistance = signal('');
  readonly draftDuration = signal('');
  readonly draftDesc = signal('');

  readonly fiche = load(() => this.coach.athlete$(this.id()));

  readonly planning = load(() => {
    const start = new Date(this.year(), this.monthIndex(), 1);
    const end = new Date(this.year(), this.monthIndex() + 1, 0);
    return this.coach
      .athleteCalendar$(this.id(), toIsoDay(start), toIsoDay(end))
      .pipe(mapToPlanning(this.fiche.data()?.physical.vma));
  });

  readonly monthLabel = computed(() => formatMonthYear(this.year(), this.monthIndex()));

  readonly cells = computed(() => {
    const data = this.planning.data();
    if (!data) return [];
    const first = new Date(this.year(), this.monthIndex(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const last = new Date(this.year(), this.monthIndex() + 1, 0);
    const days = Math.round((last.getTime() - start.getTime()) / 86_400_000) + 1;
    return Array.from({ length: Math.ceil(days / 7) * 7 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const iso = toIsoDay(date);
      return {
        iso,
        day: date.getDate(),
        inMonth: date.getMonth() === this.monthIndex(),
        isToday: iso === this.today,
        sessions: data.sessionsByDay[iso] ?? [],
        activities: data.activitiesByDay[iso] ?? [],
      };
    });
  });

  readonly selectedLabel = computed(() => formatDayLong(this.selected()));
  readonly selectedSessions = computed(() => this.planning.data()?.sessionsByDay[this.selected()] ?? []);
  readonly selectedActivities = computed(() => this.planning.data()?.activitiesByDay[this.selected()] ?? []);

  shiftMonth(delta: number) {
    const date = new Date(this.year(), this.monthIndex() + delta, 1);
    this.year.set(date.getFullYear());
    this.monthIndex.set(date.getMonth());
    this.planning.reload();
  }

  meta(session: PlannedSession) {
    const parts: string[] = [];
    if (session.distanceKm) parts.push(`${formatDecimal(session.distanceKm, 1)} km`);
    if (session.durationMin) parts.push(`${session.durationMin} min`);
    return parts.join(' · ') || (session.sport === 'strength' ? 'Renforcement' : 'Course');
  }

  activityMeta(activity: Activity) {
    return activity.distanceKm ? `${formatDecimal(activity.distanceKm, 1)} km` : `${Math.round(activity.durationSec / 60)} min`;
  }

  km(value: number) {
    return formatDecimal(value, value % 1 ? 1 : 0);
  }

  openCreate() {
    this.draftTitle.set('');
    this.draftDistance.set('');
    this.draftDuration.set('');
    this.draftDesc.set('');
    this.creating.set(true);
  }

  create() {
    if (this.saving()) return;
    this.saving.set(true);
    const distance = Number(this.draftDistance().replace(',', '.'));
    const duration = Number(this.draftDuration());
    this.coach
      .createSession(this.id(), {
        date: this.selected(),
        type: this.draftSport(),
        activityType: this.draftSport(),
        sessionType: this.draftSport() === 'strength' ? 'full_body' : 'endurance',
        title: this.draftTitle().trim() || undefined,
        description: this.draftDesc().trim() || undefined,
        targetDistance: Number.isFinite(distance) && distance > 0 ? distance : undefined,
        targetDuration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
        duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.creating.set(false);
          this.planning.reload(true);
        },
        error: () => this.saving.set(false),
      });
  }

  remove(planId: string) {
    this.coach.deleteSession(this.id(), planId).subscribe({ next: () => this.planning.reload(true) });
  }

  openSession(planId: string) {
    void this.router.navigate(['/coach/athletes', this.id(), 'seance', planId]);
  }

  openRun(runId: string) {
    void this.router.navigate(['/coach/athletes', this.id(), 'sortie', runId]);
  }

  /** Une activité réalisée : la sortie ou la séance muscu, selon le sport. */
  openActivity(activity: Activity) {
    const segment = activity.sport === 'strength' ? 'muscu' : 'sortie';
    void this.router.navigate(['/coach/athletes', this.id(), segment, activity.id]);
  }

  assignFromLibrary() {
    void this.router.navigate(['/coach/bibliotheque']);
  }

  goBack() {
    void this.router.navigate(['/coach/athletes', this.id()]);
  }

  value(event: Event) {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  sportValue(event: Event) {
    return (event.target as HTMLSelectElement).value as 'running' | 'strength';
  }

  text(event: Event) {
    return (event.target as HTMLTextAreaElement).value;
  }
}

/** Le calendrier du coach a le même format que celui de l'athlète : on réutilise son constructeur de vue. */
function mapToPlanning(vma?: number) {
  return map((calendar: Parameters<typeof buildPlanning>[0]) => buildPlanning(calendar, new Date(), 'vous', vma));
}
