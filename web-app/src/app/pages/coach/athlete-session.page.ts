import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

import { formatClock, formatDayShort, formatDecimal, formatPace, paceToSeconds } from '../../core/format';
import { load } from '../../core/load';
import { SocketService } from '../../core/socket.service';
import { ChatService } from '../../data/chat.service';
import { CoachService } from '../../data/coach.service';
import { blocksToSegments } from '../../domain/run-blocks';
import { totals } from '../../domain/sessions';
import { HeartRateChartComponent } from '../../ui/heart-rate-chart.component';
import { IconComponent } from '../../ui/icon.component';
import { IntensityLegendComponent } from '../../ui/intensity-legend.component';
import { PaceChartComponent } from '../../ui/pace-chart.component';
import { StatComponent } from '../../ui/stat.component';
import { StateViewComponent } from '../../ui/state-view.component';
import { WorkoutProfileComponent } from '../../ui/workout-profile.component';
import { ZoneBarsComponent } from '../../ui/zone-bars.component';

/** Séance d'un athlète vue par le coach : ce qui était prévu, ce qui a été fait, et l'écart. */
@Component({
  selector: 'tw-coach-athlete-session',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeartRateChartComponent,
    IconComponent,
    IntensityLegendComponent,
    PaceChartComponent,
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
        <header>
          <button type="button" class="back" (click)="goBack()">
            <tw-icon name="chevron-left" [size]="16" />
            <span class="small">{{ athleteName() || 'Fiche athlète' }}</span>
          </button>
          <div class="title-line">
            <div class="stack min">
              <span class="small muted">{{ dayLabel() }}</span>
              <h1 class="display">{{ data.detail.title }}</h1>
              <div class="chips">
                <span class="chip chip-done"><tw-icon name="check" [size]="13" [strokeWidth]="2" />Réalisée</span>
                @if (data.detail.fromStrava) {
                  <span class="chip chip-strava">Strava</span>
                }
                @if (data.snapshot?.coach) {
                  <span class="chip chip-coach"><tw-icon name="user" [size]="13" [strokeWidth]="2" />Planifiée par vous</span>
                }
              </div>
            </div>
            <div class="actions">
              <button class="btn btn-ghost" type="button" [disabled]="quoting()" (click)="quoteInChat()">
                <tw-icon name="quote" [size]="18" [strokeWidth]="2" />
                {{ quoted() ? 'Citée' : 'Citer dans le chat' }}
              </button>
              <button class="btn btn-primary" type="button" (click)="openPlanning()">
                <tw-icon name="calendar" [size]="18" [strokeWidth]="2" />
                Voir le planning
              </button>
            </div>
          </div>
        </header>

        <section class="card stats-card">
          <div class="stats">
            <tw-stat label="Distance" [value]="data.detail.distanceKm ? dec(data.detail.distanceKm) : '—'" unit="km" />
            <tw-stat label="Durée" [value]="data.detail.durationSec ? clock(data.detail.durationSec) : '—'" />
            <tw-stat label="Allure moy." [value]="data.detail.paceSecPerKm ? pace(data.detail.paceSecPerKm) : '—'" unit="/km" />
            <tw-stat label="Dénivelé" [value]="data.detail.elevationGain ?? '—'" [unit]="data.detail.elevationGain ? 'm' : ''" />
            <tw-stat label="FC moy." [value]="data.detail.avgHr ?? '—'" [unit]="data.detail.avgHr ? 'bpm' : ''" />
            <tw-stat label="FC max" [value]="data.detail.maxHr ?? '—'" [unit]="data.detail.maxHr ? 'bpm' : ''" />
            <tw-stat label="Ressenti" [value]="data.detail.feeling ?? '—'" [unit]="data.detail.feeling ? '/10' : ''" />
          </div>
        </section>

        <div class="cols">
          <div class="col">
            @if (data.snapshot) {
              <section class="card card-pad">
                <span class="h2">Prévu vs réalisé</span>
                <div class="profiles">
                  <div class="profile-row">
                    <span class="caption muted lbl">Prévu</span>
                    <tw-workout-profile [segments]="plannedSegments()" [width]="560" [height]="44" [totalSeconds]="scale()" />
                  </div>
                  <div class="profile-row">
                    <span class="caption muted lbl">Réalisé</span>
                    <tw-workout-profile [segments]="data.detail.segments" [width]="560" [height]="44" [totalSeconds]="scale()" />
                  </div>
                </div>
                <div class="mt">
                  <tw-intensity-legend />
                </div>

                <div class="gaps">
                  @for (row of gapRows(); track row.label) {
                    <div class="gap-row">
                      <span class="grow body muted">{{ row.label }}</span>
                      <span class="small muted num">{{ row.planned }}</span>
                      <tw-icon name="arrow-right" [size]="14" [strokeWidth]="2" />
                      <span class="h3 num">{{ row.done }}</span>
                      @if (row.gap) {
                        <span class="chip" [class.chip-done]="row.ok" [class.chip-warn]="!row.ok">{{ row.gap }}</span>
                      }
                    </div>
                  }
                </div>
              </section>
            }

            @if (data.detail.splits.length > 1) {
              <section class="card card-pad">
                <span class="h2">Allure</span>
                <tw-pace-chart [splits]="data.detail.splits" [width]="640" [height]="210" />
              </section>
            }

            @if (hasHeartRate()) {
              <section class="card card-pad">
                <span class="h2">Fréquence cardiaque</span>
                <tw-heart-rate-chart [splits]="data.detail.splits" [width]="640" [height]="220" />
              </section>
            }

            @if (data.detail.blocks.length) {
              <section class="card card-pad">
                <div class="spread">
                  <span class="h2">Déroulé réalisé</span>
                  @if (data.detail.blocksAuto) {
                    <span class="chip">Reconstruit depuis les tours Strava</span>
                  }
                </div>
                <div class="blocks">
                  @for (block of data.detail.blocks; track block.key) {
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
                            <span class="small num accent-text">{{ step.paceLabel }}</span>
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
          </div>

          <div class="col">
            @if (data.detail.feeling || data.detail.notes) {
              <section class="card card-pad">
                <div class="spread mb">
                  <span class="h2">Ressenti</span>
                  @if (data.detail.feeling) {
                    <div class="feel"><span class="num">{{ data.detail.feeling }}</span><span class="small muted">/10</span></div>
                  }
                </div>
                @if (data.detail.feeling) {
                  <div class="track">
                    <span class="fill" [style.width.%]="(data.detail.feeling - 1) / 9 * 100"></span>
                  </div>
                }
                @if (data.detail.notes) {
                  <p class="quote">« {{ data.detail.notes }} »</p>
                }
              </section>
            }

            @if (data.detail.paceZones.length) {
              <section class="card card-pad">
                <span class="h2">Zones d'allure</span>
                <tw-zone-bars [zones]="data.detail.paceZones" />
              </section>
            }

            @if (bestEfforts().length) {
              <section class="card card-pad">
                <span class="h2">Meilleurs efforts</span>
                <div class="rows">
                  @for (effort of bestEfforts(); track effort.label) {
                    <div class="line">
                      <span class="grow body muted">{{ effort.label }}</span>
                      <span class="h3 num">{{ effort.value }}</span>
                    </div>
                  }
                </div>
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
        margin-bottom: 10px;
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
        flex-wrap: wrap;
      }

      .actions {
        display: flex;
        gap: 10px;
        flex-shrink: 0;
      }

      .stats-card {
        padding: 18px 20px;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
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

      .profiles {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 16px;
      }

      .profile-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .lbl {
        width: 64px;
        flex-shrink: 0;
      }

      .gaps {
        display: flex;
        flex-direction: column;
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1px solid var(--border);
      }

      .gap-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 0;
        color: var(--text3);
      }

      .gap-row + .gap-row {
        border-top: 1px solid var(--border);
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

      .feel {
        display: flex;
        align-items: baseline;
        gap: 2px;
      }

      .feel .num {
        font-size: 20px;
        font-weight: 600;
      }

      .track {
        height: 6px;
        border-radius: var(--r-pill);
        background: var(--subtle);
        overflow: hidden;
      }

      .fill {
        display: block;
        height: 100%;
        border-radius: var(--r-pill);
        background: var(--brand);
      }

      .quote {
        font-size: 14px;
        line-height: 21px;
        font-style: italic;
        margin-top: 14px;
        padding: 12px;
        border-radius: var(--r-md);
        background: var(--bg);
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

      .mb {
        margin-bottom: 14px;
      }

      .mt {
        margin-top: 14px;
      }
    `,
  ],
})
export class CoachAthleteSessionPage {
  private readonly coach = inject(CoachService);
  private readonly chat = inject(ChatService);
  private readonly socket = inject(SocketService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly id = input.required<string>();
  readonly runId = input.required<string>();

  readonly quoting = signal(false);
  readonly quoted = signal(false);

  readonly fiche = load(() => this.coach.athlete$(this.id()));
  readonly run = load(() => this.coach.athleteRun$(this.id(), this.runId(), this.fiche.data()?.physical.vma));

  readonly athleteName = computed(() => this.fiche.data()?.name ?? '');

  readonly dayLabel = computed(() => {
    const detail = this.run.data()?.detail;
    if (!detail) return '';
    return detail.startTime ? `${formatDayShort(detail.date)} · ${detail.startTime}` : formatDayShort(detail.date);
  });

  readonly hasHeartRate = computed(() => (this.run.data()?.detail.splits ?? []).some((split) => typeof split.avgHr === 'number'));

  /** Les deux profils se lisent à la même échelle : sinon la comparaison ment. */
  readonly scale = computed(() => {
    const data = this.run.data();
    if (!data) return undefined;
    const done = totals(data.detail.segments).sec;
    const planned = totals(this.plannedSegments()).sec;
    return Math.max(done, planned) || undefined;
  });

  readonly plannedSegments = computed(() => {
    const snapshot = this.run.data()?.snapshot;
    if (!snapshot?.runBlocks?.length) return [];
    const vma = this.fiche.data()?.physical.vma;
    // Les blocs prévus se déplient comme ceux réalisés, avec la VMA de l'athlète.
    return blocksToSegments(snapshot.runBlocks, vma);
  });

  readonly gapRows = computed(() => {
    const data = this.run.data();
    const snapshot = data?.snapshot;
    if (!data || !snapshot) return [];
    const rows: { label: string; planned: string; done: string; gap?: string; ok: boolean }[] = [];
    const detail = data.detail;

    if (snapshot.targetDistance && detail.distanceKm) {
      const gap = detail.distanceKm - snapshot.targetDistance;
      rows.push({
        label: 'Distance',
        planned: `${formatDecimal(snapshot.targetDistance, 1)} km`,
        done: `${formatDecimal(detail.distanceKm, 1)} km`,
        gap: Math.abs(gap) >= 0.1 ? `${gap > 0 ? '+' : '−'}${formatDecimal(Math.abs(gap), 1)} km` : undefined,
        ok: Math.abs(gap) <= 0.5,
      });
    }

    if (snapshot.targetDuration && detail.durationSec) {
      const gap = detail.durationSec - snapshot.targetDuration * 60;
      rows.push({
        label: 'Durée',
        planned: formatClock(snapshot.targetDuration * 60),
        done: formatClock(detail.durationSec),
        gap: Math.abs(gap) >= 60 ? `${gap > 0 ? '+' : '−'}${Math.abs(Math.round(gap / 60))} min` : undefined,
        ok: Math.abs(gap) <= 180,
      });
    }

    const plannedPace = paceToSeconds(snapshot.targetPace ?? null);
    if (plannedPace && detail.paceSecPerKm) {
      const gap = detail.paceSecPerKm - plannedPace;
      rows.push({
        label: 'Allure',
        planned: `${formatPace(plannedPace)} /km`,
        done: `${formatPace(detail.paceSecPerKm)} /km`,
        gap: Math.abs(gap) >= 3 ? `${Math.abs(Math.round(gap))} s/km plus ${gap < 0 ? 'vite' : 'lent'}` : undefined,
        ok: Math.abs(gap) <= 10,
      });
    }

    return rows;
  });

  /** Meilleur kilomètre et meilleure moitié : les repères que le coach regarde en premier. */
  readonly bestEfforts = computed(() => {
    const splits = this.run.data()?.detail.splits ?? [];
    if (splits.length < 2) return [];
    const fastest = Math.min(...splits.map((split) => split.paceSecPerKm));
    const efforts = [{ label: 'Meilleur kilomètre', value: `${formatPace(fastest)} /km` }];
    if (splits.length >= 6) {
      const half = Math.floor(splits.length / 2);
      const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
      const second = mean(splits.slice(half).map((split) => split.paceSecPerKm));
      efforts.push({ label: 'Seconde moitié', value: `${formatPace(second)} /km` });
    }
    return efforts;
  });

  dec(value: number) {
    return formatDecimal(value, 1);
  }

  clock(value: number) {
    return formatClock(value);
  }

  pace(value: number) {
    return formatPace(value);
  }

  quoteInChat() {
    const data = this.run.data();
    if (!data || this.quoting()) return;
    this.quoting.set(true);
    const detail = data.detail;
    const meta = [detail.distanceKm ? `${formatDecimal(detail.distanceKm, 1)} km` : null, formatClock(detail.durationSec)]
      .filter(Boolean)
      .join(' · ');

    this.chat.openWith$(this.id()).subscribe({
      next: (conversation) => {
        this.socket.emit('conversation:join', { conversationId: conversation._id });
        this.socket.emit('message:send', {
          conversationId: conversation._id,
          content: `À propos de « ${detail.title} »`,
          type: 'session',
          sessionRef: { kind: 'run', id: this.runId(), sport: 'running', title: detail.title, date: detail.date, meta },
        });
        this.quoting.set(false);
        this.quoted.set(true);
      },
      error: () => this.quoting.set(false),
    });
  }

  openPlanning() {
    void this.router.navigate(['/coach/athletes', this.id(), 'planning']);
  }

  goBack() {
    if (history.length > 1) this.location.back();
    else void this.router.navigate(['/coach/athletes', this.id()]);
  }
}

