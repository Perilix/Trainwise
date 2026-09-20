import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

import { formatDayLong, formatDecimal, formatHoursMinutes, formatPace } from '../../core/format';
import { load } from '../../core/load';
import { FeelingScaleComponent } from '../../ui/expected-feeling.component';
import { AthleteService } from '../../data/athlete.service';
import { totals } from '../../domain/sessions';
import { IconComponent } from '../../ui/icon.component';
import { BlockListComponent } from '../../ui/block-list.component';
import { IntensityLegendComponent } from '../../ui/intensity-legend.component';
import { StateViewComponent } from '../../ui/state-view.component';
import { WorkoutProfileComponent } from '../../ui/workout-profile.component';

/** Séance planifiée ouverte par l'athlète : carte navy de mise en avant, puis le déroulé (DA §6.8). */
@Component({
  selector: 'tw-session-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BlockListComponent, FeelingScaleComponent, IconComponent, IntensityLegendComponent, StateViewComponent, WorkoutProfileComponent],
  template: `
    <main class="page">
      @if (session.loading()) {
        <tw-state kind="loading" />
      } @else if (session.error()) {
        <tw-state kind="error" [message]="session.error()">
          <button class="btn btn-ghost btn-sm" (click)="session.reload()">Réessayer</button>
        </tw-state>
      } @else if (session.data(); as data) {
        <button type="button" class="back" (click)="goBack()">
          <tw-icon name="chevron-left" [size]="16" />
          <span class="small">Planning</span>
        </button>

        <div class="cols">
          <div class="main-col">
            <section class="hero">
              <div class="hero-left">
                <span class="overline hl">{{ dayLabel() }}</span>
                <h1 class="h1">{{ data.title }}</h1>
                <div class="chips">
                  @if (data.plannedBy === 'coach' && data.coachName) {
                    <span class="chip chip-on-brand"><tw-icon name="user" [size]="13" [strokeWidth]="2" />Planifiée par {{ data.coachName }}</span>
                  }
                  <span class="chip chip-on-brand">
                    <tw-icon [name]="data.status === 'done' ? 'check' : 'clock'" [size]="13" [strokeWidth]="2" />
                    {{ data.status === 'done' ? 'Faite' : data.status === 'skipped' ? 'Passée' : 'À faire' }}
                  </span>
                </div>
                @if (data.expectedFeeling; as expected) {
                  <tw-feeling-scale class="scale" [value]="expected" label="Ressenti attendu par ton coach" />
                }
                @if (data.description) {
                  <p class="desc">{{ data.description }}</p>
                }
              </div>
              <div class="hero-right">
                <div class="hero-stats">
                  @for (stat of keyStats(); track stat.label) {
                    <div class="hero-stat">
                      <span class="hero-label">{{ stat.label }}</span>
                      <div class="hero-value">
                        <span class="num">{{ stat.value }}</span>
                        @if (stat.unit) {
                          <span class="hero-unit">{{ stat.unit }}</span>
                        }
                      </div>
                    </div>
                  }
                </div>
                <div class="hero-actions">
                  @if (data.status === 'planned') {
                    <button class="btn btn-inverse grow" type="button" (click)="complete()">
                      <tw-icon name="check" [size]="18" [strokeWidth]="2" />
                      Marquer faite
                    </button>
                    <button class="btn btn-outline-light grow" type="button" (click)="skip()">Passer</button>
                  } @else {
                    <button class="btn btn-outline-light grow" type="button" (click)="reopen()">Remettre à faire</button>
                  }
                  @if (data.sport === 'strength') {
                    <button class="btn btn-inverse grow" type="button" (click)="openStrength()">Saisir la séance</button>
                  }
                </div>
              </div>
            </section>

            @if (data.segments.length) {
              <section class="card card-pad">
                <span class="h2">Profil de séance</span>
                <div class="profile">
                  <tw-workout-profile [segments]="data.segments" [width]="700" [height]="72" />
                </div>
                <tw-intensity-legend />
                <div class="profile-totals">
                  <span class="small muted">Durée estimée {{ estimated().duration }}</span>
                  <span class="small muted">Distance estimée {{ estimated().distance }}</span>
                </div>
              </section>
            }

            @if (data.blocks.length) {
              <section class="card card-pad">
                <span class="h2">Déroulé</span>
                <tw-block-list [blocks]="data.blocks" />
              </section>
            }

            @for (part of data.textPlan; track part.label) {
              <section class="card card-pad">
                <span class="h2">{{ part.label }}</span>
                <p class="body muted mt-sm">{{ part.text }}</p>
              </section>
            }
          </div>

          <aside class="side">
            @if (data.strength; as plan) {
              <section class="card card-pad">
                <span class="h2">Exercices</span>
                <div class="ex-list">
                  @for (exercise of plan.exercises; track exercise.key) {
                    <div class="ex">
                      <div class="stack grow">
                        <span class="h3">{{ exercise.name }}</span>
                        <span class="small muted">{{ exerciseTarget(exercise.sets, exercise.reps, exercise.weight) }}</span>
                      </div>
                      @if (exercise.muscle) {
                        <span class="chip">{{ exercise.muscle }}</span>
                      }
                    </div>
                  }
                </div>
                <button class="btn btn-primary btn-block mt" type="button" (click)="openStrength()">Saisir la séance</button>
              </section>
            }

            @if (data.linkedRunId) {
              <section class="card card-pad">
                <span class="h2">Sortie rattachée</span>
                <p class="body muted mt-sm">Cette séance a été rapprochée d'une sortie enregistrée.</p>
                <button class="btn btn-ghost btn-block mt" type="button" (click)="openRun(data.linkedRunId!)">
                  <tw-icon name="run" [size]="18" [strokeWidth]="2" />
                  Voir la sortie
                </button>
              </section>
            }

            <section class="card card-pad">
              <span class="h2">Résumé</span>
              <div class="rows">
                <div class="line"><span class="grow body muted">Discipline</span><span class="h3">{{ data.sport === 'strength' ? 'Renforcement' : 'Course' }}</span></div>
                <div class="line"><span class="grow body muted">Origine</span><span class="h3">{{ data.plannedBy === 'coach' ? 'Coach' : 'Toi' }}</span></div>
                <div class="line"><span class="grow body muted">Date</span><span class="h3">{{ dayLabel() }}</span></div>
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
        gap: 20px;
      }

      .back {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--text2);
        font-weight: 500;
      }

      .back:hover {
        color: var(--ink);
      }

      .cols {
        display: grid;
        grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
        gap: 20px;
        align-items: start;
      }

      .main-col,
      .side {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }

      .hero {
        background: var(--brand);
        color: var(--on-brand);
        border-radius: var(--r-xl);
        padding: 24px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 32px;
      }

      .hero-left {
        display: flex;
        flex-direction: column;
      }

      .hl {
        color: var(--highlight);
      }

      .hero h1 {
        margin-top: 10px;
      }

      .chips {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 12px;
        flex-wrap: wrap;
      }

      .scale {
        margin-top: 14px;
        max-width: 420px;
      }

      .desc {
        font-size: 15px;
        line-height: 23px;
        color: rgba(255, 255, 255, 0.72);
        margin-top: 12px;
      }

      .hero-right {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
      }

      .hero-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        padding: 0 0 18px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.14);
      }

      .hero-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }

      .hero-value {
        display: flex;
        align-items: baseline;
        gap: 3px;
      }

      .hero-value .num {
        font-size: 22px;
        font-weight: 600;
      }

      .hero-unit {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }

      .hero-actions {
        display: flex;
        gap: 10px;
        margin-top: 18px;
      }

      .profile {
        margin: 16px 0 14px;
      }

      .profile-totals {
        display: flex;
        gap: 18px;
        margin-top: 12px;
      }

      .ex-list {
        display: flex;
        flex-direction: column;
        margin-top: 8px;
      }

      .ex {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 0;
      }

      .ex + .ex {
        border-top: 1px solid var(--border);
      }

      .rows {
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

      .mt {
        margin-top: 14px;
      }

      .mt-sm {
        margin-top: 6px;
      }
    `,
  ],
})
export class SessionDetailPage {
  /** Le libellé d'une note, pour que coach et athlète parlent de la même chose. */

