import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { ApiError } from '../../core/api.service';
import { load } from '../../core/load';
import { ChatService } from '../../data/chat.service';
import { CoachService } from '../../data/coach.service';
import { FORM_STATE_STYLE, fmt, formHeadline, paceLabel, signed } from '../../domain/form';
import type { ApiAthleteForm, ApiFormExercise, FormCue, FormState } from '../../domain/form';
import { AvatarComponent } from '../../ui/avatar.component';
import { FeelingChartComponent, LoadChartComponent, SparklineComponent, StackChartComponent, TrendChartComponent } from '../../ui/form-charts.component';
import type { LineSeries } from '../../ui/form-charts.component';
import { IconComponent } from '../../ui/icon.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { StateViewComponent } from '../../ui/state-view.component';

const PERIODS = [
  { weeks: 4, label: '4 semaines' },
  { weeks: 8, label: '8 semaines' },
  { weeks: 13, label: '3 mois' },
  { weeks: 26, label: '6 mois' },
];

type Sport = 'run' | 'strength';

/** Les jauges et courbes « intensité » : plus c'est intense, plus c'est foncé (clair en sombre). */
const ZONE_COLORS = ['var(--accent-soft)', 'var(--accent)', 'var(--accent-ink)'];
const EXERCISE_COLORS = ['var(--ink)', 'var(--accent)', 'var(--accent-ink)'];

/**
 * Stats : la forme de chaque athlète, pour planifier ses prochaines séances.
 *
 * À gauche, les athlètes triés par forme (ceux qui ont besoin qu'on s'occupe
 * d'eux d'abord) et ce qui attend une réponse (demandes, invitations). À
 * droite, l'athlète choisi : sa forme du moment, des repères pour la semaine
 * prochaine, et les graphiques qui les justifient, par sport.
 */
