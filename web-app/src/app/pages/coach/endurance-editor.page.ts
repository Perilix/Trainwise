import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Location, NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { ApiError } from '../../core/api.service';
import type { ApiPool, ApiSessionTemplate, ApiSportReference, ApiSportStep } from '../../core/api-types';
import { formatHoursMinutes } from '../../core/format';
import { load } from '../../core/load';
import { CoachService } from '../../data/coach.service';
import {
  EQUIPMENT_LABELS,
  POOL_LABELS,
  STROKE_LABELS,
  formatMeters,
  formatSwimPace,
  intensityLevel,
  parseSwimPace,
  recoveryText,
  relativeIntensity,
  resolvedTarget,
  sessionEquipment,
  sportSegments,
  stepWorkSeconds,
  targetLabel,
  zoneOf,
  zonesFor,
  type EnduranceSport,
} from '../../domain/sport-blocks';
import {
  defaultSportBlocks,
  durationInput,
  newSportChild,
  newSportCooldown,
  newSportRepeat,
  newSportStep,
  newSportWarmup,
  parseMinutesInput,
  parseRestInput,
  restInput,
  toEditableSport,
  toSportPayload,
  validateSport,
  type EditableSportBlock,
  type EditableSportStep,
} from '../../domain/sport-blocks-model';
import { formatDuration, totals } from '../../domain/sessions';
import { AvatarComponent } from '../../ui/avatar.component';
import { ExpectedFeelingComponent } from '../../ui/expected-feeling.component';
import { IconComponent } from '../../ui/icon.component';
import { IntensityLegendComponent } from '../../ui/intensity-legend.component';
import { StateViewComponent } from '../../ui/state-view.component';
import { WorkoutProfileComponent } from '../../ui/workout-profile.component';

const RAMP = ['#CDEBFB', '#8FD2F8', '#3DB4F5', '#0A8ED6', '#05608F'];
const ROLE_LABELS = { warmup: 'Échauffement', main: 'Corps de séance', cooldown: 'Retour au calme' } as const;

type BikeMode = 'ftp' | 'watts' | 'hr' | 'rpe';
type SwimMode = 'css' | 'pace';

/**
 * Éditeur de séance type de vélo ou de natation : même grammaire que l'éditeur de course
 * (étapes, blocs à répéter, récupération), avec des cibles en % FTP ou % CSS.
 */
