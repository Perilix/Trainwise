import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs';

import { addDays, startOfWeek } from '../../core/dates';
import { formatDayLong, formatDayShort, formatDecimal, formatMonthYear, parseDay, toIsoDay } from '../../core/format';
import { load } from '../../core/load';
import { CoachService } from '../../data/coach.service';
import { buildPlanning } from '../../domain/athlete.mappers';
import type { Activity, OtherActivity, OtherSportFamily, PlannedSession, Sport } from '../../domain/athlete.types';
import { SPORT_LABELS, otherActivityMeta, otherSportIcon, sessionDistance, sportIcon } from '../../domain/other-sports';
import { AvatarComponent } from '../../ui/avatar.component';
import { ExpectedFeelingComponent } from '../../ui/expected-feeling.component';
import { IconComponent } from '../../ui/icon.component';
import { OtherActivityComponent } from '../../ui/other-activity.component';
import { StateViewComponent } from '../../ui/state-view.component';
import { ApiError } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';

const WEEKDAYS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];

const SPORTS: { value: Sport; label: string; icon: string }[] = [
  { value: 'running', label: 'Course', icon: 'run' },
  { value: 'bike', label: 'Vélo', icon: 'bike' },
  { value: 'swim', label: 'Natation', icon: 'swim' },
  { value: 'strength', label: 'Musculation', icon: 'dumbbell' },
];

/** Ce que la fenêtre suggère selon le sport : exemples de titre, types courants, consignes. */
const DRAFT_COPY: Record<Sport, { title: string; quick: string[]; distance: string; desc: string }> = {
  running: { title: 'Fractionné 10 × 400 m', quick: ['Endurance', 'Fractionné', 'Seuil', 'Sortie longue', 'Côtes'], distance: '10', desc: 'Échauffement 20 min, puis…' },
  bike: { title: 'Sortie endurance 2 h', quick: ['Endurance', 'Seuil', 'PMA', 'Sortie longue', 'Home trainer'], distance: '60', desc: 'Rester en zone 2, cadence autour de 90…' },
  swim: { title: '10 × 100 m crawl', quick: ['Technique', 'Endurance', 'Fractionné', 'Eau libre'], distance: '1500', desc: '400 m d’échauffement, 10 × 100 m récup 20 s…' },
  strength: { title: 'Musculation haut du corps', quick: ['Haut du corps', 'Bas du corps', 'Full body', 'Gainage'], distance: '', desc: '3 tours, 45 s d’effort, 15 s de récup…' },
};

