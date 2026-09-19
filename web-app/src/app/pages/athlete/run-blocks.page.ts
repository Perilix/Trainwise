import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

import { formatDecimal } from '../../core/format';
import { load } from '../../core/load';
import { AuthService } from '../../core/auth.service';
import { AthleteService } from '../../data/athlete.service';
import {
  ROLE_LABELS,
  insertMain,
  isGroup,
  newChild,
  newCooldown,
  newRepeat,
  newStep,
  newWarmup,
  toEditable,
  toPayload,
  validateBlocks,
  withFixedPace,
  type EditableBlock,
  type EditableStep,
} from '../../domain/run-blocks-model';
import { blocksToSegments } from '../../domain/run-blocks';
import { totals } from '../../domain/sessions';
import { IconComponent } from '../../ui/icon.component';
import { StateViewComponent } from '../../ui/state-view.component';
import { WorkoutProfileComponent } from '../../ui/workout-profile.component';

/**
 * Déroulé réalisé d'une sortie : l'athlète décrit ce qu'il a vraiment fait, en partant
 * des tours reconstruits par Strava quand il y en a. Même modèle de blocs que l'éditeur
 * du coach, mais sans zone de VMA : après coup, c'est l'allure tenue qui compte.
 */
@Component({
  selector: 'tw-run-blocks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, StateViewComponent, WorkoutProfileComponent],
  template: `
    <main class="page">
      @if (draft.loading()) {
        <tw-state kind="loading" />
      } @else if (draft.error()) {
        <tw-state kind="error" [message]="draft.error()">
          <button class="btn btn-ghost btn-sm" (click)="draft.reload()">Réessayer</button>
        </tw-state>
      } @else if (draft.data(); as data) {
        <button type="button" class="back" (click)="goBack()">
          <tw-icon name="chevron-left" [size]="16" />
          <span class="small">La sortie</span>
        </button>

        <div class="head">
          <div class="stack">
            <span class="small muted">{{ data.title }}</span>
            <h1 class="display">Déroulé réalisé</h1>
          </div>
          <div class="head-actions">
            <button class="btn btn-ghost" type="button" (click)="reset()">Repartir des tours</button>
            <button class="btn btn-primary" type="button" [disabled]="saving()" (click)="save()">
              <tw-icon name="check" [size]="18" [strokeWidth]="2" />
              {{ saving() ? 'Enregistrement…' : 'Enregistrer le déroulé' }}
            </button>
          </div>
        </div>

        <p class="body muted intro">
          {{
            data.auto
              ? 'Ces blocs viennent des tours enregistrés par ta montre. Corrige-les pour que ton coach voie ce que tu as vraiment fait.'
              : 'Décris ta séance bloc par bloc : échauffement, corps de séance, retour au calme.'
          }}
        </p>

        <div class="cols">
          <div class="col">
            @for (block of blocks(); track block.key) {
              <section class="card block">
                <div class="block-head">
                  <span class="chip">{{ isGroup(block) ? 'Répéter' : label(block.role) }}</span>
                  <span class="grow"></span>
                  <button class="sq sm" type="button" aria-label="Supprimer" (click)="removeBlock(block.key)">
                    <tw-icon name="trash" [size]="16" />
                  </button>
                </div>

                @if (isGroup(block)) {
                  <div class="reps">
                    <label [for]="'reps-' + block.key">Répétitions</label>
                    <input
                      [id]="'reps-' + block.key"
                      class="input short"
                      inputmode="numeric"
                      [value]="block.repetitions ?? 1"
                      (input)="patchBlock(block.key, { repetitions: int($event) })"
                    />
                  </div>
                  @for (child of block.children ?? []; track child.key) {
                    <div class="step">
                      <div class="row">
                        <div class="field">
                          <label [for]="'mode-' + child.key">Mesure</label>
                          <select [id]="'mode-' + child.key" class="input" [value]="child.mode" (change)="patchChild(block.key, child.key, { mode: mode($event) })">
                            <option value="distance">Distance</option>
                            <option value="duration">Durée</option>
                          </select>
                        </div>
                        <div class="field">
                          <label [for]="'val-' + child.key">{{ child.mode === 'duration' ? 'Minutes' : 'Kilomètres' }}</label>
                          <input
                            [id]="'val-' + child.key"
                            class="input"
                            inputmode="decimal"
                            [value]="value(child)"
                            (input)="patchChild(block.key, child.key, child.mode === 'duration' ? { duration: num($event) } : { distance: num($event) })"
                          />
                        </div>
                        <div class="field">
                          <label [for]="'pace-' + child.key">Allure tenue</label>
                          <input
                            [id]="'pace-' + child.key"
                            class="input"
                            placeholder="4:30"
                            [value]="child.pace ?? ''"
                            (input)="patchChildPace(block.key, child.key, text($event))"
                          />
                        </div>
                      </div>
                      <div class="row">
                        <div class="field">
                          <label [for]="'rec-' + child.key">Récupération</label>
                          <input
                            [id]="'rec-' + child.key"
                            class="input"
                            placeholder="1min30"
                            [value]="child.recoveryDuration ?? ''"
                            (input)="patchChild(block.key, child.key, { recoveryMode: 'duration', recoveryDuration: text($event) })"
                          />
                        </div>
                        <div class="field grow">
                          <label [for]="'desc-' + child.key">Note</label>
                          <input [id]="'desc-' + child.key" class="input" [value]="child.description ?? ''" (input)="patchChild(block.key, child.key, { description: text($event) })" />
                        </div>
                      </div>
                    </div>
                  }
                  <button class="btn btn-ghost btn-sm" type="button" (click)="addChild(block.key)">
                    <tw-icon name="plus" [size]="16" [strokeWidth]="2" />
                    Ajouter une répétition
                  </button>
                } @else {
                  <div class="row">
                    <div class="field">
                      <label [for]="'mode-' + block.key">Mesure</label>
                      <select [id]="'mode-' + block.key" class="input" [value]="block.mode" (change)="patchBlock(block.key, { mode: mode($event) })">
                        <option value="distance">Distance</option>
                        <option value="duration">Durée</option>
                      </select>
                    </div>
                    <div class="field">
                      <label [for]="'val-' + block.key">{{ block.mode === 'duration' ? 'Minutes' : 'Kilomètres' }}</label>
                      <input
                        [id]="'val-' + block.key"
                        class="input"
                        inputmode="decimal"
                        [value]="value(block)"
                        (input)="patchBlock(block.key, block.mode === 'duration' ? { duration: num($event) } : { distance: num($event) })"
                      />
                    </div>
                    <div class="field">
                      <label [for]="'pace-' + block.key">Allure tenue</label>
                      <input [id]="'pace-' + block.key" class="input" placeholder="5:10" [value]="block.pace ?? ''" (input)="patchBlockPace(block.key, text($event))" />
                    </div>
                  </div>
                  <div class="field">
                    <label [for]="'desc-' + block.key">Note</label>
                    <input [id]="'desc-' + block.key" class="input" [value]="block.description ?? ''" (input)="patchBlock(block.key, { description: text($event) })" />
                  </div>
                }
              </section>
            }

            <div class="adders">
              <button class="btn btn-ghost btn-sm" type="button" (click)="addWarmup()">Échauffement</button>
              <button class="btn btn-ghost btn-sm" type="button" (click)="addStep()">Étape</button>
              <button class="btn btn-ghost btn-sm" type="button" (click)="addRepeat()">Bloc à répéter</button>
              <button class="btn btn-ghost btn-sm" type="button" (click)="addCooldown()">Retour au calme</button>
            </div>

            @if (problem()) {
              <p class="err small">{{ problem() }}</p>
            }
          </div>

          <aside class="col">
            <section class="card card-pad">
              <span class="h2">Aperçu</span>
              <p class="small muted mt-xs">{{ summary() }}</p>
              <tw-workout-profile [segments]="segments()" [height]="90" />
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
        gap: 18px;
      }

      .back {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--text2);
        font-weight: 500;
      }

      .head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
      }

      .head-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .stack {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .intro {
        margin: -8px 0 0;
        max-width: 640px;
      }

      .cols {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
        gap: 20px;
        align-items: start;
      }

      .col {
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-width: 0;
      }

      .block {
        padding: 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .block-head {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .sq.sm {
        width: 32px;
        height: 32px;
        border-radius: var(--r-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text2);
      }

      .sq.sm:hover {
        background: var(--subtle);
        color: var(--danger);
      }

      .row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .step {
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .reps {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: var(--text2);
      }

      .input.short {
        width: 90px;
      }

      .adders {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .err {
        color: var(--danger);
        margin: 0;
      }

      .mt-xs {
        margin: 4px 0 12px;
      }
    `,
  ],
})
export class AthleteRunBlocksPage {
  private readonly athlete = inject(AthleteService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly id = input.required<string>();

  readonly draft = load(() => this.athlete.runBlocksDraft$(this.id()));

  private readonly edited = signal<EditableBlock[] | null>(null);
  readonly saving = signal(false);
  readonly problem = signal('');

  readonly isGroup = isGroup;

  readonly blocks = computed(() => {
    const local = this.edited();
    if (local) return local;
    const data = this.draft.data();
    return data ? toEditable(data.blocks) : [];
  });

  readonly segments = computed(() => blocksToSegments(toPayload(this.blocks()), this.auth.user()?.vma ?? undefined));

  readonly summary = computed(() => {
    const total = totals(this.segments());
    return `${formatDecimal(total.dist / 1000, 1)} km · ${Math.round(total.sec / 60)} min`;
  });

  label(role: EditableStep['role']) {
    return ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? 'Étape';
  }

  value(step: EditableStep) {
    return (step.mode === 'duration' ? step.duration : step.distance) ?? '';
  }

  // ---- Édition ----

  private update(blocks: EditableBlock[]) {
    this.problem.set('');
    this.edited.set(blocks);
  }

  patchBlock(key: string, patch: Partial<EditableBlock>) {
    this.update(this.blocks().map((block) => (block.key === key ? { ...block, ...patch } : block)));
  }

  patchBlockPace(key: string, pace: string) {
    this.update(this.blocks().map((block) => (block.key === key ? withFixedPace(block, pace) : block)));
  }

  patchChild(blockKey: string, childKey: string, patch: Partial<EditableStep>) {
    this.update(
      this.blocks().map((block) =>
        block.key === blockKey ? { ...block, children: (block.children ?? []).map((child) => (child.key === childKey ? { ...child, ...patch } : child)) } : block,
      ),
    );
  }

  patchChildPace(blockKey: string, childKey: string, pace: string) {
    this.update(
      this.blocks().map((block) =>
        block.key === blockKey ? { ...block, children: (block.children ?? []).map((child) => (child.key === childKey ? withFixedPace(child, pace) : child)) } : block,
      ),
    );
  }

  addChild(blockKey: string) {
    this.update(this.blocks().map((block) => (block.key === blockKey ? { ...block, children: [...(block.children ?? []), newChild(true)] } : block)));
  }

  removeBlock(key: string) {
    this.update(this.blocks().filter((block) => block.key !== key));
  }

  addWarmup() {
    this.update([newWarmup(true), ...this.blocks()]);
  }

  addStep() {
    this.update(insertMain(this.blocks(), newStep(true)));
  }

  addRepeat() {
    this.update(insertMain(this.blocks(), newRepeat(true)));
  }

  addCooldown() {
    this.update([...this.blocks(), newCooldown(true)]);
  }

  /** Revient aux tours reconstruits par la montre. */
  reset() {
    this.problem.set('');
    this.edited.set(null);
  }

  save() {
    if (this.saving()) return;
    const blocks = this.blocks();
    const invalid = validateBlocks(blocks);
    if (invalid) {
      this.problem.set(invalid);
      return;
    }
    this.saving.set(true);
    this.athlete.saveRunBlocks(this.id(), toPayload(blocks, this.auth.user()?.vma ?? undefined)).subscribe({
      next: () => {
        this.saving.set(false);
        this.goBack();
      },
      error: () => {
        this.saving.set(false);
        this.problem.set('Enregistrement impossible.');
      },
    });
  }

  // ---- Petits accesseurs de formulaire ----

  text(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  num(event: Event) {
    const value = Number((event.target as HTMLInputElement).value.replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  int(event: Event) {
    const value = Number.parseInt((event.target as HTMLInputElement).value, 10);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  mode(event: Event) {
    return (event.target as HTMLSelectElement).value as 'distance' | 'duration';
  }

  goBack() {
    if (history.length > 1) this.location.back();
    else void this.router.navigate(['/sorties', this.id()]);
  }
}
