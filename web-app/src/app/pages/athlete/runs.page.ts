import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { formatDayShort, formatClock, formatDecimal, formatHoursMinutes, formatPace } from '../../core/format';
import { load } from '../../core/load';
import { AthleteService } from '../../data/athlete.service';
import type { Activity, RunsPeriod } from '../../domain/athlete.types';
import { IconComponent } from '../../ui/icon.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { RouteMapComponent } from '../../ui/route-map.component';
import { StatComponent } from '../../ui/stat.component';
import { StateViewComponent } from '../../ui/state-view.component';

const PERIODS: { value: RunsPeriod; label: string }[] = [
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
];

@Component({
  selector: 'tw-athlete-runs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PageHeaderComponent, RouteMapComponent, StatComponent, StateViewComponent],
  template: `
    <main class="page">
      <tw-page-header title="Mes sorties">
        <div class="segmented">
          @for (option of periods; track option.value) {
            <button type="button" class="seg" [class.on]="period() === option.value" (click)="setPeriod(option.value)">
              {{ option.label }}
            </button>
          }
        </div>
      </tw-page-header>

      @if (runs.loading()) {
        <tw-state kind="loading" />
      } @else if (runs.error()) {
        <tw-state kind="error" [message]="runs.error()">
          <button class="btn btn-ghost btn-sm" (click)="runs.reload()">Réessayer</button>
        </tw-state>
      } @else if (runs.data(); as data) {
        <div class="cols">
          <section class="card volume">
            <div class="spread top">
              <div class="stack">
                <span class="small muted">{{ data.periodLabel }}</span>
                <div class="big">
                  <span class="num">{{ km(data.distanceKm) }}</span>
                  <span class="unit">km</span>
                </div>
              </div>
              @if (data.trendLabel) {
                <span class="chip" [class.chip-done]="data.trendUp" [class.chip-warn]="data.trendUp === false">
                  <tw-icon [name]="data.trendUp ? 'trending-up' : 'trending-down'" [size]="13" [strokeWidth]="2" />
                  {{ data.trendLabel }}
                </span>
              }
            </div>
            <div class="bars" [style.grid-template-columns]="'repeat(' + data.bars.length + ', minmax(0, 1fr))'">
              @for (bar of data.bars; track bar.offset) {
                <button type="button" class="bar-col" (click)="jumpTo(bar.offset)">
                  @if (bar.selected) {
                    <span class="bar-value num">{{ round(bar.distanceKm) }}</span>
                  }
                  <span class="bar" [class.on]="bar.selected" [style.height.px]="barHeight(bar.distanceKm)"></span>
                  <span class="bar-label" [class.on]="bar.selected">{{ bar.label }}</span>
                </button>
              }
            </div>
          </section>

          <section class="card side-stats">
            <div class="line"><tw-stat label="Sorties" [value]="data.stats.runs" /></div>
            <div class="line">
              <tw-stat label="Allure moyenne" [value]="data.stats.avgPaceSecPerKm ? pace(data.stats.avgPaceSecPerKm) : '—'" unit="/km" />
            </div>
            <div class="line"><tw-stat label="Temps total" [value]="hours(data.stats.durationSec)" /></div>
            <div class="line"><tw-stat label="Plus longue sortie" [value]="km(longest())" unit="km" /></div>
          </section>
        </div>

        <div class="list-head">
          <span class="h2">{{ data.listTitle }}</span>
        </div>

        @if (data.runs.length) {
          <div class="cards">
            @for (run of data.runs; track run.id) {
              <button type="button" class="card run" (click)="open(run)">
                <div class="preview">
                  <tw-route-map [polyline]="run.polyline" [seed]="seedOf(run.id)" [height]="150" />
                </div>
                <div class="body-part">
                  <div class="spread start">
                    <div class="stack min">
                      <span class="h3 truncate">{{ run.title }}</span>
                      <span class="small muted">{{ dayLabel(run) }}</span>
                    </div>
                    @if (run.feeling) {
                      <span class="chip">Ressenti {{ run.feeling }}/10</span>
                    }
                  </div>
                  <div class="mini">
                    @for (stat of runStats(run); track stat.label) {
                      <div class="mini-cell">
                        <span class="caption muted">{{ stat.label }}</span>
                        <div class="mini-val">
                          <span class="num">{{ stat.value }}</span>
                          @if (stat.unit) {
                            <span class="mini-unit">{{ stat.unit }}</span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </button>
            }
          </div>
        } @else {
          <div class="card card-pad">
            <tw-state kind="empty" icon="run" message="Aucune sortie sur cette période." />
          </div>
        }
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

      .segmented {
        display: flex;
        padding: 3px;
        border-radius: var(--r-md);
        background: var(--subtle);
        gap: 2px;
        width: 320px;
      }

      .seg {
        flex: 1;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 500;
        color: var(--text2);
      }

      .seg.on {
        font-weight: 600;
        color: var(--ink);
        background: var(--surface);
        box-shadow: 0 1px 2px rgba(5, 25, 35, 0.08);
      }

      .cols {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 300px;
        gap: 20px;
        align-items: start;
      }

      .volume {
        padding: 22px 24px;
      }

      .top {
        align-items: flex-end;
      }

      .big {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }

      .big .num {
        font-size: 40px;
        line-height: 48px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }

      .big .unit {
        font-size: 16px;
        font-weight: 500;
        color: var(--text2);
      }

      .bars {
        display: grid;
        gap: 12px;
        align-items: end;
        height: 170px;
        margin-top: 20px;
      }

      .bar-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        height: 170px;
      }

      .bar {
        width: 100%;
        border-radius: 6px 6px 2px 2px;
        background: color-mix(in srgb, var(--accent) 28%, var(--surface));
        min-height: 4px;
      }

      .bar.on {
        background: var(--accent);
      }

      .bar-value {
        font-size: 12px;
        font-weight: 600;
      }

      .bar-label {
        font-size: 12px;
        font-weight: 500;
        color: var(--text3);
      }

      .bar-label.on {
        font-weight: 600;
        color: var(--ink);
      }

      .side-stats {
        padding: 6px 22px;
      }

      .side-stats .line {
        padding: 14px 0;
      }

      .side-stats .line + .line {
        border-top: 1px solid var(--border);
      }

      .list-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 20px;
      }

      .run {
        overflow: hidden;
        text-align: left;
        padding: 0;
        cursor: pointer;
      }

      .run:hover {
        border-color: var(--border-strong);
      }

      .preview {
        padding: 8px 8px 0;
      }

      .preview tw-route-map {
        display: block;
      }

      .body-part {
        padding: 14px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .spread.start {
        align-items: flex-start;
        gap: 8px;
      }

      .stack.min {
        min-width: 0;
        gap: 1px;
      }

      .mini {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }

      .mini-cell {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .mini-val {
        display: flex;
        align-items: baseline;
        gap: 2px;
      }

      .mini-val .num {
        font-size: 15px;
        font-weight: 600;
      }

      .mini-unit {
        font-size: 11px;
        color: var(--text2);
      }

      @media (max-width: 1280px) {
        .cards {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `,
  ],
})
export class AthleteRunsPage {
  private readonly athlete = inject(AthleteService);
  private readonly router = inject(Router);

