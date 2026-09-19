import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

import { formatClock, formatDayShort, formatDecimal, formatPace } from '../../core/format';
import { load } from '../../core/load';
import { AthleteService } from '../../data/athlete.service';
import type { KmSplit } from '../../domain/athlete.types';
import type { PhaseComparison } from '../../domain/planned-vs-done';
import { totals } from '../../domain/sessions';
import { BlockListComponent } from '../../ui/block-list.component';
import { HeartRateChartComponent } from '../../ui/heart-rate-chart.component';
import { IconComponent } from '../../ui/icon.component';
import { IntensityLegendComponent } from '../../ui/intensity-legend.component';
import { PaceChartComponent } from '../../ui/pace-chart.component';
import { RouteMapComponent } from '../../ui/route-map.component';
import { StatComponent } from '../../ui/stat.component';
import { StateViewComponent } from '../../ui/state-view.component';
import { WorkoutProfileComponent } from '../../ui/workout-profile.component';
import { ZoneBarsComponent } from '../../ui/zone-bars.component';

@Component({
  selector: 'tw-run-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlockListComponent,
    HeartRateChartComponent,
    IconComponent,
    IntensityLegendComponent,
    PaceChartComponent,
    RouteMapComponent,
    StatComponent,
    StateViewComponent,
    WorkoutProfileComponent,
    ZoneBarsComponent,
  ],
  template: `
    <main class="page">
      @if (run.loading()) {
        <tw-state kind="loading" />
      } @else if (run.error()) {
        <tw-state kind="error" [message]="run.error()">
          <button class="btn btn-ghost btn-sm" (click)="run.reload()">Réessayer</button>
        </tw-state>
      } @else if (run.data(); as data) {
        <header class="head">
          <button type="button" class="back" (click)="goBack()">
            <tw-icon name="chevron-left" [size]="16" />
            <span class="small">Sorties</span>
          </button>
          <div class="title-line">
            <div class="stack min">
              <span class="small muted">{{ dayLabel() }}</span>
              <h1 class="display">{{ data.title }}</h1>
              <div class="chips">
                @if (data.fromStrava) {
                  <span class="chip chip-strava">Strava</span>
                }
                @if (data.plannedBy === 'coach' && data.coachName) {
                  <span class="chip chip-coach"><tw-icon name="user" [size]="13" [strokeWidth]="2" />Planifiée par {{ data.coachName }}</span>
                }
              </div>
            </div>
            <div class="actions">
              <button class="btn btn-ghost" type="button" (click)="openBlocks()">
                <tw-icon name="layers" [size]="18" [strokeWidth]="2" />
                {{ data.blocks.length ? 'Modifier le déroulé' : 'Détailler le déroulé' }}
              </button>
              <button class="btn btn-ghost" type="button" (click)="editing.set(!editing())">
                <tw-icon name="edit" [size]="18" [strokeWidth]="2" />
                {{ editing() ? 'Fermer' : 'Modifier' }}
              </button>
            </div>
          </div>
        </header>

        <div class="cols">
          <div class="main-col">
            <section class="card map">
              <tw-route-map [polyline]="data.polyline" [seed]="seedOf(data.id)" [height]="360" />
            </section>

            <section class="card stats-card">
              <div class="stats">
                <tw-stat label="Distance" [value]="data.distanceKm ? dec(data.distanceKm) : '—'" unit="km" />
                <tw-stat label="Durée" [value]="clock(data.durationSec)" />
                <tw-stat label="Allure" [value]="data.paceSecPerKm ? pace(data.paceSecPerKm) : '—'" unit="/km" />
                <tw-stat label="FC moy." [value]="data.avgHr ?? '—'" [unit]="data.avgHr ? 'bpm' : ''" />
                <tw-stat label="D+" [value]="data.elevationGain ?? '—'" [unit]="data.elevationGain ? 'm' : ''" />
                <tw-stat label="Ressenti" [value]="data.feeling ?? '—'" [unit]="data.feeling ? '/10' : ''" />
              </div>
            </section>

            @if (data.splits.length > 1) {
              <section class="card card-pad">
                <div class="spread mb">
                  <span class="h2">Allure</span>
                  @if (splitTrend(); as trend) {
                    <span class="chip" [class.chip-done]="trend.negative">
                      <tw-icon [name]="trend.negative ? 'trending-down' : 'trending-up'" [size]="13" [strokeWidth]="2" />
                      {{ trend.label }}
                    </span>
                  }
                </div>
                <tw-pace-chart [splits]="data.splits" [height]="240" />

                <span class="block-title">Par kilomètre</span>
                <div class="splits">
                  @for (column of splitColumns(); track $index) {
                    <div class="split-table">
                      <span class="overline muted-3 th">Km</span>
                      <span class="overline muted-3 th">Allure</span>
                      <span class="overline muted-3 th right">FC</span>
                      <span class="overline muted-3 th right">D+</span>
                      @for (split of column; track split.km) {
                        <span class="td num muted-3">{{ split.km }}</span>
                        <span class="td num strong">{{ pace(split.paceSecPerKm) }} /km</span>
                        <span class="td num right muted">{{ split.avgHr ? split.avgHr + ' bpm' : '—' }}</span>
                        <span class="td num right muted">{{ elevation(split) }}</span>
                      }
                    </div>
                  }
                </div>
              </section>
            }

            @if (data.planned; as planned) {
              <section class="card card-pad">
                <div class="spread top mb">
                  <span class="h2">Prévu / réalisé</span>
                  <span class="chip" [class.chip-done]="onTarget(planned.phases)" [class.chip-warn]="!onTarget(planned.phases)">
                    {{ verdict(planned.phases) }}
                  </span>
                </div>
                @if (planned.title) {
                  <p class="small muted mb">Séance prévue : {{ planned.title }}</p>
                }

                <div class="profiles">
                  <div class="profile-row">
                    <span class="caption muted lbl">Prévu</span>
                    <tw-workout-profile [segments]="planned.segments" [height]="44" [totalSeconds]="scale()" />
                  </div>
                  <div class="profile-row">
                    <span class="caption muted lbl">Réalisé</span>
                    <tw-workout-profile [segments]="data.segments" [height]="44" [totalSeconds]="scale()" />
                  </div>
                </div>

                <div class="phases">
                  @for (phase of planned.phases; track phase.role) {
                    <div class="phase">
                      <span class="overline">{{ phase.label }}</span>
                      <div class="phase-line">
                        <span class="side muted">
                          @if (phase.planned; as side) {
                            <span class="num">{{ side.volume }}</span>
                            @if (side.paceLabel) {
                              <span class="num"> · {{ side.paceLabel }}</span>
                            }
                          } @else {
                            <span>Non prévu</span>
                          }
                        </span>
                        <tw-icon name="arrow-right" [size]="14" [strokeWidth]="2" />
                        <span class="side strong">
                          @if (phase.done; as side) {
                            <span class="num">{{ side.volume }}</span>
                            @if (side.paceLabel) {
                              <span class="num"> · {{ side.paceLabel }}</span>
                            }
                          } @else {
                            <span>Pas fait</span>
                          }
                        </span>
                        <span class="gaps">
                          @if (phase.volumeGap) {
                            <span class="chip">{{ phase.volumeGap }}</span>
                          }
                          @if (phase.paceGap) {
                            <span class="chip" [class.chip-done]="phase.ok" [class.chip-warn]="!phase.ok">{{ phase.paceGap }}</span>
                          }
                        </span>
                      </div>
                    </div>
                  }
                </div>

                <div class="mt">
                  <tw-intensity-legend />
                </div>
              </section>
            }

            @if (data.blocks.length) {
              <section class="card card-pad">
                <div class="spread top mb">
                  <span class="h2">Déroulé réalisé</span>
                  <div class="head-actions">
                    @if (data.blocksAuto) {
                      <span class="chip"><tw-icon name="zap" [size]="13" [strokeWidth]="2" />Reconstruit depuis les tours</span>
                    }
                    @if (data.fromStrava) {
                      <button class="btn btn-ghost btn-sm" type="button" [disabled]="rebuilding()" (click)="rebuild()">
                        <tw-icon name="refresh" [size]="16" [strokeWidth]="2" />
                        {{ rebuilding() ? 'Analyse…' : 'Relancer la détection' }}
                      </button>
                    }
                  </div>
                </div>
                <tw-workout-profile [segments]="data.segments" [height]="64" />
                <tw-block-list [blocks]="data.blocks" />
                <p class="caption muted rec">
                  Les tours enregistrés par ta montre donnent cette structure. « Modifier le déroulé » si elle ne correspond pas à ce que tu as fait.
                </p>
              </section>
            }

            @if (hasHeartRate()) {
              <section class="card card-pad">
                <div class="spread top mb">
                  <span class="h2">Fréquence cardiaque</span>
                  <div class="hr-stats">
                    <tw-stat label="Moyenne" [value]="data.avgHr ?? '—'" unit="bpm" />
                    <tw-stat label="Max" [value]="data.maxHr ?? '—'" unit="bpm" />
                    <tw-stat label="Min" [value]="data.minHr ?? '—'" unit="bpm" />
                  </div>
                </div>
                <tw-heart-rate-chart [splits]="data.splits" [height]="250" />
              </section>
            }
          </div>

          <aside class="side">
            @if (data.paceZones.length) {
              <section class="card card-pad">
                <span class="h2">Zones d'allure</span>
                <tw-zone-bars [zones]="data.paceZones" />
              </section>
            }

            <section class="card card-pad">
              <div class="spread mb-lg">
                <span class="h2">Ressenti</span>
                <div class="feel-value">
                  <span class="num">{{ feeling() ?? '—' }}</span>
                  <span class="small muted">/10</span>
                </div>
              </div>
              <input
                class="slider"
                type="range"
                min="1"
                max="10"
                [value]="feeling() ?? 5"
                (input)="onFeeling($event)"
                (change)="saveFeeling()"
                aria-label="Ressenti de la sortie"
              />
              <div class="spread">
                <span class="caption muted">Épuisant</span>
                <span class="caption muted">Excellent</span>
              </div>
            </section>

            <section class="card card-pad">
              <span class="h2">Notes</span>
              @if (editing()) {
                <textarea class="input notes" rows="4" [value]="notes()" (input)="notes.set(asString($event))"></textarea>
                <button class="btn btn-primary btn-sm btn-block mt" type="button" [disabled]="savingNotes()" (click)="saveNotes()">
                  {{ savingNotes() ? 'Enregistrement…' : 'Enregistrer' }}
                </button>
              } @else {
                <p class="body muted mt-sm">{{ data.notes || 'Aucune note pour cette sortie.' }}</p>
              }
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
        gap: 24px;
      }

      .back {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--text2);
        font-weight: 500;
        margin-bottom: 10px;
      }

      .back:hover {
        color: var(--ink);
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

      .actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
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

      .map {
        padding: 8px;
      }


      .stats-card {
        padding: 18px 20px;
      }

      .profiles {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .profile-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .lbl {
        width: 56px;
        flex-shrink: 0;
      }

      .profile-row tw-workout-profile {
        flex: 1;
        min-width: 0;
      }

      .phases {
        display: flex;
        flex-direction: column;
        margin-top: 16px;
      }

      .phase {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 10px 0;
      }

      .phase + .phase {
        border-top: 1px solid var(--border);
      }

      .phase-line {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .side {
        font-size: 14px;
        line-height: 21px;
      }

      .side.muted {
        color: var(--text2);
      }

      .side.strong {
        font-weight: 600;
      }

      .gaps {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-left: auto;
      }

      .mt {
        margin-top: 14px;
      }

      .mb {
        margin-bottom: 10px;
      }

      .rec {
        margin: 0;
      }

      .head-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 12px;
      }

      .mb {
        margin-bottom: 10px;
      }

      .mb-lg {
        margin-bottom: 14px;
      }

      .spread.top {
        align-items: flex-start;
      }

      .hr-stats {
        display: flex;
        align-items: center;
        gap: 28px;
      }

      .block-title {
        font-size: 14px;
        line-height: 20px;
        font-weight: 600;
        display: block;
        margin: 20px 0 10px;
      }

      .splits {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 28px;
      }

      .split-table {
        display: grid;
        grid-template-columns: 32px minmax(0, 1fr) 72px 56px;
        column-gap: 8px;
        align-items: center;
      }

      .th {
        padding: 0 0 8px;
      }

      .right {
        text-align: right;
        justify-content: flex-end;
      }

      .td {
        height: 30px;
        display: flex;
        align-items: center;
        border-top: 1px solid var(--border);
        font-size: 13px;
      }

      .td.strong {
        font-weight: 500;
        color: var(--ink);
        white-space: nowrap;
      }

      .feel-value {
        display: flex;
        align-items: baseline;
        gap: 2px;
      }

      .feel-value .num {
        font-size: 20px;
        font-weight: 600;
      }

      .slider {
        width: 100%;
        accent-color: var(--brand);
        margin: 0 0 8px;
      }

      .notes {
        margin-top: 8px;
      }

      .mt {
        margin-top: 10px;
      }

      .mt-sm {
        margin-top: 6px;
      }
    `,
  ],
})
export class RunDetailPage {
  private readonly athlete = inject(AthleteService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly id = input.required<string>();

  readonly editing = signal(false);
  readonly savingNotes = signal(false);
  private readonly feelingOverride = signal<number | null>(null);
  readonly notes = signal('');

  readonly run = load(() => this.athlete.runDetail$(this.id()));

  readonly feeling = computed(() => this.feelingOverride() ?? this.run.data()?.feeling ?? null);

  readonly dayLabel = computed(() => {
    const data = this.run.data();
    if (!data) return '';
    return data.startTime ? `${formatDayShort(data.date)} · ${data.startTime}` : formatDayShort(data.date);
  });

  readonly hasHeartRate = computed(() => (this.run.data()?.splits ?? []).some((split) => typeof split.avgHr === 'number'));

  /** Les kilomètres se lisent en deux colonnes : une seule ferait défiler la page pour rien. */
  readonly splitColumns = computed(() => {
    const splits = this.run.data()?.splits ?? [];
    if (!splits.length) return [];
    const half = Math.ceil(splits.length / 2);
    return splits.length > 6 ? [splits.slice(0, half), splits.slice(half)] : [splits];
  });

  readonly splitTrend = computed(() => {
    const splits = this.run.data()?.splits ?? [];
    if (splits.length < 4) return null;
    const half = Math.floor(splits.length / 2);
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const first = mean(splits.slice(0, half).map((split) => split.paceSecPerKm));
    const second = mean(splits.slice(half).map((split) => split.paceSecPerKm));
    const delta = Math.round(second - first);
    if (Math.abs(delta) < 3) return { negative: false, label: 'Allure régulière' };
    return delta < 0
      ? { negative: true, label: `Negative split · ${delta} s/km` }
      : { negative: false, label: `Positive split · +${delta} s/km` };
  });

  constructor() {
    // Les notes enregistrées servent de point de départ à l'édition, dès qu'elles arrivent.
    effect(() => {
      const loaded = this.run.data()?.notes;
      if (loaded && !this.notes()) this.notes.set(loaded);
    });
  }

  dec(value: number) {
    return formatDecimal(value, 1);
  }

  clock(seconds: number) {
    return seconds ? formatClock(seconds) : '—';
  }

  pace(value: number) {
    return formatPace(value);
  }

  elevation(split: KmSplit) {
    if (split.elevation == null) return '—';
    return `${split.elevation > 0 ? '+' : ''}${Math.round(split.elevation)} m`;
  }

  /** Déroulé réalisé : ce que l'athlète a vraiment fait, bloc par bloc. */
  openBlocks() {
    void this.router.navigate(['/sorties', this.id(), 'deroule']);
  }

  /** Même graine que dans la liste : une sortie sans GPS garde le même aperçu dessiné. */
  seedOf(id: string) {
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 97;
    return hash + 1;
  }

  readonly rebuilding = signal(false);

  /** Relance la détection : utile après un rapprochement, ou quand elle s'est trompée. */
  rebuild() {
    if (this.rebuilding()) return;
    this.rebuilding.set(true);
    this.athlete.rebuildRunBlocks(this.id()).subscribe({
      next: () => {
        this.rebuilding.set(false);
        this.run.reload(true);
      },
      error: () => this.rebuilding.set(false),
    });
  }

  /** Même échelle de temps pour les deux profils : la comparaison n'a de sens qu'ainsi. */
  readonly scale = computed(() => {
    const data = this.run.data();
    if (!data?.planned) return undefined;
    return Math.max(totals(data.planned.segments).sec, totals(data.segments).sec) || undefined;
  });

  onTarget(phases: PhaseComparison[]) {
    return phases.every((phase) => phase.ok);
  }

  verdict(phases: PhaseComparison[]) {
    const off = phases.filter((phase) => !phase.ok).length;
    if (!off) return 'Séance respectée';
    return off > 1 ? `${off} écarts notables` : '1 écart notable';
  }

  goBack() {
    if (history.length > 1) this.location.back();
    else void this.router.navigate(['/sorties']);
  }

  onFeeling(event: Event) {
    this.feelingOverride.set(Number((event.target as HTMLInputElement).value));
  }

  saveFeeling() {
    const value = this.feeling();
    if (value == null) return;
    this.athlete.saveRunFeeling(this.id(), value).subscribe();
  }

  saveNotes() {
    this.savingNotes.set(true);
    this.athlete.saveRunNotes(this.id(), this.notes()).subscribe({
      next: () => {
        this.savingNotes.set(false);
        this.editing.set(false);
        this.run.reload(true);
      },
      error: () => this.savingNotes.set(false),
    });
  }

  asString(event: Event) {
    return (event.target as HTMLTextAreaElement).value;
  }
}
