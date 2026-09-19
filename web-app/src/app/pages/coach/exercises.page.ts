import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import type { ApiExercise } from '../../core/api-types';
import { load } from '../../core/load';
import { CoachService } from '../../data/coach.service';
import { MUSCLE_LABELS } from '../../domain/session-detail';
import { IconComponent } from '../../ui/icon.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { StateViewComponent } from '../../ui/state-view.component';

@Component({
  selector: 'tw-coach-exercises',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PageHeaderComponent, StateViewComponent],
  template: `
    <main class="page">
      <tw-page-header title="Bibliothèque" subtitle="Exercices et séances disponibles pour vos athlètes." />

      <div class="toolbar">
        <div class="tabs">
          <button type="button" class="tab" (click)="openSessions()">Séances</button>
          <button type="button" class="tab on">Exercices<span class="count">{{ exercises.data()?.length ?? 0 }}</span></button>
        </div>
        <div class="filters">
          <div class="search">
            <tw-icon name="search" [size]="16" />
            <input placeholder="Rechercher un exercice…" [value]="search()" (input)="search.set(value($event))" />
          </div>
          <select class="input narrow" [value]="muscle()" (change)="muscle.set(value($event))">
            <option value="">Muscles : tous</option>
            @for (option of muscles(); track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
          <select class="input narrow" [value]="equipment()" (change)="equipment.set(value($event))">
            <option value="">Équipements : tous</option>
            @for (option of equipments(); track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </div>
      </div>

      @if (exercises.loading()) {
        <tw-state kind="loading" />
      } @else if (exercises.error()) {
        <tw-state kind="error" [message]="exercises.error()">
          <button class="btn btn-ghost btn-sm" (click)="exercises.reload()">Réessayer</button>
        </tw-state>
      } @else if (filtered().length) {
        <div class="grid">
          @for (exercise of filtered(); track exercise._id) {
            <article class="card ex">
              <div class="thumb">
                @if (exercise.imageUrl) {
                  <img [src]="exercise.imageUrl" [alt]="exercise.name" loading="lazy" />
                } @else {
                  <tw-icon name="dumbbell" [size]="28" />
                }
              </div>
              <div class="body-part">
                <span class="h3">{{ exercise.name }}</span>
                <div class="line">
                  <span class="small strong">{{ muscleLabel(exercise.primaryMuscle) }}</span>
                  @if (exercise.equipment) {
                    <span class="muted-3">·</span>
                    <span class="small muted">{{ exercise.equipment }}</span>
                  }
                </div>
                @if (exercise.muscleGroups?.length) {
                  <div class="tags">
                    @for (group of exercise.muscleGroups ?? []; track group) {
                      <span class="chip">{{ muscleLabel(group) }}</span>
                    }
                  </div>
                }
              </div>
            </article>
          }
        </div>
      } @else {
        <div class="card card-pad">
          <tw-state kind="empty" icon="dumbbell" message="Aucun exercice ne correspond." />
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

      .toolbar {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .tabs {
        display: flex;
        align-items: center;
        gap: 28px;
        border-bottom: 1px solid var(--border);
      }

      .tab {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 0 12px;
        font-size: 15px;
        font-weight: 500;
        color: var(--text2);
        border-bottom: 2px solid transparent;
      }

      .tab.on {
        color: var(--ink);
        font-weight: 600;
        border-bottom-color: var(--brand);
      }

      .count {
        font-size: 12px;
        font-weight: 600;
        color: var(--text3);
      }

      .filters {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .search {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 260px;
        height: 44px;
        padding: 0 12px;
        border-radius: var(--r-md);
        border: 1px solid var(--border);
        color: var(--text3);
      }

      .search input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: none;
        background: none;
        font-size: 14px;
        color: var(--ink);
      }

      .narrow {
        width: 210px;
        height: 44px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
      }

      .ex {
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .thumb {
        position: relative;
        height: 140px;
        background: var(--subtle);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text3);
      }

      .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .body-part {
        padding: 14px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .line {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .strong {
        font-weight: 500;
        color: var(--ink);
      }

      .tags {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      @media (max-width: 1280px) {
        .grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
    `,
  ],
})
export class CoachExercisesPage {
  private readonly coach = inject(CoachService);
  private readonly router = inject(Router);

  readonly exercises = load(() => this.coach.exercises$());

  readonly search = signal('');
  readonly muscle = signal('');
  readonly equipment = signal('');

  readonly muscles = computed(() => {
    const found = new Set<string>();
    for (const exercise of this.exercises.data() ?? []) {
      if (exercise.primaryMuscle) found.add(exercise.primaryMuscle);
      for (const group of exercise.muscleGroups ?? []) found.add(group);
    }
    return [...found].sort().map((value) => ({ value, label: this.muscleLabel(value) }));
  });

  readonly equipments = computed(() =>
    [...new Set((this.exercises.data() ?? []).map((exercise) => exercise.equipment).filter(Boolean))].sort() as string[],
  );

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const muscle = this.muscle();
    const equipment = this.equipment();
    return (this.exercises.data() ?? []).filter((exercise) => {
      if (term && !exercise.name.toLowerCase().includes(term)) return false;
      if (muscle && exercise.primaryMuscle !== muscle && !exercise.muscleGroups?.includes(muscle)) return false;
      if (equipment && exercise.equipment !== equipment) return false;
      return true;
    });
  });

  muscleLabel(value?: string) {
    if (!value) return 'Exercice';
    return MUSCLE_LABELS[value] ?? value;
  }

  openSessions() {
    void this.router.navigate(['/coach/bibliotheque']);
  }

  value(event: Event) {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }
}