@Component({
  selector: 'tw-endurance-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, ExpectedFeelingComponent, IconComponent, IntensityLegendComponent, NgTemplateOutlet, StateViewComponent, WorkoutProfileComponent],
  template: `
    <main class="page">
      <button type="button" class="back" (click)="goBack()">
        <tw-icon name="chevron-left" [size]="16" />
        <span class="small">Bibliothèque</span>
      </button>

      <div class="title-line">
        <div class="stack min">
          <h1 class="display">{{ id() ? 'Modifier la séance' : bike() ? 'Nouvelle séance de vélo' : 'Nouvelle séance de natation' }}</h1>
          <p class="body muted">
            {{ bike() ? 'Définissez une séance réutilisable, avec des puissances basées sur la FTP de chaque athlète.' : 'Définissez une séance réutilisable, avec des allures basées sur la CSS de chaque athlète.' }}
          </p>
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

      @if (existing.loading()) {
        <tw-state kind="loading" />
      } @else {
        <div class="cols">
          <div class="col">
            <section class="card card-pad">
              <span class="h2">Informations</span>
              <div class="info-grid">
                <div class="field">
                  <label for="name">Nom *</label>
                  <input id="name" class="input" [placeholder]="bike() ? 'Seuil 3 × 10 min' : 'Seuil 10 × 100 m'" [value]="name()" (input)="name.set(value($event))" />
                </div>
                <div class="field">
                  <label>Sport</label>
                  <div class="segmented">
                    <button type="button" class="seg" (click)="switchTo('running')">Course</button>
                    <button type="button" class="seg" (click)="switchTo('strength')">Muscu</button>
                    <button type="button" class="seg" [class.on]="bike()" (click)="switchTo('bike')">Vélo</button>
                    <button type="button" class="seg" [class.on]="!bike()" (click)="switchTo('swim')">Natation</button>
                  </div>
                </div>
              </div>
              @if (!bike()) {
                <div class="field mt">
                  <label>Bassin</label>
                  <div class="segmented narrow-seg">
                    @for (option of pools; track option.value) {
                      <button type="button" class="seg" [class.on]="pool() === option.value" (click)="pool.set(option.value)">{{ option.label }}</button>
                    }
                  </div>
                </div>
              }
              <div class="field mt">
                <label for="desc">Description</label>
                <textarea id="desc" class="input" rows="2" [value]="description()" (input)="description.set(value($event))"></textarea>
              </div>
              <div class="field mt">
                <label>Difficulté attendue <span class="muted">— facultatif</span></label>
                <tw-expected-feeling [value]="expectedFeeling()" (changed)="expectedFeeling.set($event)" />
              </div>
            </section>

            <section class="card card-pad">
              <div class="spread">
                <span class="h2">{{ bike() ? 'Blocs vélo' : 'Séries' }}</span>
                <div class="totals">
                  @if (!bike()) {
                    <span class="h3">Total {{ estimate().distance }}</span>
                    <span class="muted-3">·</span>
                  }
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
                  @if (block.children?.length) {
                    <div
                      class="group"
                      [class.dragging]="dragKey() === block.key"
                      [class.drop-before]="isDrop(block.key, false)"
                      [class.drop-after]="isDrop(block.key, true)"
                      [attr.draggable]="armed() === block.key"
                      (dragstart)="dragStart($event, block.key, null)"
                      (dragover)="dragOver($event, block.key, null)"
                      (drop)="drop($event, block.key, null)"
                      (dragend)="dragEnd()"
                    >
                      <div class="group-head">
                        <button
                          type="button"
                          class="grip"
                          aria-label="Déplacer le bloc (flèches haut et bas)"
                          title="Glisser pour déplacer"
                          (mousedown)="armed.set(block.key)"
                          (mouseup)="armed.set(null)"
                          (keydown.arrowup)="moveBy($event, block.key, null, -1)"
                          (keydown.arrowdown)="moveBy($event, block.key, null, 1)"
                        >
                          <tw-icon name="grip" [size]="16" />
                        </button>
                        <tw-icon name="repeat" [size]="18" />
                        <span class="h2">Bloc à répéter</span>
                        <div class="stepper">
                          <button type="button" (click)="setReps(block.key, (block.repetitions ?? 1) - 1)" aria-label="Moins">−</button>
                          <span class="num">{{ block.repetitions }} ×</span>
                          <button type="button" (click)="setReps(block.key, (block.repetitions ?? 1) + 1)" aria-label="Plus">+</button>
                        </div>
                        <input class="input label-input" placeholder="Intitulé (facultatif)" [value]="block.label ?? ''" (input)="patch(block.key, null, { label: value($event) })" />
                        <span class="grow"></span>
                        <button class="icon-btn" type="button" (click)="removeBlock(index)" aria-label="Supprimer le bloc">
                          <tw-icon name="trash" [size]="18" />
                        </button>
                      </div>

                      @for (child of block.children ?? []; track child.key) {
                        <div
                          class="step-card"
                          [class.open]="isOpen(child.key)"
                          [class.dragging]="dragKey() === child.key"
                      [class.drop-before]="isDrop(child.key, false)"
                      [class.drop-after]="isDrop(child.key, true)"
                      [attr.draggable]="armed() === child.key"
                      (dragstart)="dragStart($event, child.key, block.key)"
                      (dragover)="dragOver($event, child.key, block.key)"
                      (drop)="drop($event, child.key, block.key)"
                      (dragend)="dragEnd()"
                        >
                          <div class="step-head">
                            <button
                          type="button"
                          class="grip"
                          aria-label="Déplacer l'étape (flèches haut et bas)"
                          title="Glisser pour déplacer"
                          (mousedown)="armed.set(child.key)"
                          (mouseup)="armed.set(null)"
                          (keydown.arrowup)="moveBy($event, child.key, block.key, -1)"
                          (keydown.arrowdown)="moveBy($event, child.key, block.key, 1)"
                        >
                          <tw-icon name="grip" [size]="16" />
                        </button>
                            <button type="button" class="step-toggle" [attr.aria-expanded]="isOpen(child.key)" (click)="toggleOpen(child.key)">
                              <span class="swatch" [style.background]="shade(child)"></span>
                              <span class="stack grow">
                                <span class="h3">{{ child.label?.trim() || 'Étape' }} · {{ volume(child) }}</span>
                                <span class="small muted">{{ summary(child, true) }}</span>
                              </span>
                              <span class="edit-hint">
                                <tw-icon [name]="isOpen(child.key) ? 'chevron-down' : 'edit'" [size]="16" />
                              </span>
                            </button>
                            @if ((block.children?.length ?? 0) > 1) {
                              <button class="icon-btn" type="button" (click)="removeChild(block.key, child.key)" aria-label="Supprimer l'étape">
                                <tw-icon name="trash" [size]="16" />
                              </button>
                            }
                          </div>
                          @if (isOpen(child.key)) {
                            <ng-container *ngTemplateOutlet="stepForm; context: { $implicit: child, parent: block.key }" />
                            <ng-container *ngTemplateOutlet="recoveryForm; context: { $implicit: child, parent: block.key }" />
                            <ng-container *ngTemplateOutlet="validate; context: { $implicit: child.key }" />
                          }
                        </div>
                      }

                      <button type="button" class="add" (click)="addChild(block.key)">
                        <tw-icon name="plus" [size]="16" [strokeWidth]="2" />
                        Étape dans le groupe
                      </button>
                    </div>
                  } @else {
                    <div
                      class="step-card"
                      [class.open]="isOpen(block.key)"
                      [class.dragging]="dragKey() === block.key"
                      [class.drop-before]="isDrop(block.key, false)"
                      [class.drop-after]="isDrop(block.key, true)"
                      [attr.draggable]="armed() === block.key"
                      (dragstart)="dragStart($event, block.key, null)"
                      (dragover)="dragOver($event, block.key, null)"
                      (drop)="drop($event, block.key, null)"
                      (dragend)="dragEnd()"
                    >
                      <div class="step-head">
                        <button
                          type="button"
                          class="grip"
                          aria-label="Déplacer l'étape (flèches haut et bas)"
                          title="Glisser pour déplacer"
                          (mousedown)="armed.set(block.key)"
                          (mouseup)="armed.set(null)"
                          (keydown.arrowup)="moveBy($event, block.key, null, -1)"
                          (keydown.arrowdown)="moveBy($event, block.key, null, 1)"
                        >
                          <tw-icon name="grip" [size]="16" />
                        </button>
                        <button type="button" class="step-toggle" [attr.aria-expanded]="isOpen(block.key)" (click)="toggleOpen(block.key)">
                          <span class="swatch" [style.background]="shade(block)"></span>
                          <span class="stack grow">
                            <span class="h3">{{ block.label?.trim() || roleLabel(block) }} · {{ volume(block) }}</span>
                            <span class="small muted">{{ summary(block, false) }}</span>
                          </span>
                          <span class="edit-hint">
                            <tw-icon [name]="isOpen(block.key) ? 'chevron-down' : 'edit'" [size]="16" />
                          </span>
                        </button>
                        @if (isOpen(block.key)) {
                          <select class="input role-select" [value]="block.role" (change)="patch(block.key, null, { role: roleOf($event) })" aria-label="Rôle de l'étape">
                            <option value="warmup">Échauffement</option>
                            <option value="main">Corps de séance</option>
                            <option value="cooldown">Retour au calme</option>
                          </select>
                        }
                        <button class="icon-btn" type="button" (click)="removeBlock(index)" aria-label="Supprimer">
                          <tw-icon name="trash" [size]="18" />
                        </button>
                      </div>
                      @if (isOpen(block.key)) {
                        <ng-container *ngTemplateOutlet="stepForm; context: { $implicit: block, parent: null }" />
                        <ng-container *ngTemplateOutlet="validate; context: { $implicit: block.key }" />
                      }
                    </div>
                  }
                }
              </div>

              <div class="add-row">
                <button class="btn btn-ghost btn-sm" type="button" (click)="addStep()">
                  <tw-icon name="plus" [size]="16" [strokeWidth]="2" />
                  {{ bike() ? 'Étape' : 'Série' }}
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
          </div>

          <div class="col">
            <section class="card card-pad">
              <span class="h2">{{ bike() ? 'Aperçu pour FTP' : 'Aperçu pour CSS' }}</span>
              <div class="ref-row">
                <div class="stepper">
                  <button type="button" (click)="nudgeReference(-1)" aria-label="Moins">−</button>
                  <span class="num">{{ bike() ? ftp() : swimPace(css()) }}</span>
                  <button type="button" (click)="nudgeReference(1)" aria-label="Plus">+</button>
                </div>
                <span class="small muted">{{ bike() ? 'watts' : '/100 m' }}</span>
              </div>

              <div class="preview">
                @for (row of preview(); track $index) {
                  <div class="p-row">
                    <span class="grow body muted">{{ row.label }}</span>
                    <div class="p-values">
                      <span class="h3 num">{{ row.value }}</span>
                      <span class="caption muted num">{{ row.detail }}</span>
                    </div>
                  </div>
                }
              </div>

              <div class="p-totals">
                @if (bike()) {
                  <div class="stat"><span class="caption muted">Durée</span><span class="value num">≈ {{ estimate().duration }}</span></div>
                  <div class="stat"><span class="caption muted">Temps au seuil et plus</span><span class="value num">{{ estimate().hard }}</span></div>
                } @else {
                  <div class="stat"><span class="caption muted">Volume</span><span class="value num">{{ estimate().distance }}</span></div>
                  <div class="stat"><span class="caption muted">Durée</span><span class="value num">≈ {{ estimate().duration }}</span></div>
                }
              </div>
              @if (gear().length) {
                <div class="gear-line">
                  <span class="caption muted">À prendre</span>
                  @for (item of gear(); track item) {
                    <span class="chip">{{ item }}</span>
                  }
                </div>
              }
            </section>

            @if (mainStep(); as main) {
              <section class="card card-pad">
                <span class="h2">{{ volume(main) }} pour vos athlètes</span>
                <div class="athletes">
                  @for (athlete of athleteTargets(); track athlete.id) {
                    <div class="a-row">
                      <tw-avatar [initials]="athlete.initials" tone="accent" [size]="28" />
                      <span class="grow truncate body">{{ athlete.name }}</span>
                      <span class="small muted num">{{ athlete.reference }}</span>
                      <span class="h3 num">{{ athlete.value }}</span>
                    </div>
                  } @empty {
                    <span class="small muted">Aucun athlète pour l'instant.</span>
                  }
                </div>
                <span class="caption muted mt-sm">{{ bike() ? 'La FTP se renseigne sur la fiche de chaque athlète.' : 'La CSS se renseigne sur la fiche de chaque athlète.' }}</span>
              </section>
            }

            <section class="card card-pad">
              <span class="h2">Intensité</span>
              <div class="mt">
                <tw-intensity-legend [sport]="sport()" />
              </div>
              <span class="caption muted mt-sm">{{ bike() ? 'Hauteur des barres = % FTP, largeur = durée.' : 'Hauteur des barres = % de la vitesse CSS, largeur = durée.' }}</span>
            </section>
          </div>
        </div>
      }
    </main>

    <ng-template #stepForm let-step let-parent="parent">
      @if (bike()) {
        <div class="form-grid">
          <div class="field">
            <label>Durée (min)</label>
            <input class="input" placeholder="10 ou 1:30" [value]="duration(step)" (change)="setDuration(step.key, parent, $event)" />
          </div>
          <div class="field">
            <label>Intensité</label>
            <div class="segmented small-seg">
              <button type="button" class="seg" [class.on]="!step.ramp" (click)="patch(step.key, parent, { ramp: false })">Stable</button>
              <button type="button" class="seg" [class.on]="step.ramp" (click)="setRamp(step.key, parent, step)">Progressive</button>
            </div>
          </div>
          <div class="field">
            <label>Intitulé <span class="muted-3">— facultatif</span></label>
            <input class="input" placeholder="Côte, sprint…" [value]="step.label ?? ''" (input)="patch(step.key, parent, { label: value($event) })" />
          </div>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Cible</label>
            <select class="input" [value]="step.intensityMode ?? 'ftp'" (change)="setMode(step.key, parent, modeOf($event))">
              @for (option of bikeModes; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </div>
          @if (step.intensityMode === 'ftp' && !step.ramp) {
            <div class="field">
              <label>Zone</label>
              <select class="input" [value]="zoneKey(step)" (change)="setZone(step.key, parent, value($event))">
                @for (option of zones(); track option.key) {
                  <option [value]="option.key">{{ option.label }}</option>
                }
                <option value="">Personnalisée</option>
              </select>
            </div>
          } @else {
            <div></div>
          }
          <div class="field">
            <label>{{ step.ramp ? 'De → à' : step.intensityMode === 'rpe' ? 'Ressenti' : 'Min – max' }} ({{ unit(step) }})</label>
            <div class="pair">
                <input class="input num" inputmode="decimal" [value]="step.intensityLow ?? ''" (change)="setBound(step.key, parent, 'intensityLow', $event)" />
                <span class="muted-3">{{ step.ramp ? '→' : '–' }}</span>
                <input class="input num" inputmode="decimal" [value]="step.intensityHigh ?? ''" (change)="setBound(step.key, parent, 'intensityHigh', $event)" />
              </div>
          </div>
        </div>
        @if (step.ramp) {
          <span class="caption muted ramp-hint">L'intensité monte régulièrement de la première valeur à la seconde, idéal pour un échauffement.</span>
        }
        <div class="form-grid">
          <div class="field">
            <label>Cadence (tr/min)</label>
            <input class="input" placeholder="Libre" [value]="step.cadence ?? ''" (input)="patch(step.key, parent, { cadence: value($event) })" />
          </div>
          <div class="field">
            <label>Position</label>
            <select class="input" [value]="step.position ?? ''" (change)="patch(step.key, parent, { position: positionOf($event) })">
              <option value="">Libre</option>
              <option value="assis">Assis</option>
              <option value="danseuse">En danseuse</option>
            </select>
          </div>
          <div class="field">
            <label>Consigne</label>
            <input class="input" [value]="step.description ?? ''" (input)="patch(step.key, parent, { description: value($event) })" />
          </div>
        </div>
      } @else {
        <div class="form-grid">
          <div class="field">
            <label>Distance (m)</label>
            <input class="input num" inputmode="numeric" [value]="step.distance ?? ''" (change)="setDistance(step.key, parent, $event)" />
          </div>
          <div class="field">
            <label>Nage</label>
            <select class="input" [value]="step.stroke ?? 'crawl'" (change)="patch(step.key, parent, { stroke: value($event) })">
              @for (option of strokes; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>Intitulé <span class="muted-3">— facultatif</span></label>
            <input class="input" placeholder="Bras seuls, éducatifs…" [value]="step.label ?? ''" (input)="patch(step.key, parent, { label: value($event) })" />
          </div>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Allure</label>
            <select class="input" [value]="step.intensityMode === 'pace' ? 'pace' : 'css'" (change)="setMode(step.key, parent, modeOf($event))">
              <option value="css">Zone CSS</option>
              <option value="pace">Allure fixe</option>
            </select>
          </div>
          @if (step.intensityMode !== 'pace') {
            <div class="field">
              <label>Zone</label>
              <select class="input" [value]="zoneKey(step)" (change)="setZone(step.key, parent, value($event))">
                @for (option of zones(); track option.key) {
                  <option [value]="option.key">{{ option.label }}</option>
                }
                <option value="">Personnalisée</option>
              </select>
            </div>
            <div class="field">
              <label>Min – max (% CSS)</label>
              <div class="pair">
                <input class="input num" inputmode="decimal" [value]="step.intensityLow ?? ''" (change)="setBound(step.key, parent, 'intensityLow', $event)" />
                <span class="muted-3">{{ step.ramp ? '→' : '–' }}</span>
                <input class="input num" inputmode="decimal" [value]="step.intensityHigh ?? ''" (change)="setBound(step.key, parent, 'intensityHigh', $event)" />
              </div>
            </div>
          } @else {
            <div class="field">
              <label>Plus rapide (/100 m)</label>
              <input class="input num" placeholder="1'40" [value]="paceValue(step.intensityLow)" (change)="setPaceBound(step.key, parent, 'intensityLow', $event)" />
            </div>
            <div class="field">
              <label>Plus lente (/100 m)</label>
              <input class="input num" placeholder="1'45" [value]="paceValue(step.intensityHigh)" (change)="setPaceBound(step.key, parent, 'intensityHigh', $event)" />
            </div>
          }
        </div>
        <div class="field mt-field">
          <label>Matériel <span class="muted-3">— cliquez pour ajouter ou retirer</span></label>
          <div class="toggles">
            @for (item of equipment; track item.value) {
              <button
                type="button"
                class="toggle"
                [class.on]="(step.equipment ?? []).includes(item.value)"
                [attr.aria-pressed]="(step.equipment ?? []).includes(item.value)"
                (click)="toggleEquipment(step.key, parent, step, item.value)"
              >
                <span class="tick"><tw-icon [name]="(step.equipment ?? []).includes(item.value) ? 'check' : 'plus'" [size]="13" [strokeWidth]="2.5" /></span>
                {{ item.label }}
              </button>
            }
          </div>
        </div>
        <div class="field mt-field">
          <label>Consigne</label>
          <input class="input" [value]="step.description ?? ''" (input)="patch(step.key, parent, { description: value($event) })" />
        </div>
      }

      @if (resolvedHint(step); as hint) {
        <div class="hint">
          <tw-icon name="info" [size]="16" />
          <span class="small">{{ hint }}</span>
        </div>
      }
    </ng-template>

    <ng-template #validate let-key>
      <div class="validate-row">
        <button class="btn btn-primary btn-sm" type="button" (click)="toggleOpen(key)">
          <tw-icon name="check" [size]="16" [strokeWidth]="2" />
          Valider l'étape
        </button>
      </div>
    </ng-template>

    <ng-template #recoveryForm let-step let-parent="parent">
      <div class="recovery">
        <div class="spread">
          <div class="rec-title">
            <tw-icon name="clock" [size]="16" />
            <span class="h3">Récupération</span>
          </div>
          @if (step.recoveryMode) {
            <button type="button" class="remove" (click)="patch(step.key, parent, { recoveryMode: null, recoverySeconds: null })">Retirer</button>
          } @else {
            <button type="button" class="link-btn" (click)="addRecovery(step.key, parent)">Ajouter</button>
          }
        </div>
        @if (step.recoveryMode) {
          <div class="form-grid">
            @if (bike()) {
              <div class="field">
                <label>Durée (min)</label>
                <input class="input" placeholder="5 ou 2:30" [value]="duration({ duration: step.recoverySeconds })" (change)="setRecoveryDuration(step.key, parent, $event)" />
              </div>
              <div class="field">
                <label>% FTP</label>
                <input class="input num" inputmode="numeric" placeholder="55" [value]="step.recoveryIntensity ?? ''" (change)="setRecoveryIntensity(step.key, parent, $event)" />
              </div>
            } @else {
              <div class="field">
                <label>Mode</label>
                <div class="segmented small-seg">
                  <button type="button" class="seg" [class.on]="step.recoveryMode === 'rest'" (click)="patch(step.key, parent, { recoveryMode: 'rest', recoverySeconds: 15 })">Repos</button>
                  <button type="button" class="seg" [class.on]="step.recoveryMode === 'sendoff'" (click)="setSendoff(step.key, parent, step)">Départ</button>
                </div>
              </div>
              <div class="field">
                <label>{{ step.recoveryMode === 'sendoff' ? 'Départ toutes les' : 'Repos (s)' }}</label>
                <input
                  class="input num"
                  [placeholder]="step.recoveryMode === 'sendoff' ? '1\\'50' : '15'"
                  [value]="rest(step)"
                  (change)="setRest(step.key, parent, $event)"
                />
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
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
        gap: 12px;
        margin-top: 14px;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-top: 12px;
      }

      .mt-field {
        margin-top: 12px;
      }

      .segmented {
        display: flex;
        padding: 3px;
        border-radius: var(--r-md);
        background: var(--subtle);
        gap: 2px;
      }

      .narrow-seg {
        align-self: flex-start;
        min-width: 320px;
      }

      .seg {
        flex: 1;
        height: 36px;
        padding: 0 8px;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 500;
        color: var(--text2);
        white-space: nowrap;
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

      .label-input {
        height: 32px;
        max-width: 220px;
        font-size: 13px;
        color: var(--ink);
      }

      .role-select {
        width: 170px;
        height: 32px;
        padding: 0 10px;
        font-size: 13px;
      }

      .stepper {
        display: flex;
        align-items: center;
        gap: 2px;
        background: var(--subtle);
        border-radius: var(--r-sm);
        padding: 2px;
        color: var(--ink);
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
        flex-shrink: 0;
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

      .step-toggle {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        text-align: left;
        padding: 2px 0;
      }

      .edit-hint {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--r-sm);
        color: var(--text3);
        flex-shrink: 0;
      }

      .step-toggle:hover .edit-hint {
        background: var(--subtle);
        color: var(--accent-ink);
      }

      .step-card:not(.open):hover {
        border-color: var(--border-strong);
      }

      /* Ouverte : un cadre neutre et une ombre légère, pour ne pas la confondre avec un bloc à répéter (bleu). */
      .step-card.open {
        border-color: var(--border-strong);
        box-shadow: 0 6px 18px rgba(0, 53, 84, 0.08);
      }

      .validate-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 14px;
      }

      .grip {
        width: 24px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        color: var(--text3);
        cursor: grab;
        flex-shrink: 0;
      }

      .grip:hover,
      .grip:focus-visible {
        background: var(--subtle);
        color: var(--ink);
      }

      .dragging {
        opacity: 0.45;
      }

      /* Où l'élément va tomber : un trait bleu au-dessus ou en dessous. */
      .drop-before {
        box-shadow: 0 -3px 0 0 var(--accent);
      }

      .drop-after {
        box-shadow: 0 3px 0 0 var(--accent);
      }

      .ramp-hint {
        display: block;
        margin-top: 8px;
      }

      .pair {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .pair .input {
        min-width: 0;
        padding: 0 10px;
      }

      .toggles {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 36px;
        padding: 0 12px 0 8px;
        border-radius: var(--r-md);
        border: 1px solid var(--border-strong);
        background: var(--surface);
        font-size: 13px;
        font-weight: 500;
      }

      .toggle:hover {
        background: var(--bg);
      }

      .toggle .tick {
        width: 20px;
        height: 20px;
        border-radius: 6px;
        background: var(--subtle);
        color: var(--text2);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .toggle.on {
        background: var(--accent-soft);
        border-color: var(--accent);
        color: var(--accent-ink);
        font-weight: 600;
      }

      .toggle.on .tick {
        background: var(--accent);
        color: #ffffff;
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

      .ref-row {
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

      .gear-line {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 14px;
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
export class CoachEnduranceEditorPage {
  private readonly coach = inject(CoachService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly id = input<string | undefined>(undefined);
  /** Posé par la route (/velo ou /natation) ; une séance existante impose le sien. */
  readonly routeSport = input<EnduranceSport>('bike', { alias: 'sport' });

  readonly athletes = load(() => this.coach.athletes$());
  readonly existing = load<ApiSessionTemplate | null>(() => {
    const id = this.id();
    return id ? this.coach.template$(id) : of(null);
  });

  readonly sport = signal<EnduranceSport>('bike');
  readonly bike = computed(() => this.sport() === 'bike');

  readonly name = signal('');
  readonly description = signal('');
  readonly expectedFeeling = signal<number | null>(null);
  readonly pool = signal<ApiPool>('25');
  readonly blocks = signal<EditableSportBlock[]>([]);
  readonly ftp = signal(250);
  readonly css = signal(105);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly pools: { value: ApiPool; label: string }[] = (['25', '50', 'open'] as const).map((value) => ({ value, label: POOL_LABELS[value] }));
  readonly strokes = Object.entries(STROKE_LABELS).map(([value, label]) => ({ value, label }));
  readonly equipment = Object.entries(EQUIPMENT_LABELS).map(([value, label]) => ({ value, label }));
  readonly bikeModes: { value: BikeMode; label: string }[] = [
    { value: 'ftp', label: '% FTP' },
    { value: 'watts', label: 'Watts' },
    { value: 'hr', label: '% FC max' },
    { value: 'rpe', label: 'Ressenti' },
  ];

  readonly zones = computed(() => zonesFor(this.sport()));

  /** Une seule étape ouverte à la fois : les autres se lisent en une ligne. */
  readonly openKey = signal<string | null>(null);

  readonly reference = computed<ApiSportReference>(() => (this.bike() ? { ftp: this.ftp() } : { css: this.css() }));

  private readonly payload = computed(() => toSportPayload(this.blocks()));

  readonly segments = computed(() => sportSegments(this.payload(), this.sport(), this.reference()));

  readonly estimate = computed(() => {
    const total = totals(this.segments());
    const hard = this.segments()
      .filter((segment) => segment.pct >= 90)
      .reduce((sum, segment) => sum + segment.sec, 0);
    return {
      distance: total.dist ? formatMeters(total.dist) : '—',
      duration: total.sec ? formatHoursMinutes(total.sec) : '—',
      hard: hard ? formatDuration(hard) : '—',
    };
  });

  readonly gear = computed(() => sessionEquipment(this.payload()));

  readonly hasWarmup = computed(() => this.blocks().some((block) => block.role === 'warmup'));
  readonly hasCooldown = computed(() => this.blocks().some((block) => block.role === 'cooldown'));

  /** Étape la plus intense du corps de séance : celle qu'on chiffre pour chaque athlète. */
  readonly mainStep = computed<EditableSportStep | null>(() => {
    let best: EditableSportStep | null = null;
    let bestValue = -1;
    for (const block of this.blocks()) {
      if (block.role !== 'main') continue;
      for (const step of block.children?.length ? block.children : [block]) {
        const value = relativeIntensity(step, this.sport(), this.reference()) ?? 0;
        if (value > bestValue) {
          best = step;
          bestValue = value;
        }
      }
    }
    return best;
  });

  readonly preview = computed(() => {
    const sport = this.sport();
    const ref = this.reference();
    const rows: { label: string; value: string; detail: string }[] = [];
    for (const block of this.blocks()) {
      const group = Boolean(block.children?.length);
      for (const step of group ? (block.children ?? []) : [block]) {
        const reps = group ? `${block.repetitions} × ` : '';
        const title = group ? this.volume(step) : block.label?.trim() || ROLE_LABELS[block.role];
        rows.push({
          label: `${reps}${title}`,
          value: resolvedTarget(step, ref) ?? targetLabel(step) ?? '—',
          detail: sport === 'bike' ? this.volume(step) : `${this.volume(step)} · ≈ ${formatDuration(stepWorkSeconds(step, sport, ref))}`,
        });
        const recovery = group ? recoveryText(step) : undefined;
        if (recovery) {
          const watts = sport === 'bike' && step.recoveryIntensity ? `${Math.round((this.ftp() * step.recoveryIntensity) / 100)} W` : '—';
          rows.push({ label: 'Récupération', value: sport === 'bike' ? watts : '', detail: recovery });
        }
      }
    }
    return rows;
  });

  readonly athleteTargets = computed(() => {
    const step = this.mainStep();
    const bike = this.bike();
    return (this.athletes.data() ?? []).map((athlete) => {
      const known = bike ? athlete.ftp : athlete.css;
      const reference = bike ? (known ? `${known} W` : 'FTP manquante') : known ? `CSS ${formatSwimPace(known)}` : 'CSS manquante';
      const value = step && known ? (resolvedTarget(step, bike ? { ftp: known } : { css: known }) ?? targetLabel(step) ?? '—') : '—';
      return { id: athlete.id, initials: athlete.initials, name: athlete.name, reference, value };
    });
  });

  private loaded = false;

  constructor() {
    // Nouvelle séance : le sport vient de la route, avec une séance d'exemple à adapter.
    effect(() => {
      if (this.id() || this.loaded) return;
      const sport = this.routeSport();
      this.sport.set(sport);
      const blocks = defaultSportBlocks(sport);
      this.blocks.set(blocks);
      // Le cœur de la séance (le bloc à répéter) s'ouvre d'office.
      this.openKey.set(blocks.find((block) => block.children?.length)?.children?.[0]?.key ?? null);
      this.loaded = true;
    });

    effect(() => {
      const template = this.existing.data();
      if (!template) return;
      if (template.sport !== 'bike' && template.sport !== 'swim') {
        void this.router.navigate(['/coach/bibliotheque', template.sport === 'strength' ? 'muscu' : 'editeur', template._id], { replaceUrl: true });
        return;
      }
      this.sport.set(template.sport);
      this.name.set(template.name);
      this.description.set(template.description ?? '');
      this.expectedFeeling.set(template.expectedFeeling ?? null);
      this.pool.set(template.pool ?? '25');
      const blocks = toEditableSport(template.sportBlocks);
      this.blocks.set(blocks.length ? blocks : defaultSportBlocks(template.sport));
      this.openKey.set(null);
      this.loaded = true;
    });

    // L'aperçu part de la référence d'un athlète réel plutôt que d'une valeur arbitraire.
    effect(() => {
      const athletes = this.athletes.data() ?? [];
      const ftp = athletes.find((athlete) => athlete.ftp)?.ftp;
      const css = athletes.find((athlete) => athlete.css)?.css;
      if (ftp) this.ftp.set(ftp);
      if (css) this.css.set(css);
    });
  }

  // ---- Libellés ----

  roleLabel(block: EditableSportBlock) {
    return ROLE_LABELS[block.role];
  }

  volume(step: ApiSportStep) {
    if (this.bike()) return step.duration ? formatDuration(step.duration) : '—';
    const stroke = step.stroke ? STROKE_LABELS[step.stroke]?.toLowerCase() : '';
    return [step.distance ? formatMeters(step.distance) : '—', stroke].filter(Boolean).join(' ');
  }

  target(step: ApiSportStep) {
    const written = targetLabel(step);
    const zone = zoneOf(relativeIntensity(step, this.sport(), this.reference()), this.sport());
    return [step.intensityMode === 'ftp' || step.intensityMode === 'css' ? zone?.label : null, written].filter(Boolean).join(' · ');
  }

  resolvedHint(step: ApiSportStep) {
    const resolved = resolvedTarget(step, this.reference());
    if (!resolved) return null;
    return this.bike() ? `Puissance athlète (FTP ${this.ftp()} W) : ${resolved}` : `Allure athlète (CSS ${formatSwimPace(this.css())}) : ${resolved}`;
  }

  shade(step: ApiSportStep) {
    return RAMP[intensityLevel(relativeIntensity(step, this.sport(), this.reference()), this.sport(), step.role) - 1];
  }

  unit(step: ApiSportStep) {
    return { ftp: '% FTP', watts: 'W', hr: '% FC max', rpe: '/10', css: '% CSS', pace: '/100 m' }[step.intensityMode ?? 'ftp'];
  }

  zoneKey(step: ApiSportStep) {
    const zone = this.zones().find((item) => item.low === step.intensityLow && item.high === step.intensityHigh);
    return zone?.key ?? '';
  }

  duration(step: Pick<ApiSportStep, 'duration'>) {
    return durationInput(step.duration);
  }

  rest(step: ApiSportStep) {
    return restInput(step.recoverySeconds, step.recoveryMode === 'sendoff');
  }

  paceValue(seconds?: number | null) {
    return seconds ? formatSwimPace(seconds) : '';
  }

  swimPace(seconds: number) {
    return formatSwimPace(seconds);
  }

  // ---- Glisser-déposer ----
  // La poignée arme le glisser : sans elle, toute la carte serait déplaçable et on ne
  // pourrait plus sélectionner le texte des champs.

  /** Carte dont la poignée est enfoncée. */
  readonly armed = signal<string | null>(null);
  readonly dragKey = signal<string | null>(null);
  private dragParent: string | null = null;
  readonly dropTarget = signal<{ key: string; after: boolean } | null>(null);

  isDrop(key: string, after: boolean) {
    const target = this.dropTarget();
    return target?.key === key && target.after === after && this.dragKey() !== key;
  }

  dragStart(event: DragEvent, key: string, parent: string | null) {
    if (this.armed() !== key) return;
    event.stopPropagation();
    this.dragKey.set(key);
    this.dragParent = parent;
    event.dataTransfer?.setData('text/plain', key);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  dragOver(event: DragEvent, key: string, parent: string | null) {
    // Une étape se déplace dans son bloc, un bloc parmi les blocs.
    if (!this.dragKey() || this.dragParent !== parent) return;
    event.preventDefault();
    event.stopPropagation();
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const after = event.clientY > box.top + box.height / 2;
    const current = this.dropTarget();
    if (current?.key !== key || current.after !== after) this.dropTarget.set({ key, after });
  }

  drop(event: DragEvent, key: string, parent: string | null) {
    const dragged = this.dragKey();
    const target = this.dropTarget();
    if (!dragged || this.dragParent !== parent || !target) return;
    event.preventDefault();
    event.stopPropagation();
    this.reorder(dragged, target.key, target.after, parent);
    this.dragEnd();
  }

  dragEnd() {
    this.dragKey.set(null);
    this.dropTarget.set(null);
    this.armed.set(null);
    this.dragParent = null;
  }

  /** Clavier : flèches haut et bas sur la poignée. */
  moveBy(event: Event, key: string, parent: string | null, delta: -1 | 1) {
    event.preventDefault();
    const list = parent ? (this.blocks().find((block) => block.key === parent)?.children ?? []) : this.blocks();
    const index = list.findIndex((item) => item.key === key);
    const target = list[index + delta];
    if (target) this.reorder(key, target.key, delta > 0, parent);
  }

  private reorder(key: string, targetKey: string, after: boolean, parent: string | null) {
    if (key === targetKey) return;
    const move = <T extends { key: string }>(list: T[]) => {
      const item = list.find((entry) => entry.key === key);
      if (!item) return list;
      const rest = list.filter((entry) => entry.key !== key);
      const index = rest.findIndex((entry) => entry.key === targetKey);
      if (index === -1) return list;
      rest.splice(after ? index + 1 : index, 0, item);
      return rest;
    };
    this.blocks.update((blocks) =>
      parent ? blocks.map((block) => (block.key === parent ? { ...block, children: move(block.children ?? []) } : block)) : move(blocks),
    );
  }

  isOpen(key: string) {
    return this.openKey() === key;
  }

  toggleOpen(key: string) {
    this.openKey.update((current) => (current === key ? null : key));
  }

  /** La ligne d'une étape fermée : cible, puis ce qui la précise. */
  summary(step: ApiSportStep, inGroup: boolean) {
    const sport = this.sport();
    return [
      this.target(step) || null,
      step.cadence?.trim() ? `${step.cadence.trim()} tr/min` : null,
      step.position === 'danseuse' ? 'en danseuse' : step.position === 'assis' ? 'assis' : null,
      sport === 'swim' && step.equipment?.length ? step.equipment.map((item) => EQUIPMENT_LABELS[item] ?? item).join(', ') : null,
      inGroup ? (recoveryText(step) ?? null) : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  modeOf(event: Event) {
    return this.value(event) as BikeMode | SwimMode;
  }

  // ---- Modification ----

  patch(key: string, parent: string | null, changes: Partial<EditableSportStep>) {
    this.blocks.update((blocks) =>
      blocks.map((block) => {
        if (parent && block.key === parent) {
          return { ...block, children: block.children?.map((child) => (child.key === key ? { ...child, ...changes } : child)) };
        }
        return !parent && block.key === key ? { ...block, ...changes } : block;
      }),
    );
  }

  setDuration(key: string, parent: string | null, event: Event) {
    this.patch(key, parent, { duration: parseMinutesInput(this.value(event)) });
  }

  setDistance(key: string, parent: string | null, event: Event) {
    const meters = Math.round(Number(this.value(event)));
    this.patch(key, parent, { distance: Number.isFinite(meters) && meters > 0 ? meters : null });
  }

  setRamp(key: string, parent: string | null, step: ApiSportStep) {
    // Une rampe part plus bas qu'elle n'arrive : on écarte les bornes si elles sont confondues.
    const low = step.intensityLow ?? 50;
    const high = step.intensityHigh && step.intensityHigh > low ? step.intensityHigh : low + 20;
    this.patch(key, parent, { ramp: true, intensityLow: low, intensityHigh: high });
  }

  setMode(key: string, parent: string | null, mode: BikeMode | SwimMode) {
    const defaults: Record<BikeMode | SwimMode, [number, number]> = {
      ftp: [88, 94],
      watts: [Math.round(this.ftp() * 0.9), Math.round(this.ftp() * 0.95)],
      hr: [80, 85],
      rpe: [6, 7],
      css: [97, 103],
      pace: [Math.round(this.css() * 0.97), Math.round(this.css() * 1.03)],
    };
    const [low, high] = defaults[mode];
    this.patch(key, parent, { intensityMode: mode, intensityLow: low, intensityHigh: high });
  }

  setZone(key: string, parent: string | null, zoneKey: string) {
    const zone = this.zones().find((item) => item.key === zoneKey);
    if (zone) this.patch(key, parent, { intensityLow: zone.low, intensityHigh: zone.high });
  }

  setBound(key: string, parent: string | null, bound: 'intensityLow' | 'intensityHigh', event: Event) {
    const parsed = Number(this.value(event).replace(',', '.'));
    this.patch(key, parent, { [bound]: Number.isFinite(parsed) && parsed > 0 ? parsed : null });
  }

  setPaceBound(key: string, parent: string | null, bound: 'intensityLow' | 'intensityHigh', event: Event) {
    this.patch(key, parent, { [bound]: parseSwimPace(this.value(event)) ?? null });
  }

  toggleEquipment(key: string, parent: string | null, step: ApiSportStep, item: string) {
    const current = step.equipment ?? [];
    this.patch(key, parent, { equipment: current.includes(item) ? current.filter((value) => value !== item) : [...current, item] });
  }

  addRecovery(key: string, parent: string | null) {
    this.patch(key, parent, this.bike() ? { recoveryMode: 'duration', recoverySeconds: 180, recoveryIntensity: 55 } : { recoveryMode: 'rest', recoverySeconds: 15 });
  }

  setSendoff(key: string, parent: string | null, step: ApiSportStep) {
    // Départ par défaut : le temps de nage plus une quinzaine de secondes, arrondi à 5 s.
    const work = stepWorkSeconds(step, 'swim', this.reference());
    this.patch(key, parent, { recoveryMode: 'sendoff', recoverySeconds: Math.ceil((work + 12) / 5) * 5 });
  }

  setRest(key: string, parent: string | null, event: Event) {
    this.patch(key, parent, { recoverySeconds: parseRestInput(this.value(event)) });
  }

  setRecoveryDuration(key: string, parent: string | null, event: Event) {
    this.patch(key, parent, { recoverySeconds: parseMinutesInput(this.value(event)) });
  }

  setRecoveryIntensity(key: string, parent: string | null, event: Event) {
    const parsed = Number(this.value(event));
    this.patch(key, parent, { recoveryIntensity: Number.isFinite(parsed) && parsed > 0 ? parsed : null });
  }

  setReps(key: string, repetitions: number) {
    this.blocks.update((blocks) => blocks.map((block) => (block.key === key ? { ...block, repetitions: Math.max(1, Math.min(60, repetitions)) } : block)));
  }

  nudgeReference(direction: 1 | -1) {
    if (this.bike()) this.ftp.update((value) => Math.max(80, Math.min(500, value + direction * 5)));
    // Une allure plus basse est plus rapide : « + » fait nager plus vite.
    else this.css.update((value) => Math.max(60, Math.min(240, value - direction)));
  }

  private insertMain(block: EditableSportBlock) {
    this.blocks.update((blocks) => {
      const cooldown = blocks.findIndex((item) => item.role === 'cooldown');
      return cooldown === -1 ? [...blocks, block] : [...blocks.slice(0, cooldown), block, ...blocks.slice(cooldown)];
    });
  }

  addStep() {
    const step = newSportStep(this.sport());
    this.insertMain(step);
    this.openKey.set(step.key);
  }

  addRepeat() {
    const repeat = newSportRepeat(this.sport());
    this.insertMain(repeat);
    this.openKey.set(repeat.children?.[0]?.key ?? null);
  }

  addWarmup() {
    const warmup = newSportWarmup(this.sport());
    this.blocks.update((blocks) => [warmup, ...blocks]);
    this.openKey.set(warmup.key);
  }

  addCooldown() {
    const cooldown = newSportCooldown(this.sport());
    this.blocks.update((blocks) => [...blocks, cooldown]);
    this.openKey.set(cooldown.key);
  }

  addChild(parentKey: string) {
    this.blocks.update((blocks) =>
      blocks.map((block) => {
        if (block.key !== parentKey) return block;
        const last = block.children?.[block.children.length - 1];
        const child = last ? { ...last, key: `${parentKey}-${Date.now()}` } : newSportChild(this.sport());
        this.openKey.set(child.key);
        return { ...block, children: [...(block.children ?? []), child] };
      }),
    );
  }

  removeBlock(index: number) {
    this.blocks.update((blocks) => blocks.filter((_, i) => i !== index));
  }

  removeChild(parentKey: string, key: string) {
    this.blocks.update((blocks) => blocks.map((block) => (block.key === parentKey ? { ...block, children: block.children?.filter((child) => child.key !== key) } : block)));
  }

  /** Changer de sport en cours de saisie mène vers l'éditeur de ce sport. */
  switchTo(sport: 'running' | 'strength' | EnduranceSport) {
    if (sport === this.sport()) return;
    if (sport === 'bike' || sport === 'swim') {
      if (this.id()) return;
      this.sport.set(sport);
      this.blocks.set(defaultSportBlocks(sport));
      void this.router.navigate(['/coach/bibliotheque', sport === 'bike' ? 'velo' : 'natation'], { replaceUrl: true });
      return;
    }
    void this.router.navigate(['/coach/bibliotheque', sport === 'strength' ? 'muscu' : 'editeur'], { replaceUrl: true });
  }

  save() {
    if (this.saving()) return;
    if (!this.name().trim()) {
      this.error.set('Donnez un nom à la séance.');
      return;
    }
    const invalid = validateSport(this.blocks(), this.sport());
    if (invalid) {
      this.error.set(invalid);
      return;
    }
    this.error.set('');
    this.saving.set(true);
    const sport = this.sport();
    const sportBlocks = this.payload();
    const total = totals(sportSegments(sportBlocks, sport));
    this.coach
      .saveTemplate(this.id() ?? null, {
        name: this.name().trim(),
        description: this.description().trim(),
        expectedFeeling: this.expectedFeeling(),
        sport,
        sessionType: sport,
        targetDistance: sport === 'swim' && total.dist ? Number((total.dist / 1000).toFixed(2)) : null,
        targetDuration: total.sec ? Math.round(total.sec / 60) : null,
        runBlocks: [],
        strengthPlan: null,
        sportBlocks,
        pool: sport === 'swim' ? this.pool() : null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          void this.router.navigate(['/coach/bibliotheque']);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.error.set(err instanceof ApiError ? err.message : "La séance n'a pas pu être enregistrée.");
        },
      });
  }

  goBack() {
    if (history.length > 1) this.location.back();
    else void this.router.navigate(['/coach/bibliotheque']);
  }

  roleOf(event: Event) {
    return this.value(event) as ApiSportStep['role'];
  }

  positionOf(event: Event) {
    return this.value(event) as ApiSportStep['position'];
  }

  value(event: Event) {
    return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }
}