  private readonly athlete = inject(AthleteService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly id = input.required<string>();

  readonly session = load(() => this.athlete.plannedSession$(this.id()));

  readonly dayLabel = computed(() => {
    const data = this.session.data();
    return data ? formatDayLong(data.date) : '';
  });

  readonly keyStats = computed(() => {
    const data = this.session.data();
    if (!data) return [];
    if (data.sport === 'strength') {
      return [
        { label: 'Durée', value: data.durationMin ? formatHoursMinutes(data.durationMin * 60) : '—', unit: '' },
        { label: 'Exercices', value: data.exercisesCount ?? '—', unit: '' },
      ];
    }
    return [
      { label: 'Distance', value: data.distanceKm ? formatDecimal(data.distanceKm, data.distanceKm % 1 ? 1 : 0) : '—', unit: 'km' },
      { label: 'Durée', value: data.durationMin ? formatHoursMinutes(data.durationMin * 60) : '—', unit: '' },
      { label: 'Allure', value: data.paceSecPerKm ? formatPace(data.paceSecPerKm) : '—', unit: data.paceSecPerKm ? '/km' : '' },
    ];
  });

  readonly estimated = computed(() => {
    const segments = this.session.data()?.segments ?? [];
    const total = totals(segments);
    return { duration: formatHoursMinutes(total.sec), distance: `${formatDecimal(total.dist / 1000, 1)} km` };
  });

  duration(seconds: number) {
    return formatHoursMinutes(seconds);
  }

  exerciseTarget(sets?: number, reps?: string, weight?: number) {
    const parts: string[] = [];
    if (sets) parts.push(`${sets} séries`);
    if (reps) parts.push(`${reps} reps`);
    if (weight) parts.push(`${weight} kg`);
    return parts.join(' · ') || 'À ton rythme';
  }

  complete() {
    this.athlete.setSessionStatus(this.id(), 'completed').subscribe({ next: () => this.session.reload(true) });
  }

  skip() {
    this.athlete.setSessionStatus(this.id(), 'skipped').subscribe({ next: () => this.session.reload(true) });
  }

  reopen() {
    this.athlete.setSessionStatus(this.id(), 'planned').subscribe({ next: () => this.session.reload(true) });
  }

  openStrength() {
    void this.router.navigate(['/muscu', this.id()]);
  }

  openRun(runId: string) {
    void this.router.navigate(['/sorties', runId]);
  }

  goBack() {
    if (history.length > 1) this.location.back();
    else void this.router.navigate(['/planning']);
  }
}
