import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Location, NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import type { ApiSessionTemplate } from '../../core/api-types';
import { formatDecimal, formatHoursMinutes, formatPace } from '../../core/format';
import { load } from '../../core/load';
import { CoachService } from '../../data/coach.service';
import { SESSION_TYPE_LABELS } from '../../domain/athlete.mappers';
import { blocksToSegments } from '../../domain/run-blocks';
import {
  ROLE_LABELS,
  ZONE_CHOICES,
  insertMain,
  isGroup,
  newCooldown,
  newRepeat,
  newStep,
  newWarmup,
  paceFromPercent,
  paceMode,
  recoveryLabel,
  stepPercent,
  stepTargetLabel,
  stepValueLabel,
  toEditable,
  toPayload,
  validateBlocks,
  withFixedPace,
  withPercent,
  withZone,
  type EditableBlock,
  type EditableStep,
} from '../../domain/run-blocks-model';
import { paceFor, totals } from '../../domain/sessions';
import { templateRunBlocks, toTemplateBlocks } from '../../domain/templates';
import { AvatarComponent } from '../../ui/avatar.component';
import { IconComponent } from '../../ui/icon.component';
import { IntensityLegendComponent } from '../../ui/intensity-legend.component';
import { StateViewComponent } from '../../ui/state-view.component';
import { WorkoutProfileComponent } from '../../ui/workout-profile.component';

const RUNNING_TYPES = ['endurance', 'fractionne', 'tempo', 'sortie_longue', 'recuperation', 'cotes', 'fartlek'];

