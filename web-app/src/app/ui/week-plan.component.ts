import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { formatDecimal, formatHoursMinutes } from '../core/format';
import type { Activity, PlannedSession, WeekPlanDay } from '../domain/athlete.types';
import { IconComponent } from './icon.component';
import { WorkoutProfileComponent } from './workout-profile.component';

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/** Une séance du rail, planifiée ou déjà faite : les deux s'ouvrent et se citent pareil. */
export type WeekPick = { kind: 'planned'; session: PlannedSession } | { kind: 'activity'; activity: Activity };

/**
 * Rail « la semaine » : sept jours, le profil de chaque séance de course, et
 * deux gestes par séance — l'ouvrir ou la citer dans la conversation.
 */
@Component({
  selector: 'tw-week-plan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, WorkoutProfileComponent],
  template: `
    <div class="days">
      @for (day of days(); track day.iso; let index = $index) {
        <section class="day" [class.today]="day.isToday" [class.empty]="!day.sessions.length && !day.activities.length">
          <header class="head">
            <span class="dot"></span>
            <span class="name">{{ weekdays[index] }}</span>
            <span class="num date">{{ dayNumber(day.iso) }}</span>
          </header>

          @for (session of day.sessions; track session.id) {
            <div class="item" [class.coach]="session.plannedBy === 'coach'" [class.done]="session.status === 'done'" [class.on]="isOpen('planned', session.id)">
              <button type="button" class="item-head" (click)="toggle('planned', session.id)">
                <span class="tile"><tw-icon [name]="session.sport === 'strength' ? 'dumbbell' : 'run'" [size]="14" [strokeWidth]="2" /></span>
                <span class="stack">
                  <span class="title truncate">{{ session.title }}</span>
                  <span class="meta truncate num">{{ sessionMeta(session) }}</span>
                </span>
                @if (session.status === 'done') {
                  <tw-icon name="check" [size]="14" [strokeWidth]="2" />
                }
              </button>

              @if (session.segments.length) {
                <tw-workout-profile class="profile" [segments]="session.segments" [height]="26" [gap]="1" />
              }

              @if (isOpen('planned', session.id)) {
                <div class="actions">
                  <button type="button" class="mini" (click)="openSession.emit(session)">
                    <tw-icon name="eye" [size]="13" [strokeWidth]="2" />
                    Ouvrir
                  </button>
                  <button type="button" class="mini" (click)="quote.emit({ kind: 'planned', session })">
                    <tw-icon name="quote" [size]="13" [strokeWidth]="2" />
                    Citer
                  </button>
                </div>
              }
            </div>
          }

          @for (activity of day.activities; track activity.id) {
            <div class="item done" [class.on]="isOpen('activity', activity.id)">
              <button type="button" class="item-head" (click)="toggle('activity', activity.id)">
                <span class="tile"><tw-icon [name]="activity.sport === 'strength' ? 'dumbbell' : 'run'" [size]="14" [strokeWidth]="2" /></span>
                <span class="stack">
                  <span class="title truncate">{{ activity.title }}</span>
                  <span class="meta truncate num">{{ activityMeta(activity) }}</span>
                </span>
                <tw-icon name="check" [size]="14" [strokeWidth]="2" />
              </button>

              @if (isOpen('activity', activity.id)) {
                <div class="actions">
                  <button type="button" class="mini" (click)="openActivity.emit(activity)">
                    <tw-icon name="eye" [size]="13" [strokeWidth]="2" />
                    Ouvrir
                  </button>
                  <button type="button" class="mini" (click)="quote.emit({ kind: 'activity', activity })">
                    <tw-icon name="quote" [size]="13" [strokeWidth]="2" />
                    Citer
                  </button>
                </div>
              }
            </div>
          }

          @if (!day.sessions.length && !day.activities.length) {
            <span class="rest">Repos</span>
          }
        </section>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .days {
        display: flex;
        flex-direction: column;
      }

      .day {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 0 12px;
      }

      .day + .day {
        border-top: 1px solid var(--border);
      }

      .day.empty {
        padding: 6px 0;
      }

      .head {
        display: flex;
        align-items: center;
        gap: 7px;
      }

      /* Pastille du jour : repère vertical le long de la colonne. */
      .dot {
        width: 6px;
        height: 6px;
        border-radius: var(--r-pill);
        background: var(--border-strong);
        flex-shrink: 0;
      }

      .day.today .dot {
        background: var(--accent);
        box-shadow: 0 0 0 3px var(--accent-soft);
      }

      .name {
        font-size: 12px;
        line-height: 16px;
        font-weight: 600;
        color: var(--text2);
        flex: 1;
        min-width: 0;
      }

      .day.today .name {
        color: var(--ink);
      }

      .date {
        font-size: 12px;
        color: var(--text3);
      }

      .item {
        border-radius: var(--r-sm);
        background: var(--accent-soft);
        color: var(--accent-ink);
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-left: 13px;
      }

      .item.coach {
        background: var(--violet-soft);
        color: var(--violet-ink);
      }

      .item.done {
        background: var(--success-soft);
        color: var(--success-ink);
      }

      .item.on {
        box-shadow: inset 0 0 0 1px currentColor;
      }

      .item-head {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        text-align: left;
        color: inherit;
        cursor: pointer;
      }

      .tile {
        display: flex;
        flex-shrink: 0;
      }

      .stack {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
      }

      .title {
        font-size: 13px;
        line-height: 18px;
        font-weight: 600;
      }

      .meta {
        font-size: 11px;
        line-height: 15px;
        opacity: 0.75;
      }

      /* Le profil hérite de la couleur du bloc : il reste lisible sur les trois fonds. */
      .profile {
        opacity: 0.85;
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .mini {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 26px;
        padding: 0 9px;
        border-radius: var(--r-pill);
        background: var(--surface);
        color: var(--ink);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }

      .mini:hover {
        background: var(--subtle);
      }

      .rest {
        font-size: 12px;
        color: var(--text3);
        margin-left: 13px;
      }
    `,
  ],
})
export class WeekPlanComponent {
  readonly days = input.required<WeekPlanDay[]>();

  readonly openSession = output<PlannedSession>();
  readonly openActivity = output<Activity>();
  readonly quote = output<WeekPick>();

  readonly weekdays = WEEKDAYS;

  private readonly picked = signal<string | null>(null);

  readonly openKey = computed(() => this.picked());

  isOpen(kind: string, id: string) {
    return this.openKey() === `${kind}:${id}`;
  }

  toggle(kind: string, id: string) {
    const key = `${kind}:${id}`;
    this.picked.update((current) => (current === key ? null : key));
  }

  dayNumber(iso: string) {
    return Number(iso.slice(8, 10));
  }

  sessionMeta(session: PlannedSession) {
    if (session.sport === 'strength') return session.exercisesCount ? `${session.exercisesCount} exercices` : 'Renforcement';
    const parts: string[] = [];
    if (session.distanceKm) parts.push(`${formatDecimal(session.distanceKm, session.distanceKm % 1 ? 1 : 0)} km`);
    if (session.durationMin) parts.push(`${session.durationMin} min`);
    return parts.join(' · ') || 'Course';
  }

  activityMeta(activity: Activity) {
    const parts = [formatHoursMinutes(activity.durationSec)];
    if (activity.distanceKm) parts.unshift(`${formatDecimal(activity.distanceKm, 1)} km`);
    return parts.join(' · ');
  }
}
