import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import type { ApiExercise, ApiExerciseRef, ApiSessionTemplate } from '../../core/api-types';
import { load } from '../../core/load';
import { CoachService } from '../../data/coach.service';
import { SESSION_TYPE_LABELS } from '../../domain/athlete.mappers';
import { MUSCLE_LABELS } from '../../domain/session-detail';
import {
  emptyStrengthPlan,
  exerciseFromLibrary,
  exerciseMeta,
  newCircuit,
  newPair,
  newSuperset,
  strengthExerciseCount,
  toEditableStrength,
  toStrengthPayload,
  validateStrength,
  type EditableExercise,
  type EditableStrengthPlan,
  type ExerciseSlot,
} from '../../domain/strength-plan-model';
import { ExpectedFeelingComponent } from '../../ui/expected-feeling.component';
import { IconComponent } from '../../ui/icon.component';
import { StateViewComponent } from '../../ui/state-view.component';

const STRENGTH_TYPES = ['upper_body', 'lower_body', 'full_body', 'push', 'pull', 'legs', 'core', 'hiit', 'other'];

/** Éditeur de séance de renforcement : exercices simples, super-set et circuit. */
@Component({
  selector: 'tw-strength-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ExpectedFeelingComponent, IconComponent, StateViewComponent],
  template: `
    <main class="page">
      <button type="button" class="back" (click)="goBack()">
        <tw-icon name="chevron-left" [size]="16" />
        <span class="small">Bibliothèque</span>
      </button>

      <div class="title-line">
        <div class="stack min">
          <h1 class="display">{{ name() || 'Nouvelle séance muscu' }}</h1>
          <p class="body muted">Séance muscu réutilisable · exercices, circuit et super-set.</p>
        </div>
        <div class="actions">
          <button class="btn btn-ghost" type="button" (click)="goBack()">Annuler</button>
          <button class="btn btn-primary" type="button" [disabled]="saving()" (click)="save()">
            <tw-icon name="check" [size]="18" [strokeWidth]="2" />
            {{ saving() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </div>
      </div>

      @if (error()) {
        <p class="err small">{{ error() }}</p>
      }

      <div class="cols">
        <div class="col">
          <section class="card card-pad">
            <div class="info-grid">
              <div class="field">
                <label for="name">Nom *</label>
                <input id="name" class="input" [value]="name()" (input)="name.set(value($event))" />
              </div>
              <div class="field">
                <label for="type">Type de séance</label>
                <select id="type" class="input" [value]="sessionType()" (change)="sessionType.set(value($event))">
                  @for (option of types; track option) {
                    <option [value]="option">{{ label(option) }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label for="duration">Durée estimée (min)</label>
                <input id="duration" class="input" inputmode="numeric" [value]="duration()" (input)="duration.set(number($event) ?? 0)" />
              </div>
            </div>
            <div class="field mt">
              <label for="desc">Description</label>
              <textarea id="desc" class="input" rows="2" [value]="description()" (input)="description.set(text($event))"></textarea>
            </div>

            <div class="field mt">
              <label>Difficulté attendue <span class="muted">— facultatif</span></label>
              <tw-expected-feeling [value]="expectedFeeling()" (changed)="expectedFeeling.set($event)" />
            </div>
          </section>

          <section class="card card-pad">
            <div class="spread">
              <span class="h2">Exercices</span>
              <button class="btn btn-ghost btn-sm" type="button" (click)="openPicker('single')">
                <tw-icon name="plus" [size]="16" [strokeWidth]="2" />
                Ajouter un exercice
              </button>
            </div>

            @if (plan().exercises.length) {
              <div class="table">
                <span class="overline muted-3">Exercice</span>
                <span class="overline muted-3">Séries</span>
                <span class="overline muted-3">Reps</span>
                <span class="overline muted-3">Charge (kg)</span>
                <span class="overline muted-3">Repos</span>
                <span></span>

                @for (item of plan().exercises; track item.key) {
                  <span class="cell name">
                    <span class="tile"><tw-icon name="dumbbell" [size]="16" /></span>
                    <span class="stack min">
                      <span class="h3 truncate">{{ item.name }}</span>
                      <span class="caption muted truncate">{{ item.muscle ?? 'Renforcement' }}</span>
                    </span>
                  </span>
                  <span class="cell"><input class="mini num" inputmode="numeric" [value]="item.sets" (input)="patch(item.key, { sets: number($event) ?? 1 })" /></span>
                  <span class="cell"><input class="mini" [value]="item.reps" (input)="patch(item.key, { reps: value($event) })" /></span>
                  <span class="cell"><input class="mini num" inputmode="decimal" [value]="item.weight ?? ''" placeholder="—" (input)="patch(item.key, { weight: number($event) })" /></span>
                  <span class="cell"><input class="mini" [value]="item.rest" (input)="patch(item.key, { rest: value($event) })" /></span>
                  <span class="cell end">
                    <button class="icon-btn" type="button" (click)="removeExercise(item.key)" aria-label="Retirer">
                      <tw-icon name="trash" [size]="16" />
                    </button>
                  </span>
                }
              </div>
            } @else {
              <tw-state kind="empty" icon="dumbbell" message="Aucun exercice simple." />
            }
          </section>

          <section class="card card-pad">
            <div class="spread">
              <div class="block-title">
                <span class="chip chip-accent"><tw-icon name="repeat" [size]="13" [strokeWidth]="2" />Circuit · en boucle</span>
                @if (plan().circuit) {
                  <input class="mini wide" [value]="plan().circuit!.name" (input)="patchCircuit({ name: value($event) })" />
                }
              </div>
              @if (plan().circuit) {
                <div class="controls">
                  <span class="caption muted">Tours</span>
                  <div class="stepper">
                    <button type="button" (click)="patchCircuit({ rounds: plan().circuit!.rounds - 1 })">−</button>
                    <span class="num">{{ plan().circuit!.rounds }}</span>
                    <button type="button" (click)="patchCircuit({ rounds: plan().circuit!.rounds + 1 })">+</button>
                  </div>
                  <span class="caption muted">Récup / tour</span>
                  <div class="stepper">
                    <button type="button" (click)="patchCircuit({ restSec: plan().circuit!.restSec - 15 })">−</button>
                    <span class="num">{{ plan().circuit!.restSec }} s</span>
                    <button type="button" (click)="patchCircuit({ restSec: plan().circuit!.restSec + 15 })">+</button>
                  </div>
                  <button class="icon-btn" type="button" (click)="removeCircuit()" aria-label="Retirer le circuit">
                    <tw-icon name="trash" [size]="16" />
                  </button>
                </div>
              } @else {
                <button class="btn btn-ghost btn-sm" type="button" (click)="addCircuit()">Ajouter un circuit</button>
              }
            </div>

            @if (plan().circuit; as circuit) {
              <div class="loop">
                @for (item of circuit.exercises; track item.key) {
                  <div class="loop-item">
                    <div class="loop-head">
                      <span class="idx">{{ $index + 1 }}</span>
                      <span class="h3 truncate grow">{{ item.name }}</span>
                      <button class="icon-btn" type="button" (click)="removeFromCircuit(item.key)" aria-label="Retirer">
                        <tw-icon name="trash" [size]="16" />
                      </button>
                    </div>
                    <div class="loop-fields">
                      <input class="mini" [value]="item.reps" placeholder="reps" (input)="patchCircuitExercise(item.key, { reps: value($event) })" />
                      <input class="mini num" inputmode="decimal" [value]="item.weight ?? ''" placeholder="charge" (input)="patchCircuitExercise(item.key, { weight: number($event) })" />
                    </div>
                  </div>
                }
                <button type="button" class="add" (click)="openPicker('circuit')">
                  <tw-icon name="plus" [size]="16" [strokeWidth]="2" />
                  Exercice du circuit
                </button>
              </div>
              <span class="caption muted mt-sm">
                Retour au 1 · {{ circuit.rounds }} tours · {{ circuit.restSec }} s de récup entre les tours
              </span>
            }
          </section>

          <section class="card card-pad">
            <div class="spread">
              <div class="block-title">
                <span class="chip chip-coach"><tw-icon name="layers" [size]="13" [strokeWidth]="2" />Super-set</span>
                @if (plan().superset) {
                  <input class="mini wide" [value]="plan().superset!.name" (input)="patchSuperset({ name: value($event) })" />
                }
              </div>
              @if (plan().superset) {
                <div class="controls">
                  <span class="caption muted">Séries</span>
                  <div class="stepper">
                    <button type="button" (click)="patchSuperset({ sets: plan().superset!.sets - 1 })">−</button>
                    <span class="num">{{ plan().superset!.sets }}</span>
                    <button type="button" (click)="patchSuperset({ sets: plan().superset!.sets + 1 })">+</button>
                  </div>
                  <button class="icon-btn" type="button" (click)="removeSuperset()" aria-label="Retirer le super-set">
                    <tw-icon name="trash" [size]="16" />
                  </button>
                </div>
              } @else {
                <button class="btn btn-ghost btn-sm" type="button" (click)="addSuperset()">Ajouter un super-set</button>
              }
            </div>

            @if (plan().superset; as superset) {
              <div class="pairs">
                @for (pair of superset.pairs; track pair.key) {
                  <div class="pair">
                    @for (slot of slots; track slot) {
                      <button type="button" class="slot-box" (click)="openPicker('superset', pair.key, slot)">
                        <span class="slot">{{ slot.toUpperCase() }}</span>
                        @if (pair[slot]; as item) {
                          <span class="stack min grow">
                            <span class="h3 truncate">{{ item.name }}</span>
                            <span class="caption muted">{{ meta(item, 'superset') }}</span>
                          </span>
                        } @else {
                          <span class="muted body grow">Choisir un exercice</span>
                        }
                      </button>
                    }
                  </div>
                }
                <button type="button" class="add" (click)="addPair()">
                  <tw-icon name="plus" [size]="16" [strokeWidth]="2" />
                  Ajouter une paire
                </button>
              </div>
            }
          </section>
        </div>

        <div class="col">
          <section class="card card-pad">
            <span class="h2">Résumé</span>
            <div class="summary">
              <div class="stat"><span class="caption muted">Exercices</span><span class="value num">{{ count() }}</span></div>
              <div class="stat"><span class="caption muted">Durée</span><span class="value num">{{ duration() }} min</span></div>
            </div>
            <p class="caption muted mt-sm">
              Les charges se réajustent athlète par athlète au moment d'assigner la séance.
            </p>
          </section>
        </div>
      </div>

      @if (picker()) {
        <div class="scrim" (click)="picker.set(null)">
          <div class="modal card" (click)="$event.stopPropagation()">
            <div class="spread">
              <span class="h2">Choisir un exercice</span>
              <button class="icon-btn" type="button" (click)="picker.set(null)" aria-label="Fermer">
                <tw-icon name="close" [size]="18" />
              </button>
            </div>
            <div class="search mt">
              <tw-icon name="search" [size]="16" />
              <input placeholder="Rechercher…" [value]="exerciseSearch()" (input)="exerciseSearch.set(value($event))" />
            </div>
            <div class="picker-list scroll-y">
              @for (exercise of pickable(); track exercise._id) {
                <button type="button" class="pick" (click)="choose(exercise)">
                  <span class="tile"><tw-icon name="dumbbell" [size]="16" /></span>
                  <span class="stack min grow">
                    <span class="h3 truncate">{{ exercise.name }}</span>
                    <span class="caption muted">{{ muscleLabel(exercise.primaryMuscle) }}</span>
                  </span>
                </button>
              } @empty {
                <tw-state kind="empty" icon="dumbbell" message="Aucun exercice." />
              }
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

      .actions {
        display: flex;
        gap: 10px;
      }

      .err {
        color: var(--danger);
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
        gap: 16px;
        min-width: 0;
      }

      .info-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr);
        gap: 12px;
      }

      .table {
        display: grid;
        grid-template-columns: minmax(0, 2fr) 70px 90px 100px 100px 44px;
        column-gap: 10px;
        align-items: center;
        margin-top: 16px;
      }

      .cell {
        height: 52px;
        display: flex;
        align-items: center;
        border-top: 1px solid var(--border);
      }

      .cell.name {
        gap: 10px;
        min-width: 0;
      }

      .cell.end {
        justify-content: flex-end;
      }

      .tile {
        width: 32px;
        height: 32px;
        border-radius: var(--r-sm);
        background: var(--subtle);
        color: var(--brand);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .mini {
        width: 100%;
        height: 36px;
        border-radius: var(--r-sm);
        border: 1px solid var(--border);
        background: var(--surface);
        padding: 0 10px;
        outline: none;
      }

      .mini.wide {
        width: 200px;
      }

      .mini:focus {
        border-color: var(--accent);
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
        color: var(--danger);
      }

      .block-title {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .stepper {
        display: flex;
        align-items: center;
        gap: 2px;
        background: var(--subtle);
        border-radius: var(--r-sm);
        padding: 2px;
      }

      .stepper button {
        width: 26px;
        height: 26px;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
      }

      .stepper .num {
        min-width: 42px;
        text-align: center;
        font-size: 13px;
        font-weight: 600;
      }

      .loop {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 16px;
        padding: 14px;
        border-radius: 14px;
        background: var(--bg);
      }

      .loop-item {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px;
        border-radius: var(--r-md);
        background: var(--surface);
        border: 1px solid var(--border);
      }

      .loop-head {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
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

      .loop-fields {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }

      .pairs {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 16px;
      }

      .pair {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .slot-box {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: var(--r-md);
        border: 1px solid var(--border);
        background: var(--surface);
        text-align: left;
        min-width: 0;
      }

      .slot-box:hover {
        border-color: var(--accent);
      }

      .slot {
        width: 26px;
        height: 26px;
        border-radius: var(--r-sm);
        background: var(--violet-soft);
        color: var(--violet-ink);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        flex-shrink: 0;
      }

      .add {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 38px;
        border-radius: var(--r-md);
        border: 1px dashed var(--border-strong);
        color: var(--text2);
        font-size: 13px;
        font-weight: 600;
      }

      .summary {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 14px;
      }

      .stat {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .stat .value {
        font-size: 20px;
        line-height: 28px;
        font-weight: 600;
      }

      .mt {
        margin-top: 14px;
      }

      .mt-sm {
        display: block;
        margin-top: 12px;
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

      .search {
        display: flex;
        align-items: center;
        gap: 8px;
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

      .picker-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-top: 12px;
        max-height: 340px;
      }

      .pick {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border-radius: var(--r-md);
        text-align: left;
      }

      .pick:hover {
        background: var(--bg);
      }
    `,
  ],
})
export class CoachStrengthEditorPage {
  private readonly coach = inject(CoachService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly id = input<string | undefined>(undefined);

  readonly types = STRENGTH_TYPES;
  readonly slots: ('a' | 'b')[] = ['a', 'b'];

  readonly existing = load<ApiSessionTemplate | null>(() => {
    const id = this.id();
    return id ? this.coach.template$(id) : of(null);
  });
  readonly exercises = load(() => this.coach.exercises$());

  readonly name = signal('');
  readonly description = signal('');
  /** Ce que l'athlète devrait ressentir en rentrant, sur 10. */
  readonly expectedFeeling = signal<number | null>(null);
  readonly sessionType = signal('full_body');
  readonly duration = signal(50);
  readonly plan = signal<EditableStrengthPlan>(emptyStrengthPlan());
  readonly saving = signal(false);
  readonly error = signal('');

  readonly picker = signal<{ slot: ExerciseSlot; pairKey?: string; side?: 'a' | 'b' } | null>(null);
  readonly exerciseSearch = signal('');

  readonly count = computed(() => strengthExerciseCount(this.plan()));

  readonly pickable = computed(() => {
    const term = this.exerciseSearch().trim().toLowerCase();
    const all = this.exercises.data() ?? [];
    return (term ? all.filter((exercise) => exercise.name.toLowerCase().includes(term)) : all).slice(0, 60);
  });

  constructor() {
    effect(() => {
      const template = this.existing.data();
      if (!template) return;
      this.name.set(template.name);
      this.description.set(template.description ?? '');
      this.expectedFeeling.set(template.expectedFeeling ?? null);
      this.sessionType.set(template.sessionType);
      if (template.targetDuration) this.duration.set(template.targetDuration);
      this.plan.set(toEditableStrength(template.strengthPlan));
    });
  }

  label(type: string) {
    return SESSION_TYPE_LABELS[type] ?? type;
  }

  muscleLabel(value?: string) {
    return value ? (MUSCLE_LABELS[value] ?? value) : 'Renforcement';
  }

  meta(item: EditableExercise, slot: ExerciseSlot) {
    return exerciseMeta(item, slot);
  }

  // ---- Exercices simples ----

  patch(key: string, changes: Partial<EditableExercise>) {
    this.plan.update((plan) => ({
      ...plan,
      exercises: plan.exercises.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    }));
  }

  removeExercise(key: string) {
    this.plan.update((plan) => ({ ...plan, exercises: plan.exercises.filter((item) => item.key !== key) }));
  }

  // ---- Circuit ----

  addCircuit() {
    this.plan.update((plan) => ({ ...plan, circuit: newCircuit() }));
  }

  removeCircuit() {
    this.plan.update((plan) => ({ ...plan, circuit: null }));
  }

  patchCircuit(changes: Partial<{ name: string; rounds: number; restSec: number }>) {
    this.plan.update((plan) =>
      plan.circuit
        ? {
            ...plan,
            circuit: {
              ...plan.circuit,
              ...changes,
              rounds: Math.max(1, changes.rounds ?? plan.circuit.rounds),
              restSec: Math.max(0, changes.restSec ?? plan.circuit.restSec),
            },
          }
        : plan,
    );
  }

  patchCircuitExercise(key: string, changes: Partial<EditableExercise>) {
    this.plan.update((plan) =>
      plan.circuit
        ? { ...plan, circuit: { ...plan.circuit, exercises: plan.circuit.exercises.map((item) => (item.key === key ? { ...item, ...changes } : item)) } }
        : plan,
    );
  }

  removeFromCircuit(key: string) {
    this.plan.update((plan) =>
      plan.circuit ? { ...plan, circuit: { ...plan.circuit, exercises: plan.circuit.exercises.filter((item) => item.key !== key) } } : plan,
    );
  }

  // ---- Super-set ----

  addSuperset() {
    this.plan.update((plan) => ({ ...plan, superset: newSuperset() }));
  }

  removeSuperset() {
    this.plan.update((plan) => ({ ...plan, superset: null }));
  }

  patchSuperset(changes: Partial<{ name: string; sets: number; restSec: number }>) {
    this.plan.update((plan) =>
      plan.superset ? { ...plan, superset: { ...plan.superset, ...changes, sets: Math.max(1, changes.sets ?? plan.superset.sets) } } : plan,
    );
  }

  addPair() {
    this.plan.update((plan) => (plan.superset ? { ...plan, superset: { ...plan.superset, pairs: [...plan.superset.pairs, newPair()] } } : plan));
  }

  // ---- Choix d'exercice ----

  openPicker(slot: ExerciseSlot, pairKey?: string, side?: 'a' | 'b') {
    this.exerciseSearch.set('');
    this.picker.set({ slot, pairKey, side });
  }

  choose(exercise: ApiExercise) {
    const target = this.picker();
    if (!target) return;
    const ref: ApiExerciseRef = { _id: exercise._id, name: exercise.name, primaryMuscle: exercise.primaryMuscle };
    const item = exerciseFromLibrary(ref, target.slot);

    this.plan.update((plan) => {
      if (target.slot === 'single') return { ...plan, exercises: [...plan.exercises, item] };
      if (target.slot === 'circuit') {
        const circuit = plan.circuit ?? newCircuit();
        return { ...plan, circuit: { ...circuit, exercises: [...circuit.exercises, item] } };
      }
      if (!plan.superset || !target.pairKey || !target.side) return plan;
      return {
        ...plan,
        superset: {
          ...plan.superset,
          pairs: plan.superset.pairs.map((pair) => (pair.key === target.pairKey ? { ...pair, [target.side!]: item } : pair)),
        },
      };
    });
    this.picker.set(null);
  }

  save() {
    if (this.saving()) return;
    if (!this.name().trim()) {
      this.error.set('Donnez un nom à la séance.');
      return;
    }
    const invalid = validateStrength(this.plan());
    if (invalid) {
      this.error.set(invalid);
      return;
    }
    this.error.set('');
    this.saving.set(true);
    this.coach
      .saveTemplate(this.id() ?? null, {
        name: this.name().trim(),
        description: this.description().trim(),
        expectedFeeling: this.expectedFeeling(),
        sport: 'strength',
        sessionType: this.sessionType(),
        targetDistance: null,
        targetDuration: this.duration(),
        runBlocks: [],
        strengthPlan: toStrengthPayload(this.plan(), this.duration()),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          void this.router.navigate(['/coach/bibliotheque']);
        },
        error: () => {
          this.saving.set(false);
          this.error.set("La séance n'a pas pu être enregistrée.");
        },
      });
  }

  goBack() {
    if (history.length > 1) this.location.back();
    else void this.router.navigate(['/coach/bibliotheque']);
  }

  value(event: Event) {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  text(event: Event) {
    return (event.target as HTMLTextAreaElement).value;
  }

  number(event: Event) {
    const raw = (event.target as HTMLInputElement).value.replace(',', '.');
    const parsed = Number(raw);
    return raw === '' || !Number.isFinite(parsed) ? null : parsed;
  }
}
