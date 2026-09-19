import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { formatDecimal } from '../../core/format';
import { load } from '../../core/load';
import { CoachService } from '../../data/coach.service';
import { ATHLETE_STATUS_STYLE } from '../../domain/coach.status';
import { AvatarComponent } from '../../ui/avatar.component';
import { IconComponent } from '../../ui/icon.component';
import { StateViewComponent } from '../../ui/state-view.component';

const DAYS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];

const TRENDS: Record<'improving' | 'declining' | 'stable', { label: string; icon: string; chip: string }> = {
  improving: { label: 'En progrès', icon: 'trending-up', chip: 'chip-done' },
  declining: { label: 'En dégradation', icon: 'trending-down', chip: 'chip-warn' },
  stable: { label: 'Stable', icon: 'arrow-right', chip: '' },
};

@Component({
  selector: 'tw-coach-athlete',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, RouterLink, StateViewComponent],
  template: `
    <main class="page">
      @if (fiche.loading()) {
        <tw-state kind="loading" />
      } @else if (fiche.error()) {
        <tw-state kind="error" [message]="fiche.error()">
          <button class="btn btn-ghost btn-sm" (click)="fiche.reload()">Réessayer</button>
        </tw-state>
      } @else if (fiche.data(); as data) {
        <header>
          <a class="back" routerLink="/coach">
            <tw-icon name="chevron-left" [size]="16" />
            <span class="small">Mes athlètes</span>
          </a>
          <div class="title-line">
            <div class="who">
              <tw-avatar [initials]="data.initials" tone="accent" [size]="60" />
              <div class="stack">
                <h1 class="display">{{ data.name }}</h1>
                <span class="body muted">{{ data.sinceLabel || 'Votre athlète' }}</span>
              </div>
            </div>
            <div class="actions">
              <button class="btn btn-ghost" routerLink="/messages" [queryParams]="{ athlete: id() }">
                <tw-icon name="chat" [size]="18" [strokeWidth]="2" />
                Message
              </button>
              <button class="btn btn-primary" type="button" (click)="openPlanning()">
                <tw-icon name="calendar" [size]="18" [strokeWidth]="2" />
                Planning
              </button>
            </div>
          </div>
        </header>

        <div class="cols">
          <div class="col">
            <section class="card card-pad">
              <div class="spread">
                <div class="status">
                  <span class="status-tile" [style.background]="statusColor(data.status)">
                    <tw-icon [name]="data.status === 'green' ? 'check' : 'alert'" [size]="20" [strokeWidth]="2" />
                  </span>
                  <div class="stack">
                    <span class="caption muted">Statut de forme</span>
                    <span class="status-label">{{ statusLabel(data.status) }}</span>
                  </div>
                </div>
                <div class="trend">
                  <span class="chip" [class]="trend().chip">
                    <tw-icon [name]="trend().icon" [size]="13" [strokeWidth]="2" />
                    {{ trend().label }}
                  </span>
                  @if (data.statusSinceLabel) {
                    <span class="small muted">{{ data.statusSinceLabel }}</span>
                  }
                </div>
              </div>

              <div class="metrics">
                <div class="metric">
                  <span class="caption muted">Dernière activité</span>
                  <span class="metric-value">{{ data.lastActivityLabel }}</span>
                </div>
                <div class="metric">
                  <span class="caption muted">Sautées · 4 sem.</span>
                  <span class="metric-value num">{{ data.skippedCount }}</span>
                </div>
                <div class="metric">
                  <span class="caption muted">Ressenti moyen</span>
                  <span class="metric-value num">{{ data.avgFeeling ? dec(data.avgFeeling) : '—' }}<span class="unit">{{ data.avgFeeling ? ' /10' : '' }}</span></span>
                </div>
                <div class="metric">
                  <span class="caption muted">Volume · 7 jours</span>
                  <span class="metric-value num">{{ round(data.weeklyVolume) }}<span class="unit"> km</span></span>
                  <span class="caption muted">habituel : {{ round(data.baselineWeeklyVolume) }} km</span>
                </div>
              </div>

              <div class="weeks">
                <div class="spread">
                  <span class="caption muted">8 dernières semaines</span>
                  <div class="legend">
                    <span class="leg"><span class="dot" style="background: var(--success)"></span>En forme</span>
                    <span class="leg"><span class="dot" style="background: var(--warn)"></span>Vigilance</span>
                    <span class="leg"><span class="dot" style="background: var(--danger)"></span>Alerte</span>
                  </div>
                </div>
                <div class="bars">
                  @for (week of data.weeks; track $index) {
                    <span class="week-bar" [style.background]="week ? statusColor(week) : 'var(--border)'"></span>
                  }
                </div>
              </div>
            </section>

            <section class="card activity">
              <div class="act-head">
                <span class="h2">Activité</span>
                <span class="small muted">7 derniers jours</span>
              </div>
              <div class="act-row head">
                <span class="overline muted-3">Séance</span>
                <span class="overline muted-3">Volume</span>
                <span class="overline muted-3">Durée</span>
                <span class="overline muted-3">Ressenti</span>
                <span></span>
              </div>
              @for (activity of data.activities; track activity.id) {
                <div class="act-row">
                  <div class="who small-who">
                    <span class="tile" [class.strength]="activity.sport === 'strength'">
                      <tw-icon [name]="activity.sport === 'strength' ? 'dumbbell' : 'run'" [size]="18" />
                    </span>
                    <div class="stack">
                      <span class="h3">{{ activity.title }}</span>
                      <span class="small muted">{{ activity.dateLabel }}</span>
                    </div>
                  </div>
                  <span class="body num">{{ activity.value }}</span>
                  <span class="body num muted">—</span>
                  <span class="body num">{{ activity.feeling ? activity.feeling + ' /10' : '—' }}</span>
                  <button class="icon-btn" type="button" (click)="openActivity(activity.id, activity.sport)" aria-label="Ouvrir">
                    <tw-icon name="chevron-right" [size]="18" />
                  </button>
                </div>
              } @empty {
                <tw-state kind="empty" icon="run" message="Aucune activité récente." />
              }
            </section>
          </div>

          <div class="col">
            <section class="card card-pad">
              <span class="h2">Données physiques</span>
              <div class="specs">
                <div class="spec"><span class="caption muted">Taille</span><span class="h3">{{ data.physical.heightCm ? data.physical.heightCm + ' cm' : '—' }}</span></div>
                <div class="spec"><span class="caption muted">Poids</span><span class="h3">{{ data.physical.weightKg ? data.physical.weightKg + ' kg' : '—' }}</span></div>
                <div class="spec">
                  <span class="caption muted">VMA</span>
                  <div class="vma">
                    @if (editingVma()) {
                      <input class="vma-input num" inputmode="decimal" [value]="vmaDraft()" (input)="vmaDraft.set(value($event))" />
                      <button class="icon-btn" type="button" (click)="saveVma()" aria-label="Enregistrer la VMA">
                        <tw-icon name="check" [size]="16" [strokeWidth]="2" />
                      </button>
                    } @else {
                      <span class="h3">{{ data.physical.vma ? dec(data.physical.vma) + ' km/h' : '—' }}</span>
                      <button class="icon-btn" type="button" (click)="startVma(data.physical.vma)" aria-label="Modifier la VMA">
                        <tw-icon name="edit" [size]="16" />
                      </button>
                    }
                  </div>
                </div>
                <div class="spec"><span class="caption muted">FCmax</span><span class="h3">{{ data.physical.fcMax ? data.physical.fcMax + ' bpm' : '—' }}</span></div>
              </div>
            </section>

            <section class="card card-pad">
              <span class="h2">Profil sportif</span>
              <span class="sub">Course à pied</span>
              <div class="rows">
                <div class="line"><span class="grow body muted">Niveau</span><span class="h3">{{ data.running.level ?? '—' }}</span></div>
                <div class="line"><span class="grow body muted">Fréquence</span><span class="h3">{{ data.running.frequency ? data.running.frequency + ' séances/sem.' : '—' }}</span></div>
                <div class="line"><span class="grow body muted">Blessures</span><span class="h3 right">{{ data.running.injuries || 'Aucune' }}</span></div>
              </div>

              @if (data.competition; as competition) {
                <div class="comp">
                  <span class="prio" [class]="'p-' + competition.priority">{{ competition.priority }}</span>
                  <div class="stack grow">
                    <span class="h3">{{ competition.name }}</span>
                    <span class="small muted">{{ competition.dateLabel }}{{ competition.goal ? ' · Objectif ' + competition.goal : '' }}</span>
                  </div>
                </div>
              }

              <span class="sub">Musculation</span>
              <div class="rows">
                <div class="line"><span class="grow body muted">Objectif</span><span class="h3">{{ data.strength.goal ?? '—' }}</span></div>
                <div class="line"><span class="grow body muted">Type</span><span class="h3">{{ data.strength.type ?? '—' }}</span></div>
                <div class="line"><span class="grow body muted">Fréquence</span><span class="h3">{{ data.strength.frequency ? data.strength.frequency + ' séances/sem.' : '—' }}</span></div>
              </div>
            </section>

            <section class="card card-pad">
              <span class="h2">Disponibilités</span>
              <div class="days">
                @for (day of days; track day; let i = $index) {
                  <span class="day" [class.on]="data.availability.days[i]">{{ day }}</span>
                }
              </div>
              @if (data.availability.preferredTime) {
                <span class="caption muted mt-sm">Créneau préféré : {{ data.availability.preferredTime }}</span>
              }
            </section>
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

      .title-line {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
      }

      .who {
        display: flex;
        align-items: center;
        gap: 16px;
        min-width: 0;
      }

      .who.small-who {
        gap: 12px;
      }

      .actions {
        display: flex;
        gap: 10px;
        flex-shrink: 0;
      }

      .cols {
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
        gap: 20px;
        align-items: start;
      }

      .col {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }

      .status {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .status-tile {
        width: 44px;
        height: 44px;
        border-radius: var(--r-md);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
      }

      .status-label {
        font-size: 20px;
        line-height: 28px;
        font-weight: 600;
      }

      .trend {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-top: 20px;
        padding-top: 18px;
        border-top: 1px solid var(--border);
      }

      .metric {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .metric-value {
        font-size: 20px;
        line-height: 28px;
        font-weight: 600;
      }

      .unit {
        font-size: 13px;
        color: var(--text2);
        font-weight: 500;
      }

      .weeks {
        margin-top: 20px;
        padding-top: 18px;
        border-top: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .legend {
        display: flex;
        gap: 12px;
      }

      .leg {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 500;
        color: var(--text2);
      }

      .bars {
        display: flex;
        gap: 4px;
      }

      .week-bar {
        flex: 1;
        height: 10px;
        border-radius: 3px;
      }

      .activity {
        overflow: hidden;
      }

      .act-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
      }

      .act-row {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) 90px 90px 80px 40px;
        align-items: center;
        gap: 12px;
        padding: 12px 20px;
        border-top: 1px solid var(--border);
      }

      .act-row.head {
        background: var(--bg);
        padding-top: 10px;
        padding-bottom: 10px;
      }

      .tile {
        width: 36px;
        height: 36px;
        border-radius: var(--r-md);
        background: var(--accent-soft);
        color: var(--accent-ink);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .tile.strength {
        background: var(--subtle);
        color: var(--brand);
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
        color: var(--ink);
      }

      .specs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        margin-top: 16px;
      }

      .spec {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .vma {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .vma-input {
        width: 70px;
        height: 32px;
        border-radius: var(--r-sm);
        border: 1px solid var(--border);
        background: var(--surface);
        padding: 0 8px;
        outline: none;
      }

      .sub {
        display: block;
        font-size: 12px;
        line-height: 16px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text3);
        margin: 16px 0 4px;
      }

      .rows {
        display: flex;
        flex-direction: column;
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

      .right {
        text-align: right;
      }

      .comp {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 16px;
        padding: 12px;
        border-radius: var(--r-md);
        background: var(--subtle);
      }

      .prio {
        width: 32px;
        height: 32px;
        border-radius: var(--r-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 13px;
        background: var(--surface);
        color: var(--ink);
        flex-shrink: 0;
      }

      .prio.p-A {
        background: var(--brand);
        color: var(--on-brand);
      }

      .days {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 6px;
        margin-top: 14px;
      }

      .day {
        height: 34px;
        border-radius: var(--r-sm);
        background: var(--bg);
        color: var(--text3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 500;
      }

      .day.on {
        background: var(--accent-soft);
        color: var(--accent-ink);
        font-weight: 600;
      }

      .mt-sm {
        display: block;
        margin-top: 12px;
      }
    `,
  ],
})
export class CoachAthletePage {
  private readonly coach = inject(CoachService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  readonly days = DAYS;

  readonly fiche = load(() => this.coach.athlete$(this.id()));

  readonly editingVma = signal(false);
  readonly vmaDraft = signal('');

  readonly trend = computed(() => TRENDS[this.fiche.data()?.trend ?? 'stable']);

  statusColor(status: 'green' | 'orange' | 'red') {
    return ATHLETE_STATUS_STYLE[status].color;
  }

  statusLabel(status: 'green' | 'orange' | 'red') {
    return ATHLETE_STATUS_STYLE[status].label;
  }

  dec(value: number) {
    return formatDecimal(value, 1);
  }

  round(value: number) {
    return Math.round(value);
  }

  startVma(current?: number) {
    this.vmaDraft.set(current ? String(current).replace('.', ',') : '');
    this.editingVma.set(true);
  }

  saveVma() {
    const parsed = Number(this.vmaDraft().replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.editingVma.set(false);
      return;
    }
    this.coach.updateAthleteVma(this.id(), parsed).subscribe({
      next: () => {
        this.editingVma.set(false);
        this.fiche.reload(true);
      },
    });
  }

  openPlanning() {
    void this.router.navigate(['/coach/athletes', this.id(), 'planning']);
  }

  openActivity(activityId: string, sport: 'running' | 'strength') {
    void this.router.navigate(['/coach/athletes', this.id(), sport === 'strength' ? 'muscu' : 'sortie', activityId]);
  }

  value(event: Event) {
    return (event.target as HTMLInputElement).value;
  }
}
