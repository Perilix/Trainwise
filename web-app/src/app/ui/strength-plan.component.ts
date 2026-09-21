import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { PlanExercise, StrengthPlanView } from '../domain/athlete.types';
import { IconComponent } from './icon.component';

/** Ce que le coach demande sur un exercice : séries, répétitions, charge. */
export const exerciseTarget = (exercise: PlanExercise) => {
  const parts: string[] = [];
  if (exercise.sets) parts.push(`${exercise.sets} séries`);
  if (exercise.reps) parts.push(`${exercise.reps} reps`);
  if (exercise.weight) parts.push(`${exercise.weight} kg`);
  if (exercise.rest) parts.push(`récup ${exercise.rest}`);
  return parts.join(' · ') || 'Charge libre';
};

/**
 * Le plan d'une séance de renforcement : exercices simples, circuit et
 * super-sets.
 *
 * Les trois blocs se rendaient ailleurs, mais seul le premier était affiché —
 * un circuit construit par le coach n'apparaissait nulle part. Ils vivent donc
 * ici, d'un seul tenant, pour l'athlète comme pour le coach.
 */
@Component({
  selector: 'tw-strength-plan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (plan().exercises.length) {
      <div class="group">
        @if (hasBlocks()) {
          <span class="overline muted-3">Exercices</span>
        }
        <div class="list">
          @for (exercise of plan().exercises; track exercise.key) {
            <div class="ex">
              <div class="stack grow min">
                <span class="h3 truncate">{{ exercise.name }}</span>
                <span class="small muted">{{ target(exercise) }}</span>
                @if (exercise.notes) {
                  <span class="caption muted-3">{{ exercise.notes }}</span>
                }
              </div>
              @if (exercise.muscle) {
                <span class="chip">{{ exercise.muscle }}</span>
              }
            </div>
          }
        </div>
      </div>
    }

    @if (plan().circuit; as circuit) {
      <div class="group">
        <div class="head">
          <span class="tile"><tw-icon name="repeat" [size]="16" /></span>
          <span class="h3 grow truncate">{{ circuit.name || 'Circuit' }}</span>
          <span class="chip chip-accent num">{{ circuit.rounds }} tours</span>
        </div>
        <span class="caption muted-3">Récupération entre les tours : {{ circuit.restBetweenRoundsSec }} s</span>
        <div class="list">
          @for (exercise of circuit.exercises; track exercise.key) {
            <div class="ex">
              <div class="stack grow min">
                <span class="h3 truncate">{{ exercise.name }}</span>
                <span class="small muted">{{ target(exercise) }}</span>
              </div>
              @if (exercise.muscle) {
                <span class="chip">{{ exercise.muscle }}</span>
              }
            </div>
          }
        </div>
      </div>
    }

    @if (plan().superset; as superset) {
      <div class="group">
        <div class="head">
          <span class="tile"><tw-icon name="dumbbell" [size]="16" /></span>
          <span class="h3 grow truncate">{{ superset.name || 'Super-set' }}</span>
          <span class="chip chip-accent num">{{ superset.sets }} séries</span>
        </div>
        <span class="caption muted-3">Récupération entre les séries : {{ superset.restBetweenSetsSec }} s</span>
        <div class="list">
          @for (pair of superset.pairs; track $index) {
            <div class="pair">
              @for (exercise of [pair.a, pair.b]; track $index) {
                @if (exercise) {
                  <div class="ex">
                    <span class="slot caption muted-3">{{ $index === 0 ? 'A' : 'B' }}</span>
                    <div class="stack grow min">
                      <span class="h3 truncate">{{ exercise.name }}</span>
                      <span class="small muted">{{ target(exercise) }}</span>
                    </div>
                  </div>
                }
              }
            </div>
          }
        </div>
      </div>
    }

    @if (empty()) {
      <p class="small muted">Aucun exercice dans cette séance.</p>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .head {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .tile {
        width: 28px;
        height: 28px;
        border-radius: var(--r-sm);
        background: var(--subtle);
        color: var(--text2);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .list {
        display: flex;
        flex-direction: column;
        margin-top: 4px;
      }

      .ex {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
        border-top: 1px solid var(--border);
      }

      .stack.min {
        min-width: 0;
      }

      /* Les deux exercices d'un couple se lisent ensemble : pas de trait entre eux. */
      .pair {
        border-left: 2px solid var(--border-strong);
        padding-left: 12px;
        margin-top: 4px;
      }

      .pair .ex:first-child {
        border-top: 0;
      }

      .slot {
        width: 14px;
        flex-shrink: 0;
      }
    `,
  ],
})
export class StrengthPlanComponent {
  readonly plan = input.required<StrengthPlanView>();

  readonly target = exerciseTarget;

  hasBlocks() {
    return Boolean(this.plan().circuit || this.plan().superset);
  }

  empty() {
    const plan = this.plan();
    return !plan.exercises.length && !plan.circuit && !plan.superset;
  }
}
