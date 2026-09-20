import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

import type { ApiExerciseRef, ApiStrengthEntry } from '../../core/api-types';
import { formatDayLong, formatDecimal } from '../../core/format';
import { load } from '../../core/load';
import { AthleteService } from '../../data/athlete.service';
import { MUSCLE_LABELS } from '../../domain/session-detail';
import { CoachFeedbackComponent } from '../../ui/coach-feedback.component';
import { IconComponent } from '../../ui/icon.component';
import { StatComponent } from '../../ui/stat.component';
import { StateViewComponent } from '../../ui/state-view.component';

const TYPE_LABELS: Record<string, string> = {
  upper_body: 'Renfo haut du corps',
  lower_body: 'Renfo bas du corps',
  full_body: 'Renfo corps complet',
  core: 'Gainage',
  hiit: 'HIIT',
};

/** Séance de renforcement déjà réalisée, vue par l'athlète : ses séries, série par série. */
@Component({
  selector: 'tw-athlete-strength-done',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CoachFeedbackComponent, IconComponent, StatComponent, StateViewComponent],
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
          <span class="small">Retour</span>
        </button>

        <div class="title-line">
          <div class="stack min">
            <span class="small muted">{{ dayLabel() }}</span>
            <h1 class="display">{{ title() }}</h1>
            <div class="chips">
              <span class="chip chip-done"><tw-icon name="check" [size]="13" [strokeWidth]="2" />Réalisée</span>
              @if (data.stravaActivityId) {
                <span class="chip chip-strava">Strava</span>
              }
            </div>
          </div>
        </div>

        <section class="card stats-card">
          <div class="stats">
            <tw-stat label="Durée" [value]="data.duration ?? '—'" [unit]="data.duration ? 'min' : ''" />
            <tw-stat label="Séries" [value]="totalSets()" />
            <tw-stat label="Volume" [value]="volume()" unit="kg" />
            <tw-stat label="Ressenti" [value]="data.feeling ?? '—'" [unit]="data.feeling ? '/10' : ''" />
          </div>
        </section>

        <div class="cols">
          <div class="col">
            <section class="card card-pad">
              <span class="h2">Exercices</span>
              <div class="ex-list">
                @for (entry of data.exercises; track $index) {
                  <div class="ex">
                    <div class="ex-head">
                      <span class="tile"><tw-icon name="dumbbell" [size]="18" /></span>
                      <div class="stack grow">
                        <span class="h3">{{ exerciseName(entry) }}</span>
                        <span class="small muted">{{ exerciseMuscle(entry) }}{{ blockLabel(entry) }}</span>
                      </div>
                      @if (entry.target?.reps) {
                        <span class="chip">Cible {{ entry.target!.sets }} × {{ entry.target!.reps }}</span>
                      }
                    </div>
                    <div class="sets">
                      @for (set of entry.sets; track $index) {
                        <div class="set">
                          <span class="idx num">{{ $index + 1 }}</span>
                          <span class="h3 num">{{ set.reps }} reps</span>
                          <span class="small muted num">{{ set.weight ? dec(set.weight) + ' kg' : 'poids du corps' }}</span>
                          @if (set.rpe) {
                            <span class="chip">RPE {{ set.rpe }}</span>
                          }
                        </div>
                      }
                    </div>
                  </div>
                } @empty {
                  <tw-state kind="empty" icon="dumbbell" message="Aucune série enregistrée." />
                }
              </div>
            </section>
          </div>

          <div class="col">
            @if (data.circuit) {
              <section class="card card-pad">
                <span class="h2">Circuit</span>
                <p class="body muted mt-sm">
                  {{ data.circuit.name || 'Circuit' }} · {{ data.circuit.rounds }} tours · récup {{ data.circuit.restBetweenRounds }} s
                </p>
              </section>
            }
            @if (data.superset) {
              <section class="card card-pad">
                <span class="h2">Super-set</span>
                <p class="body muted mt-sm">
                  {{ data.superset.name || 'Super-set' }} · {{ data.superset.sets }} séries · récup {{ data.superset.restBetweenSets }} s
                </p>
              </section>
            }
            @if (data.notes) {
              <section class="card card-pad">
                <span class="h2">Mes notes</span>
                <p class="quote">« {{ data.notes }} »</p>
              </section>
            }
            @if (data.coachFeedback?.text) {
              <tw-coach-feedback [feedback]="data.coachFeedback" />
            }
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
      }

      .title-line {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
      }

      .stack.min {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .chips {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
      }

      .stats-card {
        padding: 18px 20px;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }

      .cols {
        display: grid;
        grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
        gap: 20px;
        align-items: start;
      }

      .col {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }

      .ex-list {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-top: 14px;
      }

      .ex {
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        padding: 14px;
      }

      .ex-head {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .tile {
        width: 36px;
        height: 36px;
        border-radius: var(--r-sm);
        background: var(--subtle);
        color: var(--brand);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .sets {
        display: flex;
        flex-direction: column;
        margin-top: 10px;
      }

      .set {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
      }

      .set + .set {
        border-top: 1px solid var(--border);
      }

      .idx {
        width: 22px;
        height: 22px;
        border-radius: var(--r-pill);
        background: var(--subtle);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        flex-shrink: 0;
      }

      .quote {
        font-size: 14px;
        line-height: 21px;
        font-style: italic;
        margin-top: 12px;
        padding: 12px;
        border-radius: var(--r-md);
        background: var(--bg);
      }

      .mt-sm {
        margin-top: 6px;
      }
    `,
  ],
})
export class AthleteStrengthDonePage {
  private readonly athlete = inject(AthleteService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly id = input.required<string>();

  readonly session = load(() => this.athlete.strengthSession$(this.id()));

  readonly dayLabel = computed(() => {
    const data = this.session.data();
    return data ? formatDayLong(data.date.slice(0, 10)) : '';
  });

  readonly title = computed(() => {
    const type = this.session.data()?.sessionType;
    return type ? (TYPE_LABELS[type] ?? 'Renforcement') : 'Renforcement';
  });

  readonly totalSets = computed(() => (this.session.data()?.exercises ?? []).reduce((total, entry) => total + entry.sets.length, 0));

  readonly volume = computed(() => {
    const total = (this.session.data()?.exercises ?? []).reduce(
      (sum, entry) => sum + entry.sets.reduce((setSum, set) => setSum + set.reps * (set.weight ?? 0), 0),
      0,
    );
    return Math.round(total).toLocaleString('fr-FR');
  });

  exerciseName(entry: ApiStrengthEntry) {
    const exercise = entry.exercise;
    if (!exercise) return 'Exercice';
    return typeof exercise === 'string' ? 'Exercice' : (exercise as ApiExerciseRef).name;
  }

  exerciseMuscle(entry: ApiStrengthEntry) {
    const exercise = entry.exercise;
    if (!exercise || typeof exercise === 'string') return 'Renforcement';
    const muscle = (exercise as ApiExerciseRef).primaryMuscle;
    return muscle ? (MUSCLE_LABELS[muscle] ?? muscle) : 'Renforcement';
  }

  blockLabel(entry: ApiStrengthEntry) {
    const kind = entry.block?.kind;
    if (kind === 'circuit') return ' · circuit';
    if (kind === 'superset') return ` · super-set ${entry.block?.slot?.toUpperCase() ?? ''}`.trimEnd();
    return '';
  }

  dec(value: number) {
    return formatDecimal(value, value % 1 ? 1 : 0);
  }

  goBack() {
    if (history.length > 1) this.location.back();
    else void this.router.navigate(['/sorties']);
  }
}