  readonly periods = PERIODS;
  readonly period = signal<RunsPeriod>('month');
  readonly offset = signal(0);

  readonly runs = load(() => this.athlete.runsOverview$(this.period(), this.offset()));

  readonly maxBar = computed(() => Math.max(1, ...(this.runs.data()?.bars ?? []).map((bar) => bar.distanceKm)));
  readonly longest = computed(() => Math.max(0, ...(this.runs.data()?.runs ?? []).map((run) => run.distanceKm ?? 0)));

  setPeriod(period: RunsPeriod) {
    this.period.set(period);
    this.offset.set(0);
    this.runs.reload();
  }

  jumpTo(offset: number) {
    this.offset.set(offset);
    this.runs.reload();
  }

  barHeight(value: number) {
    return Math.max(4, Math.round((value / this.maxBar()) * 118));
  }

  runStats(run: Activity) {
    return [
      { label: 'Distance', value: run.distanceKm ? formatDecimal(run.distanceKm, 1) : '—', unit: 'km' },
      { label: 'Durée', value: run.durationSec ? formatClock(run.durationSec) : '—', unit: '' },
      { label: 'Allure', value: run.paceSecPerKm ? formatPace(run.paceSecPerKm) : '—', unit: '/km' },
      { label: 'FC moy.', value: run.avgHr ?? '—', unit: run.avgHr ? 'bpm' : '' },
    ];
  }

  dayLabel(run: Activity) {
    return run.startTime ? `${formatDayShort(run.date)} · ${run.startTime}` : formatDayShort(run.date);
  }

  /** Graine stable par sortie : deux sorties sans GPS n'ont pas le même aperçu. */
  seedOf(id: string) {
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 97;
    return hash + 1;
  }

  km(value: number) {
    return formatDecimal(value, 1);
  }

  round(value: number) {
    return Math.round(value);
  }

  pace(value: number) {
    return formatPace(value);
  }

  hours(value: number) {
    return formatHoursMinutes(value);
  }

  open(run: Activity) {
    void this.router.navigate(['/sorties', run.id]);
  }
}