/** Éditeur de séance type : blocs de course, allures en zone de VMA, aperçu par athlète. */
@Component({
  selector: 'tw-session-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, IntensityLegendComponent, NgTemplateOutlet, StateViewComponent, WorkoutProfileComponent],
  template: `
    <main class="page">
      <button type="button" class="back" (click)="goBack()">
        <tw-icon name="chevron-left" [size]="16" />
        <span class="small">Bibliothèque</span>
      </button>

      <div class="title-line">
        <div class="stack min">
          <h1 class="display">{{ id() ? 'Modifier la séance' : 'Nouvelle séance' }}</h1>
          <p class="body muted">Définissez une séance réutilisable, avec des allures basées sur la VMA de chaque athlète.</p>
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
            <span class="h2">Informations</span>
            <div class="info-grid">
              <div class="field">
                <label for="name">Nom *</label>
                <input id="name" class="input" [value]="name()" (input)="name.set(value($event))" />
              </div>
              <div class="field">
                <label>Sport</label>
                <div class="segmented">
                  <button type="button" class="seg" [class.on]="sport() === 'running'" (click)="sport.set('running')">Course</button>
                  <button type="button" class="seg" [class.on]="sport() === 'strength'" (click)="sport.set('strength')">Muscu</button>
                </div>
              </div>
              <div class="field">
                <label for="type">Type de séance</label>
                <select id="type" class="input" [value]="sessionType()" (change)="sessionType.set(value($event))">
                  @for (option of typeOptions(); track option) {
                    <option [value]="option">{{ label(option) }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="field mt">
              <label for="desc">Description</label>
              <textarea id="desc" class="input" rows="2" [value]="description()" (input)="description.set(text($event))"></textarea>
            </div>
          </section>

          @if (sport() === 'running') {
            <section class="card card-pad">
              <div class="spread">
                <span class="h2">Blocs de course</span>
                <div class="totals">
                  <span class="h3">Total ≈ {{ estimate().distance }}</span>
                  <span class="muted-3">·</span>
                  <span class="h3">≈ {{ estimate().duration }}</span>
                </div>
              </div>

              @if (segments().length) {
                <div class="profile">
                  <tw-workout-profile [segments]="segments()" [width]="620" [height]="60" />
                </div>
              }

              <div class="blocks">
                @for (block of blocks(); track block.key; let index = $index) {
                  @if (isGroup(block)) {
                    <div class="group">
                      <div class="group-head">
                        <tw-icon name="repeat" [size]="18" />
                        <span class="h2">Bloc à répéter</span>
                        <div class="stepper">
                          <button type="button" (click)="setReps(block.key, (block.repetitions ?? 1) - 1)" aria-label="Moins">−</button>
                          <span class="num">{{ block.repetitions }} ×</span>
                          <button type="button" (click)="setReps(block.key, (block.repetitions ?? 1) + 1)" aria-label="Plus">+</button>
                        </div>
                        <span class="grow"></span>
                        <button class="icon-btn" type="button" (click)="removeBlock(index)" aria-label="Supprimer le bloc">
                          <tw-icon name="trash" [size]="18" />
                        </button>
                      </div>

                      @for (child of block.children ?? []; track child.key) {
                        <div class="step-card">
                          <div class="step-head">
                            <span class="swatch" [style.background]="shade(child)"></span>
                            <span class="h3">Étape · {{ stepValue(child) }}</span>
                            <span class="grow"></span>
                            <button class="icon-btn" type="button" (click)="removeChild(block.key, child.key)" aria-label="Supprimer l'étape">
                              <tw-icon name="trash" [size]="16" />
                            </button>
                          </div>
                          <ng-container *ngTemplateOutlet="stepForm; context: { $implicit: child, parent: block.key }" />
                        </div>
                      }

                      <button type="button" class="add" (click)="addChild(block.key)">
                        <tw-icon name="plus" [size]="16" [strokeWidth]="2" />
                        Étape dans le groupe
                      </button>
                    </div>
                  } @else {
                    <div class="step-card">
                      <div class="step-head">
                        <span class="swatch" [style.background]="shade(block)"></span>
                        <div class="stack grow">
                          <span class="h3">{{ roleLabel(block) }} · {{ stepValue(block) }}</span>
                          <span class="small muted">{{ target(block) }}</span>
                        </div>
                        <button class="icon-btn" type="button" (click)="removeBlock(index)" aria-label="Supprimer">
                          <tw-icon name="trash" [size]="18" />
                        </button>
                      </div>
                      <ng-container *ngTemplateOutlet="stepForm; context: { $implicit: block, parent: null }" />
                    </div>
                  }
                }
              </div>

              <div class="add-row">
                <button class="btn btn-ghost btn-sm" type="button" (click)="addStep()">
                  <tw-icon name="plus" [size]="16" [strokeWidth]="2" />
                  Étape
                </button>
                <button class="btn btn-ghost btn-sm" type="button" (click)="addRepeat()">
                  <tw-icon name="repeat" [size]="16" [strokeWidth]="2" />
                  Bloc à répéter
                </button>
                @if (!hasWarmup()) {
                  <button class="btn btn-ghost btn-sm" type="button" (click)="addWarmup()">Échauffement</button>
                }
                @if (!hasCooldown()) {
                  <button class="btn btn-ghost btn-sm" type="button" (click)="addCooldown()">Retour au calme</button>
                }
              </div>
            </section>
          } @else {
            <section class="card card-pad">
              <tw-state
                kind="empty"
                icon="dumbbell"
                message="Les séances de renforcement s'éditent depuis l'éditeur muscu."
              >
                <button class="btn btn-ghost btn-sm" type="button" (click)="openStrengthEditor()">Ouvrir l'éditeur muscu</button>
              </tw-state>
            </section>
          }
        </div>

        <div class="col">
          <section class="card card-pad">
            <span class="h2">Aperçu pour VMA</span>
            <div class="vma-row">
              <div class="stepper">
                <button type="button" (click)="vma.set(round1(vma() - 0.5))" aria-label="Moins">−</button>
                <span class="num">{{ dec(vma()) }}</span>
                <button type="button" (click)="vma.set(round1(vma() + 0.5))" aria-label="Plus">+</button>
              </div>
              <span class="small muted">km/h</span>
            </div>

            <div class="preview">
              @for (row of preview(); track row.label) {
                <div class="p-row">
                  <span class="grow body muted">{{ row.label }}</span>
                  <div class="p-values">
                    <span class="h3 num">{{ row.pace }}</span>
                    <span class="caption muted num">{{ row.detail }}</span>
                  </div>
                </div>
              }
            </div>

            <div class="p-totals">
              <div class="stat"><span class="caption muted">Distance</span><span class="value num">≈ {{ estimate().distance }}</span></div>
              <div class="stat"><span class="caption muted">Durée</span><span class="value num">≈ {{ estimate().duration }}</span></div>
            </div>
          </section>

          @if (mainStep(); as main) {
            <section class="card card-pad">
              <span class="h2">{{ stepValue(main) }} pour vos athlètes</span>
              <div class="athletes">
                @for (athlete of athletePaces(); track athlete.id) {
                  <div class="a-row">
                    <tw-avatar [initials]="athlete.initials" tone="accent" [size]="28" />
                    <span class="grow truncate body">{{ athlete.name }}</span>
                    <span class="small muted num">{{ athlete.vma }}</span>
                    <span class="h3 num">{{ athlete.value }}</span>
                  </div>
                }
              </div>
            </section>
          }

          <section class="card card-pad">
            <span class="h2">Intensité</span>
            <div class="mt">
              <tw-intensity-legend />
            </div>
            <span class="caption muted mt-sm">Hauteur des barres = % VMA, largeur = durée.</span>
          </section>
        </div>
      </div>
    </main>

    <ng-template #stepForm let-step let-parent="parent">
      <div class="form-grid">
        <div class="field">
          <label>Mode</label>
          <div class="segmented small-seg">
            <button type="button" class="seg" [class.on]="step.mode === 'distance'" (click)="patch(step.key, parent, { mode: 'distance' })">Distance</button>
            <button type="button" class="seg" [class.on]="step.mode === 'duration'" (click)="patch(step.key, parent, { mode: 'duration' })">Durée</button>
          </div>
        </div>
        @if (step.mode === 'distance') {
          <div class="field">
            <label>Distance (m)</label>
            <input class="input" inputmode="numeric" [value]="metersOf(step)" (input)="setMeters(step.key, parent, $event)" />
          </div>
        } @else {
          <div class="field">
            <label>Durée (min)</label>
            <input class="input" inputmode="numeric" [value]="step.duration ?? ''" (input)="patch(step.key, parent, { duration: number($event) })" />
          </div>
        }
        <div class="field">
          <label>Description</label>
          <input class="input" [value]="step.description ?? ''" (input)="patch(step.key, parent, { description: value($event) })" />
        </div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label>Allure</label>
          <div class="segmented small-seg">
            <button type="button" class="seg" [class.on]="mode(step) === 'zone'" (click)="setZone(step.key, parent, 'endurance')">Zone VMA</button>
            <button type="button" class="seg" [class.on]="mode(step) === 'fixed'" (click)="setFixed(step.key, parent, step.pace ?? '')">Allure fixe</button>
          </div>
        </div>
        @if (mode(step) === 'zone') {
          <div class="field">
            <label>Zone</label>
            <select class="input" [value]="step.paceSource?.zone ?? 'endurance'" (change)="setZone(step.key, parent, value($event))">
              @for (zone of zones; track zone[0]) {
                <option [value]="zone[0]">{{ zone[1] }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>% VMA — {{ percent(step) }} %</label>
            <input class="slider" type="range" min="40" max="130" [value]="percent(step)" (input)="setPercent(step.key, parent, $event)" />
          </div>
        } @else {
          <div class="field">
            <label>Allure fixe (min:s)</label>
            <input class="input" placeholder="4:30" [value]="step.pace ?? ''" (input)="setFixed(step.key, parent, value($event))" />
          </div>
        }
      </div>

      @if (mode(step) === 'zone' && paceAt(step); as pace) {
        <div class="hint">
          <tw-icon name="info" [size]="16" />
          <span class="small">Allure athlète (VMA {{ dec(vma()) }}) : <b>{{ pace }} /km</b></span>
        </div>
      }

      <div class="recovery">
        <div class="spread">
          <div class="rec-title">
            <tw-icon name="clock" [size]="16" />
            <span class="h3">Récupération</span>
          </div>
          @if (step.recoveryMode) {
            <button type="button" class="remove" (click)="patch(step.key, parent, { recoveryMode: null })">Retirer</button>
          } @else {
            <button type="button" class="link-btn" (click)="patch(step.key, parent, { recoveryMode: 'duration', recoveryDuration: '1min30' })">Ajouter</button>
          }
        </div>
        @if (step.recoveryMode) {
          <div class="form-grid">
            <div class="field">
              <label>Mode</label>
              <div class="segmented small-seg">
                <button type="button" class="seg" [class.on]="step.recoveryMode === 'distance'" (click)="patch(step.key, parent, { recoveryMode: 'distance' })">Distance</button>
                <button type="button" class="seg" [class.on]="step.recoveryMode === 'duration'" (click)="patch(step.key, parent, { recoveryMode: 'duration' })">Durée</button>
              </div>
            </div>
            @if (step.recoveryMode === 'duration') {
              <div class="field">
                <label>Durée</label>
                <input class="input" placeholder="1min30" [value]="step.recoveryDuration ?? ''" (input)="patch(step.key, parent, { recoveryDuration: value($event) })" />
              </div>
            } @else {
              <div class="field">
                <label>Distance (m)</label>
                <input class="input" inputmode="numeric" [value]="recMeters(step)" (input)="setRecMeters(step.key, parent, $event)" />
              </div>
            }
            <div class="field">
              <label>Description récup</label>
              <input class="input" [value]="step.recoveryDescription ?? ''" (input)="patch(step.key, parent, { recoveryDescription: value($event) })" />
            </div>
          </div>
        }
      </div>
    </ng-template>
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
        flex-shrink: 0;
      }

      .err {
        color: var(--danger);
      }

      .cols {
        display: grid;
        grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
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
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr);
        gap: 12px;
        margin-top: 14px;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-top: 12px;
      }

      .segmented {
        display: flex;
        padding: 3px;
        border-radius: var(--r-md);
        background: var(--subtle);
        gap: 2px;
      }

      .seg {
        flex: 1;
        height: 36px;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 500;
        color: var(--text2);
      }

      .small-seg .seg {
        height: 32px;
      }

      .seg.on {
        background: var(--surface);
        color: var(--ink);
        font-weight: 600;
      }

      .totals {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .profile {
        margin: 14px 0;
      }

      .blocks {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 14px;
      }

      .group {
        border: 1px solid var(--accent);
        border-radius: var(--r-md);
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .group-head {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--accent-ink);
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
        width: 28px;
        height: 28px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        color: var(--ink);
      }

      .stepper button:hover {
        background: var(--surface);
      }

      .stepper .num {
        min-width: 46px;
        text-align: center;
        font-size: 13px;
        font-weight: 600;
      }

      .step-card {
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        padding: 14px;
        background: var(--surface);
      }

      .step-head {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .swatch {
        width: 6px;
        height: 28px;
        border-radius: 3px;
        flex-shrink: 0;
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

      .add-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 14px;
        flex-wrap: wrap;
      }

      .hint {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
        padding: 10px 12px;
        border-radius: var(--r-md);
        background: var(--accent-soft);
        color: var(--accent-ink);
      }

      .recovery {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid var(--border);
      }

      .rec-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .remove {
        font-size: 13px;
        font-weight: 500;
        color: var(--danger);
      }

      .link-btn {
        font-size: 13px;
        font-weight: 500;
        color: var(--accent-ink);
      }

      .slider {
        width: 100%;
        accent-color: var(--accent);
      }

      .vma-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 12px;
      }

      .preview {
        display: flex;
        flex-direction: column;
        margin-top: 12px;
      }

      .p-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 0;
      }

      .p-row + .p-row {
        border-top: 1px solid var(--border);
      }

      .p-values {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }

      .p-totals {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid var(--border);
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

      .athletes {
        display: flex;
        flex-direction: column;
        margin-top: 8px;
      }

      .a-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 0;
      }

      .a-row + .a-row {
        border-top: 1px solid var(--border);
      }

      .mt {
        margin-top: 14px;
      }

      .mt-sm {
        display: block;
        margin-top: 12px;
      }
    `,
  ],
})
export class CoachSessionEditorPage {
  private readonly coach = inject(CoachService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly id = input<string | undefined>(undefined);

  readonly zones = ZONE_CHOICES;
  readonly isGroup = isGroup;

  readonly athletes = load(() => this.coach.athletes$());
  readonly existing = load<ApiSessionTemplate | null>(() => {
    const id = this.id();
    return id ? this.coach.template$(id) : of(null);
  });

  readonly name = signal('');
  readonly description = signal('');
  readonly sport = signal<'running' | 'strength'>('running');
  readonly sessionType = signal('fractionne');
  readonly blocks = signal<EditableBlock[]>([newWarmup(), newRepeat(), newCooldown()]);
  readonly vma = signal(16.5);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly typeOptions = computed(() =>
    this.sport() === 'running' ? RUNNING_TYPES : ['upper_body', 'lower_body', 'full_body', 'core', 'hiit'],
  );

  readonly segments = computed(() => blocksToSegments(toPayload(this.blocks(), this.vma()), this.vma()));

  readonly estimate = computed(() => {
    const total = totals(this.segments());
    return {
      distance: total.dist ? `${formatDecimal(total.dist / 1000, 1)} km` : '—',
      duration: total.sec ? formatHoursMinutes(total.sec) : '—',
    };
  });

  readonly hasWarmup = computed(() => this.blocks().some((block) => block.role === 'warmup'));
  readonly hasCooldown = computed(() => this.blocks().some((block) => block.role === 'cooldown'));

  /** Étape principale de référence pour l'aperçu par athlète. */
  readonly mainStep = computed<EditableStep | null>(() => {
    for (const block of this.blocks()) {
      if (block.role !== 'main') continue;
      const steps = block.children?.length ? block.children : [block];
      const found = steps.find((step) => (stepPercent(step) ?? 0) >= 84);
      if (found) return found;
    }
    return null;
  });

  readonly preview = computed(() => {
    const vma = this.vma();
    const rows: { label: string; pace: string; detail: string }[] = [];
    for (const block of this.blocks()) {
      const steps = block.children?.length ? block.children : [block];
      for (const step of steps) {
        const percent = stepPercent(step);
        const pace = paceFromPercent(vma, percent) ?? step.pace ?? '—';
        const reps = block.children?.length ? `${block.repetitions} × ` : '';
        rows.push({
          label: `${reps}${block.children?.length ? stepValueLabel(step) : ROLE_LABELS[step.role]}`,
          pace: pace === '—' ? '—' : `${pace} /km`,
          detail: this.repDetail(step, vma),
        });
        const recovery = recoveryLabel(step);
        if (recovery) rows.push({ label: 'Récupération', pace: `${formatPace(paceFor(vma, 50))} /km`, detail: recovery.replace('Récup ', '') });
      }
    }
    return rows;
  });

  readonly athletePaces = computed(() => {
    const step = this.mainStep();
    const percent = step ? stepPercent(step) : undefined;
    return (this.athletes.data() ?? []).map((athlete) => {
      if (!athlete.vma || !percent) {
        return { id: athlete.id, initials: athlete.initials, name: athlete.name, vma: 'VMA manquante', value: '—' };
      }
      return {
        id: athlete.id,
        initials: athlete.initials,
        name: athlete.name,
        vma: `${formatDecimal(athlete.vma, 1)} km/h`,
        value: this.repDetail(step!, athlete.vma) || `${formatPace(paceFor(athlete.vma, percent))} /km`,
      };
    });
  });

  constructor() {
    // Une séance existante remplit le formulaire une fois chargée.
    effect(() => {
      const template = this.existing.data();
      if (!template) return;
      this.name.set(template.name);
      this.description.set(template.description ?? '');
      this.sport.set(template.sport);
      this.sessionType.set(template.sessionType);
      const blocks = toEditable(templateRunBlocks(template.runBlocks ?? []));
      if (blocks.length) this.blocks.set(blocks);
    });

    // La VMA d'aperçu part de celle d'un athlète réel plutôt que d'une valeur arbitraire.
    effect(() => {
      const first = this.athletes.data()?.find((athlete) => athlete.vma)?.vma;
      if (first) this.vma.set(first);
    });
  }

  label(type: string) {
    return SESSION_TYPE_LABELS[type] ?? type;
  }

  roleLabel(block: EditableBlock) {
    return ROLE_LABELS[block.role];
  }

  stepValue(step: EditableStep) {
    return stepValueLabel(step);
  }

  target(step: EditableStep) {
    return stepTargetLabel(step, this.vma());
  }

  mode(step: EditableStep) {
    return paceMode(step);
  }

  percent(step: EditableStep) {
    return stepPercent(step) ?? 70;
  }

  paceAt(step: EditableStep) {
    return paceFromPercent(this.vma(), stepPercent(step));
  }

  shade(step: EditableStep) {
    const pct = stepPercent(step) ?? 60;
    if (pct >= 95) return '#05608F';
    if (pct >= 84) return '#0A8ED6';
    if (pct >= 78) return '#3DB4F5';
    if (pct >= 68) return '#8FD2F8';
    return '#CDEBFB';
  }

  metersOf(step: EditableStep) {
    return step.distance ? Math.round(step.distance * 1000) : '';
  }

  recMeters(step: EditableStep) {
    return step.recoveryDistance ? Math.round(step.recoveryDistance * 1000) : '';
  }

  dec(value: number) {
    return formatDecimal(value, 1);
  }

  round1(value: number) {
    return Math.max(8, Math.min(25, Math.round(value * 2) / 2));
  }

  // ---- Modification des blocs ----

  patch(key: string, parent: string | null, changes: Partial<EditableStep>) {
    this.blocks.update((blocks) =>
      blocks.map((block) => {
        if (parent && block.key === parent) {
          return { ...block, children: block.children?.map((child) => (child.key === key ? { ...child, ...changes } : child)) };
        }
        return !parent && block.key === key ? { ...block, ...changes } : block;
      }),
    );
  }

  setMeters(key: string, parent: string | null, event: Event) {
    const meters = Number((event.target as HTMLInputElement).value);
    this.patch(key, parent, { distance: Number.isFinite(meters) && meters > 0 ? meters / 1000 : null });
  }

  setRecMeters(key: string, parent: string | null, event: Event) {
    const meters = Number((event.target as HTMLInputElement).value);
    this.patch(key, parent, { recoveryDistance: Number.isFinite(meters) && meters > 0 ? meters / 1000 : null });
  }

  setZone(key: string, parent: string | null, zone: string) {
    this.transform(key, parent, (step) => withZone(step, zone, this.vma()));
  }

  setPercent(key: string, parent: string | null, event: Event) {
    const percent = Number((event.target as HTMLInputElement).value);
    this.transform(key, parent, (step) => withPercent(step, percent, this.vma()));
  }

  setFixed(key: string, parent: string | null, pace: string) {
    this.transform(key, parent, (step) => withFixedPace(step, pace));
  }

  /** Applique une transformation d'allure à une étape, qu'elle soit racine ou enfant d'un bloc. */
  private transform(key: string, parent: string | null, change: (step: EditableStep) => EditableStep) {
    this.blocks.update((blocks) =>
      blocks.map((block) => {
        if (parent && block.key === parent) {
          return { ...block, children: block.children?.map((child) => (child.key === key ? change(child) : child)) };
        }
        return !parent && block.key === key ? { ...change(block), children: block.children } : block;
      }),
    );
  }

  setReps(key: string, repetitions: number) {
    this.blocks.update((blocks) =>
      blocks.map((block) => (block.key === key ? { ...block, repetitions: Math.max(1, Math.min(40, repetitions)) } : block)),
    );
  }

  addStep() {
    this.blocks.update((blocks) => insertMain(blocks, newStep()));
  }

  addRepeat() {
    this.blocks.update((blocks) => insertMain(blocks, newRepeat()));
  }

  addWarmup() {
    this.blocks.update((blocks) => [newWarmup(), ...blocks]);
  }

  addCooldown() {
    this.blocks.update((blocks) => [...blocks, newCooldown()]);
  }

  addChild(parentKey: string) {
    this.blocks.update((blocks) =>
      blocks.map((block) =>
        block.key === parentKey ? { ...block, children: [...(block.children ?? []), { ...(block.children?.[0] ?? newStep()), key: `${parentKey}-${Date.now()}` }] } : block,
      ),
    );
  }

  removeBlock(index: number) {
    this.blocks.update((blocks) => blocks.filter((_, i) => i !== index));
  }

  removeChild(parentKey: string, key: string) {
    this.blocks.update((blocks) =>
      blocks.map((block) => (block.key === parentKey ? { ...block, children: block.children?.filter((child) => child.key !== key) } : block)),
    );
  }

  save() {
    if (this.saving()) return;
    if (!this.name().trim()) {
      this.error.set('Donnez un nom à la séance.');
      return;
    }
    if (this.sport() === 'running') {
      const invalid = validateBlocks(this.blocks());
      if (invalid) {
        this.error.set(invalid);
        return;
      }
    }
    this.error.set('');
    this.saving.set(true);
    const total = totals(this.segments());
    this.coach
      .saveTemplate(this.id() ?? null, {
        name: this.name().trim(),
        description: this.description().trim(),
        sport: this.sport(),
        sessionType: this.sessionType(),
        targetDistance: total.dist ? Number((total.dist / 1000).toFixed(1)) : null,
        targetDuration: total.sec ? Math.round(total.sec / 60) : null,
        runBlocks: this.sport() === 'running' ? toTemplateBlocks(this.blocks()) : [],
        strengthPlan: null,
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

  openStrengthEditor() {
    void this.router.navigate(['/coach/bibliotheque/muscu'], { queryParams: { id: this.id() } });
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
    const parsed = Number((event.target as HTMLInputElement).value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  /** « 1:25 / rép. » pour une distance, la durée sinon. */
  private repDetail(step: EditableStep, vma: number) {
    const percent = stepPercent(step);
    if (step.mode === 'distance' && step.distance && percent) {
      const seconds = step.distance * paceFor(vma, percent);
      return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')} / rép.`;
    }
    return step.duration ? `${step.duration} min` : '';
  }
}