@Component({
  selector: 'tw-coach-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    FeelingChartComponent,
    IconComponent,
    LoadChartComponent,
    PageHeaderComponent,
    RouterLink,
    SparklineComponent,
    StackChartComponent,
    StateViewComponent,
    TrendChartComponent,
  ],
  template: `
    <main class="page">
      <tw-page-header title="Stats" subtitle="La forme de chaque athlète, pour planifier ses prochaines séances.">
        <div class="segmented">
          @for (option of periods; track option.weeks) {
            <button type="button" class="seg" [class.on]="weeks() === option.weeks" (click)="weeks.set(option.weeks)">{{ option.label }}</button>
          }
        </div>
      </tw-page-header>

      @if (home.loading() && !home.data()) {
        <tw-state kind="loading" />
      } @else if (home.error()) {
        <tw-state kind="error" [message]="home.error()" />
      } @else {
        <div class="layout">
          <!-- ======= Colonne de gauche : les athlètes, et ce qui attend ======= -->
          <div class="side">
            <section class="card list">
              <div class="list-head">
                <span class="h2">Athlètes</span>
              </div>
              <label class="search">
                <tw-icon name="search" [size]="16" />
                <input type="search" placeholder="Rechercher un athlète" [value]="query()" (input)="query.set($any($event.target).value)" />
              </label>
              <span class="caption muted-3 sort">{{ athletes().length }} athlète{{ athletes().length > 1 ? 's' : '' }} · triés par forme</span>
              @for (athlete of shownAthletes(); track athlete.id) {
                <button type="button" class="athlete" [class.on]="athlete.id === selectedId()" (click)="select(athlete.id)">
                  <tw-avatar [initials]="athlete.initials" [size]="34" />
                  <span class="stack grow who">
                    <span class="h3 truncate">{{ athlete.name }}</span>
                    <span class="caption muted-3">{{ athlete.sportsLabel }}</span>
                  </span>
                  <span class="chip" [class]="stateStyle(athlete.state).chip">{{ athlete.stateLabel }}</span>
                </button>
              } @empty {
                <p class="small muted pad">
                  {{ athletes().length ? 'Aucun athlète ne correspond.' : 'Aucun athlète suivi pour l’instant.' }}
                </p>
              }
            </section>

            @if (requests().length || pending().length) {
              <section class="card todo">
                <div class="list-head"><span class="h2">À traiter</span></div>
                @for (request of requests(); track request.id) {
                  <div class="todo-row">
                    <tw-avatar [initials]="request.initials" [size]="32" />
                    <span class="stack grow">
                      <span class="h3 truncate">{{ request.name }}</span>
                      <span class="caption muted-3 truncate">Demande · {{ request.offer }}</span>
                    </span>
                    <button class="icon-btn ok" type="button" [disabled]="busy()" (click)="respond(request.id, true)" aria-label="Accepter">
                      <tw-icon name="check" [size]="16" [strokeWidth]="2" />
                    </button>
                    <button class="icon-btn" type="button" [disabled]="busy()" (click)="respond(request.id, false)" aria-label="Refuser">
                      <tw-icon name="close" [size]="16" />
                    </button>
                  </div>
                }
                @for (invitation of pending(); track invitation.id) {
                  <div class="todo-row">
                    <tw-avatar [initials]="invitation.initials" tone="subtle" [size]="32" />
                    <span class="stack grow">
                      <span class="h3 truncate">{{ invitation.name }}</span>
                      <span class="caption muted-3 truncate">{{ invitation.sentLabel }}</span>
                    </span>
                    <span class="chip chip-warn">Invitation</span>
                  </div>
                }
              </section>
            }
          </div>

          <!-- ======= L'athlète choisi ======= -->
          <div class="main">
            @if (selected(); as athlete) {
              <section class="card who-card">
                <tw-avatar [initials]="athlete.initials" [size]="48" />
                <div class="stack grow">
                  <div class="name-line">
                    <span class="name">{{ athlete.name }}</span>
                    @if (data(); as f) {
                      <span class="chip" [class]="stateStyle(f.form.state).chip">{{ stateStyle(f.form.state).label }}</span>
                    }
                  </div>
                  @if (data()?.goal; as goal) {
                    <span class="small muted goal"><tw-icon name="flag" [size]="15" />{{ goal.name }} · {{ daysLabel(goal.daysLeft) }}</span>
                  } @else {
                    <span class="small muted">Pas de course au programme.</span>
                  }
                </div>
                @if (data(); as f) {
                  @if (f.sports.run && f.sports.strength) {
                    <div class="segmented">
                      <button type="button" class="seg" [class.on]="sport() === 'run'" (click)="sportChoice.set('run')"><tw-icon name="run" [size]="16" />Course</button>
                      <button type="button" class="seg" [class.on]="sport() === 'strength'" (click)="sportChoice.set('strength')"><tw-icon name="dumbbell" [size]="16" />Muscu</button>
                    </div>
                  }
                }
                <a class="btn btn-ghost btn-sm" [routerLink]="['/coach/athletes', athlete.id]"><tw-icon name="user" [size]="16" />Fiche athlète</a>
              </section>

              @if (formLoading() && !data()) {
                <tw-state kind="loading" />
              } @else if (formError()) {
                <tw-state kind="error" [message]="formError()" />
              } @else if (data(); as f) {
                <div class="top">
                  <!-- Forme du moment -->
                  <section class="verdict">
                    <div class="spread">
                      <span class="overline hl">Forme du moment</span>
                      <span class="caption on-brand-3">Charge des 7 derniers jours</span>
                    </div>
                    <span class="verdict-title">{{ headline().title }}</span>
                    <p class="verdict-text">{{ headline().sentence }}</p>
                    @if (f.form.position != null) {
                      <div class="gauge">
                        <div class="gauge-bar">
                          <span style="flex: 22" class="z1"></span><span style="flex: 36" class="z2"></span><span style="flex: 24" class="z3"></span><span style="flex: 18" class="z4"></span>
                          <span class="cursor" [style.left.%]="f.form.position * 100"></span>
                        </div>
                        <div class="gauge-labels">
                          <span style="flex: 22">Reposé</span><span style="flex: 36">Dans la zone</span><span style="flex: 24">Chargé</span><span style="flex: 18">Surmené</span>
                        </div>
                      </div>
                    }
                    <div class="grow"></div>
                    <div class="metrics">
                      @for (m of metrics(); track m.label) {
                        <div class="metric">
                          <span class="caption on-brand-2">{{ m.label }}</span>
                          <span class="metric-value num">{{ m.value }}<span class="metric-unit">{{ m.unit }}</span></span>
                          <span class="caption" [class.bad]="m.bad" [class.good]="!m.bad">{{ m.delta }}</span>
                        </div>
                      }
                    </div>
                  </section>

                  <!-- Repères -->
                  <section class="card card-pad cues">
                    <span class="h2">{{ sport() === 'run' ? 'Repères pour la semaine prochaine' : 'Repères pour la prochaine séance' }}</span>
                    <span class="small muted">{{ cueSubtitle() }}</span>
                    <div class="cue-list">
                      @for (cue of cues(); track cue.title) {
                        <div class="cue">
                          <span class="cue-icon" [class]="cue.kind">
                            <tw-icon [name]="cueIcon(cue)" [size]="16" [strokeWidth]="2" />
                          </span>
                          <span class="stack">
                            <span class="h3">{{ cue.title }}</span>
                            <span class="small muted">{{ cue.detail }}</span>
                          </span>
                        </div>
                      } @empty {
                        <p class="small muted">{{ noCueText() }}</p>
                      }
                    </div>
                    <div class="grow"></div>
                    <div class="cue-actions">
                      <a class="btn btn-primary btn-sm grow" [routerLink]="['/coach/athletes', athlete.id, 'planning']"><tw-icon name="calendar" [size]="16" />Planifier la semaine</a>
                      <button type="button" class="btn btn-ghost btn-sm" [disabled]="opening()" (click)="write(athlete.id)"><tw-icon name="chat" [size]="16" />Écrire à {{ athlete.firstName }}</button>
                    </div>
                    <p class="caption muted-3 note"><tw-icon name="info" [size]="14" />Repères calculés sur ses 4 dernières semaines. Rien n’est modifié sans vous.</p>
                  </section>
                </div>

                @if (sport() === 'run') {
                  <!-- Charge -->
                  <section class="card card-pad">
                    <div class="chart-head">
                      <span class="stack">
                        <span class="h2">Charge d’entraînement</span>
                        <span class="small muted">Durée × intensité de chaque séance (course et muscu), par semaine.</span>
                      </span>
                      <span class="legend">
                        <span class="leg"><span class="sw" style="background: var(--accent)"></span>Réalisé</span>
                        <span class="leg"><span class="sw hatch"></span>Prévu</span>
                        <span class="leg"><span class="ln" style="background: var(--ink)"></span>Charge habituelle</span>
                        <span class="leg"><span class="sw band"></span>Zone de progression</span>
                      </span>
                    </div>
                    <tw-load-chart class="chart" [weeks]="f.load.weeks" [remaining]="f.load.currentRemaining" [next]="f.load.next" />
                    @if (loadNote(); as note) {
                      <div class="note-box" [class.warn]="note.warn"><tw-icon name="info" [size]="16" /><span>{{ note.text }}</span></div>
                    }
                  </section>

                  <div class="duo">
                    <section class="card card-pad">
                      <span class="h2">FC à allure d’endurance</span>
                      <span class="small muted">{{ hrSubtitle() }}</span>
                      <tw-trend-chart
                        class="chart"
                        [labels]="labels()"
                        [series]="hrSeries()"
                        [ref]="f.run.easyHr.baseline"
                        [refLabel]="f.run.easyHr.baseline ? 'Son habitude · ' + f.run.easyHr.baseline : ''"
                        label="FC à allure d’endurance"
                        [emptyText]="hrEmpty()" />
                      <p class="caption muted-3 foot">À allure égale, un cœur qui travaille plus est un signe classique de fatigue.</p>
                    </section>
                    <section class="card card-pad">
                      <span class="h2">Ressenti après séance</span>
                      <span class="small muted">Note de 1 à 10 donnée à la fin de chaque séance.</span>
                      <tw-feeling-chart class="chart" [points]="f.feeling.points" [average]="f.feeling.average" [from]="f.load.weeks[0].start" [to]="f.generatedAt" />
                      <span class="legend foot">
                        <span class="leg"><span class="sw" style="background: var(--success)"></span>Bonne</span>
                        <span class="leg"><span class="sw" style="background: var(--accent)"></span>Moyenne</span>
                        <span class="leg"><span class="sw" style="background: var(--warn-ink)"></span>Difficile</span>
                        <span class="leg"><span class="ln" style="background: var(--ink)"></span>Moyenne sur 7 jours</span>
                      </span>
                    </section>
                  </div>

                  <section class="card card-pad">
                    <div class="chart-head">
                      <span class="stack">
                        <span class="h2">Kilomètres par semaine</span>
                        <span class="small muted">{{ f.athlete.vma ? 'Répartis par intensité, d’après sa VMA et ses km Strava.' : 'Sans VMA renseignée, les km sont classés d’après le type de séance.' }}</span>
                      </span>
                      <span class="legend">
                        <span class="leg"><span class="sw" style="background: var(--accent-soft)"></span>Endurance</span>
                        <span class="leg"><span class="sw" style="background: var(--accent)"></span>Seuil</span>
                        <span class="leg"><span class="sw" style="background: var(--accent-ink)"></span>VMA</span>
                      </span>
                    </div>
                    <div class="km">
                      <tw-stack-chart class="chart" [labels]="labels()" [stacks]="kmStacks()" [colors]="zoneColors" [names]="['Endurance', 'Seuil', 'VMA']" unit=" km" label="Kilomètres par semaine" emptyText="Aucune sortie sur la période." />
                      <div class="facts">
                        <div class="fact"><span class="small muted">Moyenne par semaine</span><span class="h3 num">{{ fmt(f.run.km.averagePerWeek) }} km</span></div>
                        <div class="fact"><span class="small muted">Part en endurance</span><span class="h3 num">{{ f.run.km.easyShare ?? '—' }} %</span></div>
                        <div class="fact"><span class="small muted">Part intense (VMA)</span><span class="h3 num">{{ f.run.km.hardShare ?? '—' }} %</span></div>
                        <div class="fact"><span class="small muted">Plus longue sortie</span><span class="h3 num">{{ fmt(f.run.km.longest) }} km</span></div>
                      </div>
                    </div>
                  </section>
                } @else {
                  <!-- Muscu -->
                  <section class="card card-pad">
                    <div class="chart-head">
                      <span class="stack">
                        <span class="h2">Charge max estimée</span>
                        <span class="small muted">D’après la meilleure série de chaque séance (charge × répétitions, jusqu’à 10).</span>
                      </span>
                      <span class="legend">
                        @for (ex of topExercises(); track ex.id; let i = $index) {
                          <span class="leg"><span class="ln" [style.background]="exerciseColors[i]"></span>{{ ex.name }}</span>
                        }
                      </span>
                    </div>
                    <tw-trend-chart class="chart" [labels]="labels()" [series]="e1rmSeries()" unit="kg" [height]="220" label="Charge max estimée" emptyText="Pas encore assez de séances avec charges pour estimer une progression." />
                    @if (stalled().length) {
                      <div class="note-box warn">
                        <tw-icon name="info" [size]="16" />
                        <span>{{ stalledText() }}</span>
                      </div>
                    }
                  </section>

                  <div class="duo">
                    <section class="card card-pad">
                      <span class="h2">Tonnage par semaine</span>
                      <span class="small muted">Somme charge × répétitions de toutes ses séries, en tonnes.</span>
                      <tw-stack-chart class="chart" [labels]="labels()" [stacks]="tonnageStacks()" [colors]="['var(--accent)']" unit=" t" label="Tonnage par semaine" emptyText="Aucune série avec charge sur la période." [height]="190" />
                    </section>
                    <section class="card card-pad">
                      <span class="h2">Effort perçu{{ rpeExercise() ? ' · ' + rpeExercise()!.name : '' }}</span>
                      <span class="small muted">RPE de sa série la plus lourde, séance après séance.</span>
                      <tw-trend-chart
                        class="chart"
                        [labels]="labels()"
                        [series]="rpeSeries()"
                        [min]="5"
                        [max]="10"
                        [ref]="8"
                        refLabel="Au-delà : peu de marge"
                        label="Effort perçu"
                        emptyText="Aucun RPE noté sur ses séries." />
                    </section>
                  </div>

                  <section class="card card-pad">
                    <span class="h2">Exercices suivis</span>
                    <span class="small muted">Ceux qu’il ou elle a faits au moins 3 fois sur la période.</span>
                    @if (f.strength.exercises.length) {
                      <div class="table">
                        <div class="tr th">
                          <span>Exercice</span><span>Dernière série</span><span>Effort</span><span class="right">Max estimé</span><span>Évolution</span><span class="right">Tendance</span>
                        </div>
                        @for (ex of f.strength.exercises; track ex.id) {
                          <div class="tr">
                            <span class="h3 truncate">{{ ex.name }}</span>
                            <span class="small muted num">{{ lastSet(ex) }}</span>
                            <span class="small muted">{{ ex.last.rpe != null ? 'RPE ' + fmt(ex.last.rpe) : '—' }}</span>
                            <span class="h3 num right">{{ ex.current != null ? fmt(ex.current, 0) + ' kg' : '—' }}</span>
                            <tw-sparkline [values]="ex.weekly" [color]="trendColor(ex)" />
                            <span class="right"><span class="chip" [class]="trendChip(ex)">{{ trendLabel(ex) }}</span></span>
                          </div>
                        }
                      </div>
                    } @else {
                      <p class="small muted foot">Pas encore d’exercice fait 3 fois sur la période.</p>
                    }
                  </section>
                }
              }
            } @else {
              <section class="card card-pad">
                <tw-state kind="empty" icon="chart" message="Invitez un athlète pour suivre sa forme ici." />
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

      .segmented {
        display: flex;
        padding: 3px;
        border-radius: var(--r-md);
        background: var(--subtle);
        gap: 2px;
      }

      .seg {
        height: 32px;
        padding: 0 14px;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 500;
        color: var(--text2);
        display: inline-flex;
        align-items: center;
        gap: 7px;
        white-space: nowrap;
      }

      .seg.on {
        background: var(--surface);
        color: var(--ink);
        font-weight: 600;
      }

      .layout {
        display: grid;
        grid-template-columns: 300px minmax(0, 1fr);
        gap: 20px;
        align-items: start;
      }

      .side,
      .main {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }

      /* ---- Liste des athlètes ---- */
      .list,
      .todo {
        overflow: hidden;
      }

      .list-head {
        padding: 16px 16px 12px;
      }

      .search {
        margin: 0 14px 10px;
        height: 38px;
        border-radius: var(--r-md);
        border: 1px solid var(--border);
        background: var(--bg);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 12px;
        color: var(--text3);
      }

      .search input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: none;
        background: none;
        color: var(--ink);
        font: inherit;
        font-size: 13px;
      }

      .sort {
        display: block;
        padding: 0 16px 8px;
      }

      .athlete {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 11px 14px 11px 16px;
        border-top: 1px solid var(--border);
        text-align: left;
        color: var(--ink);
        background: none;
        cursor: pointer;
      }

      .athlete:hover {
        background: var(--bg);
      }

      .athlete.on {
        background: var(--accent-soft);
        box-shadow: inset 3px 0 0 var(--accent);
      }

      .who {
        min-width: 0;
      }

      .pad {
        padding: 4px 16px 16px;
        margin: 0;
      }

      .todo-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px 10px 16px;
        border-top: 1px solid var(--border);
      }

      .todo-row .stack {
        min-width: 0;
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
        color: var(--ink);
      }

      .icon-btn.ok {
        color: var(--success-ink);
        background: var(--success-soft);
      }

      /* ---- En-tête de l'athlète ---- */
      .who-card {
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .name-line {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .name {
        font-size: 20px;
        line-height: 28px;
        font-weight: 600;
      }

      .goal {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      /* ---- Forme du moment + repères ---- */
      .top {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
        gap: 20px;
      }

      .verdict {
        background: var(--brand);
        color: var(--on-brand);
        border-radius: var(--r-lg);
        padding: 22px 24px;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .hl {
        color: var(--highlight);
      }

      .on-brand-2 {
        color: var(--brand-text2);
      }

      .on-brand-3 {
        color: var(--brand-text3);
      }

      .verdict-title {
        font-size: 26px;
        line-height: 34px;
        font-weight: 600;
        letter-spacing: -0.01em;
        margin-top: 6px;
      }

      .verdict-text {
        font-size: 14px;
        line-height: 21px;
        color: rgba(255, 255, 255, 0.8);
        margin: 6px 0 0;
      }

      .gauge {
        margin-top: 20px;
      }

      .gauge-bar {
        position: relative;
        display: flex;
        gap: 3px;
        height: 8px;
      }

      .gauge-bar > span:not(.cursor) {
        border-radius: var(--r-pill);
      }

      .z1 { background: rgba(127, 211, 253, 0.35); }
      .z2 { background: rgba(110, 231, 183, 0.55); }
      .z3 { background: rgba(252, 211, 77, 0.75); }
      .z4 { background: rgba(248, 113, 113, 0.75); }

      .cursor {
        position: absolute;
        top: -5px;
        width: 18px;
        height: 18px;
        margin-left: -9px;
        border-radius: var(--r-pill);
        background: #fff;
        box-shadow: 0 0 0 3px var(--brand), 0 0 0 5px #fcd34d;
      }

      .gauge-labels {
        display: flex;
        gap: 3px;
        margin-top: 8px;
      }

      .gauge-labels span {
        font-size: 11px;
        line-height: 14px;
        color: var(--brand-text2);
        text-align: center;
        white-space: nowrap;
      }

      .metrics {
        display: flex;
        gap: 20px;
        margin-top: 18px;
        padding-top: 16px;
        border-top: 1px solid var(--brand-line);
      }

      .metric {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .metric-value {
        font-size: 22px;
        line-height: 30px;
        font-weight: 600;
      }

      .metric-unit {
        font-size: 12px;
        font-weight: 400;
        color: var(--brand-text2);
        margin-left: 4px;
      }

      .bad { color: #fcd34d; }
      .good { color: #6ee7b7; }

      .cues {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .cue-list {
        margin-top: 8px;
      }

      .cue {
        display: flex;
        gap: 12px;
        padding: 12px 0;
      }

      .cue + .cue {
        border-top: 1px solid var(--border);
      }

      .cue-icon {
        width: 30px;
        height: 30px;
        border-radius: 9px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .cue-icon.down { background: var(--warn-soft); color: var(--warn-ink); }
      .cue-icon.keep { background: var(--accent-soft); color: var(--accent-ink); }
      .cue-icon.up { background: var(--success-soft); color: var(--success-ink); }

      .cue-actions {
        display: flex;
        gap: 10px;
        margin-top: 8px;
      }

      .note {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 12px 0 0;
      }

      /* ---- Graphiques ---- */
      .chart-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }

      .card-pad > .h2 + .small {
        display: block;
        margin-top: 2px;
      }

      .chart {
        margin-top: 16px;
      }

      .legend {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 6px 14px;
        flex-shrink: 1;
      }

      .leg {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--text2);
        white-space: nowrap;
      }

      .sw {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        display: block;
      }

      .sw.hatch {
        border: 1.5px dashed var(--accent);
      }

      .sw.band {
        width: 14px;
        background: color-mix(in srgb, var(--success) 18%, transparent);
      }

      .ln {
        width: 14px;
        height: 2.5px;
        border-radius: 2px;
        display: block;
      }

      .note-box {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 12px;
        padding: 10px 12px;
        border-radius: var(--r-md);
        background: var(--subtle);
        font-size: 13px;
        line-height: 19px;
        color: var(--text2);
      }

      .note-box.warn {
        background: var(--warn-soft);
        color: var(--warn-ink);
      }

      .duo {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 20px;
      }

      .foot {
        display: flex;
        margin: 8px 0 0;
        justify-content: flex-start;
      }

      .km {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 220px;
        gap: 24px;
        align-items: center;
      }

      .facts {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .fact {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--border);
      }

      /* ---- Tableau des exercices ---- */
      .table {
        margin-top: 14px;
      }

      .tr {
        display: grid;
        grid-template-columns: minmax(0, 1.3fr) 120px 70px 90px 90px 100px;
        gap: 16px;
        align-items: center;
        padding: 10px 0;
        border-top: 1px solid var(--border);
      }

      .tr.th {
        border-top: 0;
        padding-top: 0;
        font-size: 12px;
        font-weight: 500;
        color: var(--text3);
      }

      .right {
        text-align: right;
        justify-self: end;
      }

      @media (max-width: 1280px) {
        .top,
        .duo {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class CoachStatsPage {
  private readonly coach = inject(CoachService);
  private readonly chat = inject(ChatService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly periods = PERIODS;
  readonly zoneColors = ZONE_COLORS;
  readonly exerciseColors = EXERCISE_COLORS;
  readonly fmt = fmt;

  readonly weeks = signal(8);
  readonly query = signal('');
  readonly busy = signal(false);
  readonly opening = signal(false);
  private readonly selectedChoice = signal<string | null>(this.route.snapshot.queryParamMap.get('athlete'));
  readonly sportChoice = signal<Sport | null>(null);

  readonly home = load(() => this.coach.home$());
  readonly invitations = load(() => this.coach.invitations$());
  readonly summaries = load(() => this.coach.formSummaries$());

  readonly requests = computed(() => this.home.data()?.requests ?? []);
  readonly pending = computed(() => this.invitations.data()?.pending ?? []);

  /** Les athlètes, ceux qui ont besoin qu'on s'occupe d'eux en premier. */
  readonly athletes = computed(() => {
    const byId = new Map((this.summaries.data() ?? []).map((s) => [s.athleteId, s]));
    return (this.home.data()?.athletes ?? [])
      .map((athlete) => {
        const summary = byId.get(athlete.id);
        const state: FormState = summary?.state ?? 'unknown';
        const sports = [summary?.sports.run && 'Course', summary?.sports.strength && 'Muscu'].filter(Boolean).join(' · ');
        return {
          ...athlete,
          firstName: athlete.name.split(' ')[0],
          state,
          stateLabel: state === 'inactive' && summary?.daysSinceActivity != null ? `Inactif · ${summary.daysSinceActivity} j` : FORM_STATE_STYLE[state].label,
          sportsLabel: sports || 'Rien sur 4 semaines',
        };
      })
      .sort((a, b) => FORM_STATE_STYLE[a.state].order - FORM_STATE_STYLE[b.state].order || a.name.localeCompare(b.name));
  });

  readonly shownAthletes = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.athletes().filter((a) => a.name.toLowerCase().includes(q)) : this.athletes();
  });

  readonly selectedId = computed(() => {
    const list = this.athletes();
    const choice = this.selectedChoice();
    return list.find((a) => a.id === choice)?.id ?? list[0]?.id ?? null;
  });

  readonly selected = computed(() => this.athletes().find((a) => a.id === this.selectedId()) ?? null);

  // ---- Détail de l'athlète choisi
  readonly data = signal<ApiAthleteForm | null>(null);
  readonly formLoading = signal(false);
  readonly formError = signal('');
  private formSub: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.formSub?.unsubscribe());
    effect(() => {
      const id = this.selectedId();
      const weeks = this.weeks();
      untracked(() => this.fetchForm(id, weeks));
    });
  }

  private fetchForm(id: string | null, weeks: number) {
    this.formSub?.unsubscribe();
    if (!id) {
      this.data.set(null);
      return;
    }
    // Garder l'athlète à l'écran quand seule la période change.
    if (this.data()?.athlete.id !== id) this.data.set(null);
    this.formLoading.set(true);
    this.formError.set('');
    this.formSub = this.coach.athleteForm$(id, weeks).subscribe({
      next: (form) => {
        this.data.set(form);
        this.formLoading.set(false);
      },
      error: (err: unknown) => {
        this.formLoading.set(false);
        this.formError.set(err instanceof ApiError ? err.message : 'Chargement impossible.');
      },
    });
  }

  /** Course par défaut ; muscu si l'athlète ne fait que ça. */
  readonly sport = computed<Sport>(() => {
    const f = this.data();
    const choice = this.sportChoice();
    if (f && !f.sports.run && f.sports.strength) return 'strength';
    if (f && f.sports.run && !f.sports.strength) return 'run';
    return choice ?? 'run';
  });

  readonly labels = computed(() => this.data()?.load.weeks.map((w) => w.label) ?? []);
  readonly headline = computed(() => (this.data() ? formHeadline(this.data()!.form) : { title: '', sentence: '' }));

  readonly metrics = computed(() => {
    const f = this.data();
    if (!f) return [];
    if (this.sport() === 'run') {
      const lastHr = [...f.run.easyHr.weeks].reverse().find((w) => w.value != null)?.value ?? null;
      const ratio = f.form.ratio;
      return [
        { label: 'Charge sur 7 j', value: String(f.form.acute ?? 0), unit: 'pts', delta: ratio != null ? `${signed(Math.round((ratio - 1) * 100), 0)} % vs habitude` : 'habitude inconnue', bad: ratio != null && ratio > 1.3 },
        { label: 'FC en endurance', value: lastHr != null ? String(lastHr) : '—', unit: 'bpm', delta: f.run.easyHr.drift != null ? `${signed(f.run.easyHr.drift)} vs habitude` : 'pas de mesure', bad: (f.run.easyHr.drift ?? 0) >= 4 },
        { label: 'Ressenti', value: fmt(f.feeling.now), unit: '/10', delta: f.feeling.now != null && f.feeling.before != null ? `${signed(f.feeling.now - f.feeling.before)} vs avant` : 'sur 7 jours', bad: f.form.signals.includes('feeling') },
      ];
    }
    const tonnage = f.strength.tonnage7d;
    const avg = f.strength.tonnageAverage;
    const pct = avg ? Math.round(((tonnage - avg) / avg) * 100) : null;
    const flat = f.strength.exercises.filter((e) => e.trend?.direction !== 'up').length;
    return [
      { label: 'Tonnage sur 7 j', value: fmt(tonnage / 1000), unit: 't', delta: pct != null ? `${signed(pct, 0)} % vs moyenne` : 'pas de moyenne', bad: pct != null && pct > 25 },
      { label: 'RPE moyen', value: fmt(f.strength.rpeNow), unit: '/10', delta: f.strength.rpeNow != null && f.strength.rpeBefore != null ? `${signed(f.strength.rpeNow - f.strength.rpeBefore)} vs avant` : 'sur 7 jours', bad: (f.strength.rpeNow ?? 0) >= 8.5 },
      { label: 'En progrès', value: String(f.strength.progressing), unit: `sur ${f.strength.exercises.length}`, delta: flat ? `${flat} stagnent ou reculent` : 'tous progressent', bad: flat > f.strength.progressing },
    ];
  });

  readonly cues = computed<FormCue[]>(() => {
    const f = this.data();
    if (!f) return [];
    return this.sport() === 'run' ? f.run.cues : f.strength.cues;
  });

  readonly cueSubtitle = computed(() => {
    const f = this.data();
    if (!f) return '';
    if (this.sport() === 'strength') return 'D’après ses dernières séances de muscu.';
    const n = f.load.next;
    return `Semaine du ${dayMonth(n.start)} · ${n.label}, ${n.sessions ? `prévue à ${n.load} pts` : 'rien de prévu'}`;
  });

  readonly noCueText = computed(() => {
    const state = this.data()?.form.state;
    if (state === 'unknown') return 'Pas encore assez d’historique pour proposer des repères.';
    if (state === 'inactive') return 'Aucune activité récente : un message pour reprendre contact ?';
    return 'Rien à signaler : le planning prévu reste dans sa zone de progression.';
  });

  readonly loadNote = computed(() => {
    const f = this.data();
    if (!f) return null;
    const n = f.load.next;
    if (n.high == null) return { warn: false, text: 'La zone de progression apparaît après 4 semaines d’historique.' };
    if (!n.sessions) return { warn: false, text: `Rien de planifié en ${n.label} pour l’instant. Zone de progression : ${n.low} à ${n.high} pts.` };
    if (n.load > n.high) return { warn: true, text: `Telle qu’elle est planifiée, la ${n.label} dépasse de ${Math.round((n.load / n.high - 1) * 100)} % le haut de la zone de progression. C’est là que le risque de blessure grimpe.` };
    if (n.low != null && n.load < n.low) return { warn: false, text: `La ${n.label} planifiée (${n.load} pts) est sous la zone de progression : semaine de récupération ?` };
    return { warn: false, text: `La ${n.label} planifiée (${n.load} pts) reste dans la zone de progression (${n.low} à ${n.high} pts).` };
  });

  readonly hrSeries = computed<LineSeries[]>(() => [{ values: this.data()?.run.easyHr.weeks.map((w) => w.value) ?? [], color: 'var(--danger)', area: true, name: 'FC médiane' }]);
  readonly hrSubtitle = computed(() => {
    const range = this.data()?.run.easyHr.paceRange;
    return range ? `FC médiane de ses km courus entre ${paceLabel(range.from)} et ${paceLabel(range.to)}/km, sur terrain plat.` : 'FC médiane de ses km courus en endurance.';
  });
  readonly hrEmpty = computed(() => {
    const f = this.data();
    if (!f?.athlete.vma) return 'Renseignez sa VMA dans sa fiche pour suivre sa FC à allure d’endurance.';
    if (!f.run.hasSplits) return 'Il faut des sorties Strava avec cardio pour ce graphique.';
    return 'Pas encore assez de km en endurance avec cardio sur la période.';
  });

  readonly kmStacks = computed(() => this.data()?.run.km.weeks.map((w) => [w.easy, w.tempo, w.hard]) ?? []);
  readonly tonnageStacks = computed(() => this.data()?.strength.tonnage.map((w) => [Math.round(w.value / 100) / 10]) ?? []);

  readonly topExercises = computed(() => (this.data()?.strength.exercises ?? []).filter((e) => e.weighted).slice(0, 3));
  readonly e1rmSeries = computed<LineSeries[]>(() => this.topExercises().map((ex, i) => ({ values: ex.weekly, color: EXERCISE_COLORS[i], dashed: i === 2, name: ex.name })));
  readonly rpeExercise = computed(() => this.topExercises().find((ex) => ex.heavyRpe.some((v) => v != null)) ?? null);
  readonly rpeSeries = computed<LineSeries[]>(() => {
    const ex = this.rpeExercise();
    return ex ? [{ values: ex.heavyRpe, color: 'var(--warn-ink)', area: true, name: 'RPE série la plus lourde' }] : [];
  });

  readonly stalled = computed(() => (this.data()?.strength.exercises ?? []).filter((e) => e.weighted && e.flatWeeks >= 3));
  readonly stalledText = computed(() => {
    const list = this.stalled();
    const names = list.map((e) => e.name.toLowerCase());
    const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}` : names[0];
    const weeks = Math.min(...list.map((e) => e.flatWeeks));
    return `${who.charAt(0).toUpperCase() + who.slice(1)} ${list.length > 1 ? 'ne progressent plus' : 'ne progresse plus'} depuis ${weeks} semaines.`;
  });

  stateStyle(state: FormState) {
    return FORM_STATE_STYLE[state];
  }

  daysLabel(days: number) {
    if (days <= 0) return 'aujourd’hui';
    if (days === 1) return 'demain';
    if (days < 14) return `dans ${days} jours`;
    return `dans ${Math.round(days / 7)} semaines`;
  }

  cueIcon(cue: FormCue) {
    return cue.kind === 'down' ? 'trending-down' : cue.kind === 'up' ? 'trending-up' : 'arrow-right';
  }

  lastSet(ex: ApiFormExercise) {
    const s = ex.lastHeaviest ?? ex.last;
    return s.weight ? `${fmt(s.weight)} kg × ${s.reps}` : `PDC × ${s.reps}`;
  }

  trendLabel(ex: ApiFormExercise) {
    if (!ex.trend) return 'Nouveau';
    if (ex.trend.direction === 'flat') return 'Stagne';
    return `${signed(ex.trend.pct, 0)} %`;
  }

  trendChip(ex: ApiFormExercise) {
    return ex.trend?.direction === 'up' ? 'chip-done' : ex.trend?.direction === 'down' ? 'chip-warn' : '';
  }

  trendColor(ex: ApiFormExercise) {
    return ex.trend?.direction === 'up' ? 'var(--success-ink)' : ex.trend?.direction === 'down' ? 'var(--warn-ink)' : 'var(--text3)';
  }

  select(id: string) {
    this.selectedChoice.set(id);
    this.sportChoice.set(null);
    void this.router.navigate([], { queryParams: { athlete: id }, replaceUrl: true });
  }

  write(athleteId: string) {
    if (this.opening()) return;
    this.opening.set(true);
    this.chat.openWith$(athleteId).subscribe({
      next: (conversation) => {
        this.opening.set(false);
        void this.router.navigate(['/messages'], { queryParams: { conversation: conversation._id } });
      },
      error: () => this.opening.set(false),
    });
  }

  respond(id: string, accept: boolean) {
    if (this.busy()) return;
    this.busy.set(true);
    this.coach.respondToRequest(id, accept).subscribe({
      next: () => {
        this.busy.set(false);
        this.home.reload(true);
        this.summaries.reload(true);
      },
      error: () => this.busy.set(false),
    });
  }
}

function dayMonth(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(iso + 'T12:00:00')).replace('.', '');
}