/** Planning d'un athlète, côté coach : on y pose, déplace et retire les séances. */
@Component({
  selector: 'tw-coach-planning',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, ExpectedFeelingComponent, IconComponent, OtherActivityComponent, StateViewComponent],
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
                        <tw-icon [name]="sportIcon(session.sport)" [size]="12" [strokeWidth]="2" />
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
                  @for (other of cell.others; track other.id) {
                    <!-- Pas de page de détail : le clic sélectionne le jour, le panneau montre l'activité. -->
                    <button type="button" class="pill done">
                      <span class="pill-head">
                        <tw-icon [name]="otherIcon(other.family)" [size]="12" [strokeWidth]="2" />
                        <span class="truncate">{{ other.title }}</span>
                      </span>
                      <span class="pill-meta truncate num">{{ otherMeta(other) }}</span>
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

              @for (other of selectedOthers(); track other.id) {
                <tw-other-activity class="other" [activity]="other" />
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
          <div class="modal card" role="dialog" aria-labelledby="c-heading" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <div class="stack grow">
                <span class="overline coach-ink">Planning de {{ fiche.data()?.name }}</span>
                <span id="c-heading" class="modal-title">Nouvelle séance</span>
              </div>
              <button class="icon-btn" type="button" (click)="creating.set(false)" aria-label="Fermer">
                <tw-icon name="close" [size]="18" />
              </button>
            </div>

            <div class="form">
              <div class="sports" role="radiogroup" aria-label="Sport">
                @for (sport of sports; track sport.value) {
                  <button
                    type="button"
                    class="sport"
                    role="radio"
                    [class.on]="draftSport() === sport.value"
                    [attr.aria-checked]="draftSport() === sport.value"
                    (click)="pickSport(sport.value)"
                  >
                    <tw-icon [name]="sport.icon" [size]="22" />
                    {{ sport.label }}
                  </button>
                }
              </div>

              <div class="field">
                <div class="label-line">
                  <span class="label grow">Quand</span>
                  <button class="icon-btn sm" type="button" (click)="shiftDraftWeek(-1)" aria-label="Semaine précédente">
                    <tw-icon name="chevron-left" [size]="16" />
                  </button>
                  <button class="icon-btn sm" type="button" (click)="shiftDraftWeek(1)" aria-label="Semaine suivante">
                    <tw-icon name="chevron-right" [size]="16" />
                  </button>
                </div>
                <div class="week">
                  @for (day of draftWeek(); track day.iso) {
                    <button type="button" class="wday" [class.on]="day.iso === selected()" [attr.aria-label]="day.aria" (click)="selected.set(day.iso)">
                      <span class="wday-name">{{ day.name }}</span>
                      <span class="wday-num num">{{ day.num }}</span>
                      <span class="wday-dot" [class.busy]="day.busy"></span>
                    </button>
                  }
                </div>
              </div>

              <div class="field">
                <label for="c-title">Titre</label>
                <input id="c-title" class="input" [placeholder]="draftCopy().title" [value]="draftTitle()" (input)="draftTitle.set(value($event))" />
                <div class="quick">
                  @for (label of draftCopy().quick; track label) {
                    <button type="button" class="quick-chip" [class.on]="draftTitle() === label" (click)="draftTitle.set(label)">{{ label }}</button>
                  }
                </div>
              </div>

              <div class="targets" [class.pair]="draftSport() === 'bike' || draftSport() === 'swim'">
                @if (draftSport() !== 'strength') {
                  <div class="field">
                    <label for="c-distance">Distance</label>
                    <div class="with-unit">
                      <input id="c-distance" class="input" inputmode="decimal" [placeholder]="draftCopy().distance" [value]="draftDistance()" (input)="draftDistance.set(value($event))" />
                      <span class="unit">{{ draftSport() === 'swim' ? 'm' : 'km' }}</span>
                    </div>
                  </div>
                }
                <div class="field">
                  <label for="c-duration">Durée</label>
                  <div class="with-unit">
                    <input id="c-duration" class="input" inputmode="numeric" placeholder="45" [value]="draftDuration()" (input)="draftDuration.set(value($event))" />
                    <span class="unit">min</span>
                  </div>
                </div>
                @if (draftSport() === 'running') {
                  <div class="field">
                    <label for="c-pace">Allure cible</label>
                    <div class="with-unit">
                      <input id="c-pace" class="input" placeholder="5:00" [value]="draftPace()" (input)="draftPace.set(value($event))" />
                      <span class="unit">/km</span>
                    </div>
                  </div>
                }
              </div>

              <div class="field">
                <label for="c-desc">Consignes</label>
                <textarea id="c-desc" class="input" rows="3" [placeholder]="draftCopy().desc" [value]="draftDesc()" (input)="draftDesc.set(text($event))"></textarea>
              </div>

              <div class="field">
                <span class="label">Difficulté attendue <span class="muted-3">— facultatif</span></span>
                <tw-expected-feeling [value]="draftFeeling()" (changed)="draftFeeling.set($event)" />
              </div>

              @if (draftSport() === 'bike' || draftSport() === 'swim') {
                <div class="strava-note small">
                  <tw-icon name="check" [size]="18" [strokeWidth]="2" />
                  La sortie Strava du jour validera la séance, avec sa description.
                </div>
              }
            </div>

            <div class="modal-foot">
              <span class="small muted grow">{{ draftSummary() }}</span>
              <button class="btn btn-ghost" type="button" (click)="creating.set(false)">Annuler</button>
              <button class="btn btn-primary" type="button" [disabled]="saving()" (click)="create()">
                {{ saving() ? 'Ajout…' : 'Ajouter au planning' }}
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

      .pill-meta {
        display: block;
        font-size: 11px;
        line-height: 14px;
        color: var(--text2);
      }

      .other {
        border-top: 1px solid var(--border);
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
        width: 640px;
        max-width: calc(100vw - 48px);
        max-height: calc(100vh - 48px);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: var(--r-xl);
      }

      .modal-head {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 22px 26px 0;
      }

      .modal-title {
        font-size: 22px;
        line-height: 30px;
        font-weight: 600;
      }

      .coach-ink {
        color: var(--violet-ink);
      }

      .form {
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 18px 26px 22px;
        overflow-y: auto;
        overscroll-behavior: contain;
      }

      .label,
      .field > label {
        font-size: 12px;
        line-height: 16px;
        font-weight: 600;
        color: var(--text2);
      }

      .sports {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }

      .sport {
        height: 72px;
        border-radius: 14px;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text2);
        font-size: 13px;
        font-weight: 600;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .sport:hover {
        border-color: var(--border-strong);
        color: var(--ink);
      }

      /* --primary et non --brand : le marine de marque resterait sombre en thème sombre. */
      .sport.on {
        border: 1.5px solid var(--primary);
        background: var(--accent-soft);
        color: var(--primary);
      }

      .label-line {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .icon-btn.sm {
        width: 28px;
        height: 28px;
      }

      .week {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 6px;
      }

      .wday {
        height: 64px;
        border-radius: var(--r-md);
        border: 1px solid var(--border);
        background: var(--surface);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
      }

      .wday:hover {
        border-color: var(--border-strong);
      }

      .wday.on {
        border-color: var(--primary);
        background: var(--primary);
        color: var(--on-primary);
      }

      .wday-name {
        font-size: 11px;
        line-height: 14px;
        font-weight: 600;
        opacity: 0.75;
      }

      .wday-num {
        font-size: 16px;
        line-height: 22px;
        font-weight: 600;
      }

      .wday-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
      }

      .wday-dot.busy {
        background: var(--violet);
      }

      .wday.on .wday-dot.busy {
        background: var(--on-primary);
      }

      .quick {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 2px;
      }

      .quick-chip {
        padding: 6px 12px;
        border-radius: var(--r-pill);
        border: 1px solid var(--border);
        background: var(--surface);
        font-size: 12px;
        font-weight: 500;
        color: var(--text2);
      }

      .quick-chip:hover,
      .quick-chip.on {
        border-color: var(--border-strong);
        color: var(--ink);
      }

      .quick-chip.on {
        background: var(--subtle);
      }

      .targets {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .targets.pair {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .with-unit {
        position: relative;
      }

      .with-unit .input {
        padding-right: 48px;
      }

      .unit {
        position: absolute;
        right: 14px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 13px;
        font-weight: 500;
        color: var(--text2);
        pointer-events: none;
      }

      .strava-note {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: var(--r-md);
        background: var(--strava-soft);
        color: var(--strava-ink);
      }

      .modal-foot {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 26px;
        border-top: 1px solid var(--border);
        background: var(--bg);
      }
    `,
  ],
})
export class CoachAthletePlanningPage {
  private readonly coach = inject(CoachService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  readonly weekdays = WEEKDAYS;
  readonly today = toIsoDay(new Date());

  readonly year = signal(new Date().getFullYear());
  readonly monthIndex = signal(new Date().getMonth());
  readonly selected = signal(this.today);

  readonly creating = signal(false);
  readonly saving = signal(false);
  readonly sports = SPORTS;
  readonly draftSport = signal<Sport>('running');
  readonly draftTitle = signal('');
  readonly draftDistance = signal('');
  readonly draftDuration = signal('');
  readonly draftPace = signal('');
  readonly draftDesc = signal('');
  /** Ce que l'athlète devrait ressentir en rentrant, sur 10. */
  readonly draftFeeling = signal<number | null>(null);

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
        others: data.othersByDay[iso] ?? [],
      };
    });
  });

  readonly selectedLabel = computed(() => formatDayLong(this.selected()));

  readonly draftCopy = computed(() => DRAFT_COPY[this.draftSport()]);

  /** La semaine du jour choisi, avec un point sur les jours qui ont déjà quelque chose. */
  readonly draftWeek = computed(() => {
    const data = this.planning.data();
    const monday = startOfWeek(parseDay(this.selected()));
    return WEEKDAYS.map((name, index) => {
      const date = addDays(monday, index);
      const iso = toIsoDay(date);
      const busy = Boolean(data && ((data.sessionsByDay[iso]?.length ?? 0) + (data.activitiesByDay[iso]?.length ?? 0) + (data.othersByDay[iso]?.length ?? 0)));
      return { iso, name, num: date.getDate(), busy, aria: formatDayLong(iso) };
    });
  });

  readonly draftSummary = computed(() => {
    const sport = this.draftSport();
    const parts = [formatDayShort(this.selected()), SPORTS.find((item) => item.value === sport)!.label];
    const distance = Number(this.draftDistance().replace(',', '.'));
    if (sport !== 'strength' && distance > 0) parts.push(`${this.draftDistance().trim()} ${sport === 'swim' ? 'm' : 'km'}`);
    const duration = Number(this.draftDuration());
    if (duration > 0) parts.push(`${duration} min`);
    if (this.draftFeeling()) parts.push(`${this.draftFeeling()}/10`);
    return parts.join(' · ');
  });
  readonly selectedSessions = computed(() => this.planning.data()?.sessionsByDay[this.selected()] ?? []);
  readonly selectedActivities = computed(() => this.planning.data()?.activitiesByDay[this.selected()] ?? []);
  readonly selectedOthers = computed(() => this.planning.data()?.othersByDay[this.selected()] ?? []);

  shiftMonth(delta: number) {
    const date = new Date(this.year(), this.monthIndex() + delta, 1);
    this.year.set(date.getFullYear());
    this.monthIndex.set(date.getMonth());
    this.planning.reload();
  }

  meta(session: PlannedSession) {
    const parts: string[] = [];
    if (session.distanceKm) parts.push(sessionDistance(session.sport, session.distanceKm));
    if (session.durationMin) parts.push(`${session.durationMin} min`);
    return parts.join(' · ') || SPORT_LABELS[session.sport];
  }

  activityMeta(activity: Activity) {
    return activity.distanceKm ? `${formatDecimal(activity.distanceKm, 1)} km` : `${Math.round(activity.durationSec / 60)} min`;
  }

  sportIcon(sport: Sport) {
    return sportIcon(sport);
  }

  otherIcon(family: OtherSportFamily) {
    return otherSportIcon(family);
  }

  otherMeta(other: OtherActivity) {
    return otherActivityMeta(other);
  }

  km(value: number) {
    return formatDecimal(value, value % 1 ? 1 : 0);
  }

  openCreate() {
    this.draftTitle.set('');
    this.draftDistance.set('');
    this.draftDuration.set('');
    this.draftPace.set('');
    this.draftDesc.set('');
    this.draftFeeling.set(null);
    this.creating.set(true);
  }

  pickSport(sport: Sport) {
    this.draftSport.set(sport);
    // Un type rapide choisi pour un autre sport (« Technique » passé en vélo) n'a plus de sens.
    const title = this.draftTitle();
    const quickElsewhere = Object.values(DRAFT_COPY).some((copy) => copy.quick.includes(title));
    if (quickElsewhere && !DRAFT_COPY[sport].quick.includes(title)) this.draftTitle.set('');
  }

  shiftDraftWeek(delta: number) {
    this.selected.set(toIsoDay(addDays(parseDay(this.selected()), delta * 7)));
  }

  create() {
    if (this.saving()) return;
    this.saving.set(true);
    const sport = this.draftSport();
    // La natation se saisit en mètres, l'API stocke des km.
    const distance = Number(this.draftDistance().replace(',', '.')) / (sport === 'swim' ? 1000 : 1);
    const duration = Number(this.draftDuration());
    const day = this.selected();
    this.coach
      .createSession(this.id(), {
        date: this.selected(),
        type: sport,
        activityType: sport,
        sessionType: { running: 'endurance', strength: 'full_body', bike: 'bike', swim: 'swim' }[sport],
        title: this.draftTitle().trim() || undefined,
        description: this.draftDesc().trim() || undefined,
        expectedFeeling: this.draftFeeling(),
        targetDistance: sport !== 'strength' && Number.isFinite(distance) && distance > 0 ? distance : undefined,
        targetDuration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
        targetPace: sport === 'running' && /^\d{1,2}:\d{2}$/.test(this.draftPace().trim()) ? this.draftPace().trim() : undefined,
        duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.creating.set(false);
          this.planning.reload(true);
          this.toast.success(`Séance ajoutée au planning le ${formatDayLong(day).toLowerCase()}.`);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.toast.error(err instanceof ApiError ? err.message : 'Ajout impossible.');
        },
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

  text(event: Event) {
    return (event.target as HTMLTextAreaElement).value;
  }
}

/** Le calendrier du coach a le même format que celui de l'athlète : on réutilise son constructeur de vue. */
function mapToPlanning(vma?: number) {
  return map((calendar: Parameters<typeof buildPlanning>[0]) => buildPlanning(calendar, new Date(), 'vous', vma));
}
