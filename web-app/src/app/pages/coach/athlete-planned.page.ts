import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

import type { ApiPlannedRunDetail } from '../../core/api-types';
import type { PlannedSessionDetail } from '../../domain/athlete.types';
import { ApiService } from '../../core/api.service';
import { formatDayLong, formatDecimal, formatHoursMinutes, formatPace } from '../../core/format';
import { load } from '../../core/load';
import { CoachService } from '../../data/coach.service';
import { totals } from '../../domain/sessions';
import { plannedToTemplatePayload } from '../../domain/templates';
import { ApiError } from '../../core/api.service';
import { ExpectedFeelingComponent, FeelingScaleComponent } from '../../ui/expected-feeling.component';
import { IconComponent } from '../../ui/icon.component';
import { IntensityLegendComponent } from '../../ui/intensity-legend.component';
import { StateViewComponent } from '../../ui/state-view.component';
import { StrengthPlanComponent } from '../../ui/strength-plan.component';
import { WorkoutProfileComponent } from '../../ui/workout-profile.component';

/** Séance planifiée d'un athlète, vue coach : le détail, plus les actions sur la séance. */
@Component({
  selector: 'tw-coach-athlete-planned',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ExpectedFeelingComponent, FeelingScaleComponent, IconComponent, IntensityLegendComponent, StateViewComponent, StrengthPlanComponent, WorkoutProfileComponent],
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
          <span class="small">{{ fiche.data()?.name || 'Fiche athlète' }}</span>
        </button>

        <div class="cols">
          <div class="col">
            <section class="hero">
              <div class="hero-left">
                <span class="overline hl">{{ dayLabel() }}</span>
                <h1 class="h1">{{ data.title }}</h1>
                <div class="chips">
                  <span class="chip chip-on-brand">
                    <tw-icon [name]="data.status === 'done' ? 'check' : 'clock'" [size]="13" [strokeWidth]="2" />
                    {{ data.status === 'done' ? 'Réalisée' : data.status === 'skipped' ? 'Passée' : 'À faire' }}
                  </span>
                  @if (data.plannedBy === 'coach') {
                    <span class="chip chip-on-brand"><tw-icon name="user" [size]="13" [strokeWidth]="2" />Planifiée par vous</span>
                  }
                </div>
                @if (data.expectedFeeling; as expected) {
                  <tw-feeling-scale class="scale" [value]="expected" />
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
                  @if (data.linkedRunId) {
                    <button class="btn btn-inverse grow" type="button" (click)="openRun(data.linkedRunId!)">Voir l'analyse</button>
                  }
                  <button class="btn btn-outline-light grow" type="button" (click)="startEdit(data)">Modifier</button>
                  <button class="btn btn-outline-light grow" type="button" (click)="remove()">Supprimer</button>
                </div>
              </div>
            </section>

            @if (editing()) {
              <section class="card card-pad">
                <div class="spread">
                  <span class="h2">Modifier la séance</span>
                  <button class="link" type="button" (click)="editing.set(false)">Annuler</button>
                </div>

                <div class="field mt">
                  <label for="edit-title">Titre</label>
                  <input id="edit-title" class="input" [value]="editTitle()" (input)="editTitle.set(value($event))" />
                </div>

                <div class="field mt-sm">
                  <label for="edit-desc">Consignes</label>
                  <textarea id="edit-desc" class="input" rows="3" [value]="editDesc()" (input)="editDesc.set(text($event))"></textarea>
                </div>

                <div class="field mt-sm">
                  <label>Difficulté attendue <span class="muted">— facultatif</span></label>
                  <tw-expected-feeling [value]="editFeeling()" (changed)="editFeeling.set($event)" />
                </div>

                @if (editError()) {
                  <p class="err small">{{ editError() }}</p>
                }

                <div class="edit-actions">
                  <span class="caption muted-3 grow">Le déroulé détaillé se modifie depuis la bibliothèque.</span>
                  <button class="btn btn-primary btn-sm" type="button" [disabled]="saving()" (click)="saveEdit()">
                    {{ saving() ? 'Enregistrement…' : 'Enregistrer' }}
                  </button>
                </div>
              </section>
            }

            @if (data.segments.length) {
              <section class="card card-pad">
                <span class="h2">Profil de séance</span>
                <div class="profile">
                  <tw-workout-profile [segments]="data.segments" [width]="700" [height]="72" />
                </div>
                <tw-intensity-legend />
                <div class="profile-totals">
                  <span class="small muted">Durée estimée {{ estimate().duration }}</span>
                  <span class="small muted">Distance estimée {{ estimate().distance }}</span>
                </div>
              </section>
            }

            @if (data.blocks.length) {
              <section class="card card-pad">
                <span class="h2">Déroulé</span>
                <div class="blocks">
                  @for (block of data.blocks; track block.key) {
                    <div class="block">
                      <div class="block-head">
                        <span class="chip chip-accent">{{ block.roleLabel }}</span>
                        @if (block.repetitions > 1) {
                          <span class="chip">{{ block.repetitions }} ×</span>
                        }
                      </div>
                      @for (step of block.steps; track step.key) {
                        <div class="step">
                          <span class="h3">{{ step.label }}</span>
                          @if (step.paceLabel) {
                            <span class="small accent-text num">{{ step.paceLabel }}</span>
                          }
                          @if (step.recoveryLabel) {
                            <span class="small muted">récup {{ step.recoveryLabel }}</span>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              </section>
            }

            @if (data.strength; as plan) {
              <section class="card card-pad">
                <span class="h2 mb">Séance de renforcement</span>
                <tw-strength-plan [plan]="plan" />
              </section>
            }
          </div>

          <div class="col">
            <section class="card card-pad">
              <span class="h2">Actions</span>
              <div class="stack gap mt">
                <button class="btn btn-ghost btn-block" type="button" [disabled]="saving()" (click)="saveToLibrary()">
                  <tw-icon name="folder" [size]="18" [strokeWidth]="2" />
                  {{ savedToLibrary() ? 'Ajoutée à la bibliothèque' : 'Sauvegarder dans ma bibliothèque' }}
                </button>
                <button class="btn btn-ghost btn-block" type="button" (click)="duplicateNextWeek()">
                  <tw-icon name="copy" [size]="18" [strokeWidth]="2" />
                  Dupliquer la semaine suivante
                </button>
                <button class="btn btn-ghost btn-block" type="button" (click)="openPlanning()">
                  <tw-icon name="calendar" [size]="18" [strokeWidth]="2" />
                  Voir le planning
                </button>
              </div>
            </section>

            @for (part of data.textPlan; track part.label) {
              <section class="card card-pad">
                <span class="h2">{{ part.label }}</span>
                <p class="body muted mt-sm">{{ part.text }}</p>
              </section>
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

      .edit-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 16px;
      }

      .mt {
        margin-top: 14px;
      }

      .mt-sm {
        margin-top: 10px;
      }

      .err {
        color: var(--danger);
        margin-top: 10px;
      }

      .scale {
        margin-top: 14px;
        max-width: 420px;
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

      .blocks {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 14px;
      }

      .block {
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .block-head {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .step {
        display: flex;
        align-items: baseline;
        gap: 10px;
      }

      .accent-text {
        color: var(--accent-ink);
        font-weight: 600;
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

      .stack.gap {
        gap: 8px;
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
export class CoachAthletePlannedPage {
  private readonly coach = inject(CoachService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly id = input.required<string>();
  readonly planId = input.required<string>();

  readonly saving = signal(false);
  readonly savedToLibrary = signal(false);

  readonly fiche = load(() => this.coach.athlete$(this.id()));
  readonly session = load(() => this.coach.athleteSession$(this.id(), this.planId(), this.fiche.data()?.physical.vma));

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

  readonly estimate = computed(() => {
    const total = totals(this.session.data()?.segments ?? []);
    return { duration: formatHoursMinutes(total.sec), distance: `${formatDecimal(total.dist / 1000, 1)} km` };
  });

  readonly editing = signal(false);
  readonly editTitle = signal('');
  readonly editDesc = signal('');
  readonly editFeeling = signal<number | null>(null);
  readonly editError = signal('');

  startEdit(data: PlannedSessionDetail) {
    this.editTitle.set(data.title);
    this.editDesc.set(data.description ?? '');
    this.editFeeling.set(data.expectedFeeling ?? null);
    this.editError.set('');
    this.editing.set(true);
  }

  /**
   * Le titre, les consignes et la difficulté se modifient ici ; le déroulé
   * détaillé reste l'affaire de la bibliothèque, qui a l'éditeur de blocs.
   */
  saveEdit() {
    if (this.saving()) return;
    this.saving.set(true);
    this.editError.set('');
    this.coach
      .updateSession(this.id(), this.planId(), {
        title: this.editTitle().trim() || undefined,
        description: this.editDesc().trim(),
        expectedFeeling: this.editFeeling(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editing.set(false);
          this.session.reload(true);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.editError.set(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
        },
      });
  }

  value(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  text(event: Event) {
    return (event.target as HTMLTextAreaElement).value;
  }

  target(sets?: number, reps?: string, weight?: number) {
    const parts: string[] = [];
    if (sets) parts.push(`${sets} séries`);
    if (reps) parts.push(`${reps} reps`);
    if (weight) parts.push(`${weight} kg`);
    return parts.join(' · ') || 'Charge libre';
  }

  /** Reprend la séance en modèle réutilisable : les allures repassent en zones de VMA. */
  saveToLibrary() {
    const data = this.session.data();
    if (!data || this.saving()) return;
    this.saving.set(true);
    this.api
      .get<ApiPlannedRunDetail>(`/api/coach/athletes/${encodeURIComponent(this.id())}/planning/${encodeURIComponent(this.planId())}`)
      .subscribe({
        next: (raw) => {
          this.coach.saveTemplate(null, plannedToTemplatePayload(raw, data.title)).subscribe({
            next: () => {
              this.saving.set(false);
              this.savedToLibrary.set(true);
            },
            error: () => this.saving.set(false),
          });
        },
        error: () => this.saving.set(false),
      });
  }

  duplicateNextWeek() {
    const data = this.session.data();
    if (!data) return;
    const target = new Date(data.date);
    target.setDate(target.getDate() + 7);
    const iso = target.toISOString().slice(0, 10);
    this.coach.duplicateSession(this.id(), this.planId(), iso).subscribe({ next: () => this.openPlanning() });
  }

  remove() {
    this.coach.deleteSession(this.id(), this.planId()).subscribe({ next: () => this.openPlanning() });
  }

  openRun(runId: string) {
    void this.router.navigate(['/coach/athletes', this.id(), 'sortie', runId]);
  }

  openPlanning() {
    void this.router.navigate(['/coach/athletes', this.id(), 'planning']);
  }

  goBack() {
    if (history.length > 1) this.location.back();
    else void this.router.navigate(['/coach/athletes', this.id()]);
  }
}
