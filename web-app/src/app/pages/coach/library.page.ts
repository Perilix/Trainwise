import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import type { ApiSessionTemplate } from '../../core/api-types';
import { formatDecimal, formatHoursMinutes, formatPace, toIsoDay } from '../../core/format';
import { load } from '../../core/load';
import { CoachService } from '../../data/coach.service';
import { SESSION_TYPE_LABELS } from '../../domain/athlete.mappers';
import { paceFor, totals } from '../../domain/sessions';
import { groupTemplates, mainPercent, templateCopyPayload, templateToDetail } from '../../domain/templates';
import { AvatarComponent } from '../../ui/avatar.component';
import { IconComponent } from '../../ui/icon.component';
import { IntensityLegendComponent } from '../../ui/intensity-legend.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { StateViewComponent } from '../../ui/state-view.component';
import { WorkoutProfileComponent } from '../../ui/workout-profile.component';

@Component({
  selector: 'tw-coach-library',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    IconComponent,
    IntensityLegendComponent,
    PageHeaderComponent,
    StateViewComponent,
    WorkoutProfileComponent,
  ],
  template: `
    <main class="page">
      <tw-page-header title="Bibliothèque" subtitle="Exercices et séances disponibles pour vos athlètes.">
        <button class="btn btn-primary" type="button" (click)="newTemplate()">
          <tw-icon name="plus" [size]="18" [strokeWidth]="2" />
          Nouvelle séance
        </button>
      </tw-page-header>

      <div class="toolbar">
        <div class="tabs">
          <button type="button" class="tab on">Séances<span class="count">{{ templates.data()?.length ?? 0 }}</span></button>
          <button type="button" class="tab" (click)="openExercises()">Exercices</button>
        </div>
        <div class="filters">
          <div class="segmented">
            @for (option of sports; track option.value) {
              <button type="button" class="seg" [class.on]="sport() === option.value" (click)="sport.set(option.value)">
                {{ option.label }}
              </button>
            }
          </div>
          <div class="search">
            <tw-icon name="search" [size]="16" />
            <input placeholder="Rechercher une séance…" [value]="search()" (input)="search.set(value($event))" />
          </div>
        </div>
      </div>

      @if (templates.loading()) {
        <tw-state kind="loading" />
      } @else if (templates.error()) {
        <tw-state kind="error" [message]="templates.error()">
          <button class="btn btn-ghost btn-sm" (click)="templates.reload()">Réessayer</button>
        </tw-state>
      } @else {
        <div class="cols">
          <section class="card list scroll-y">
            @for (group of groups(); track group.label) {
              <span class="group-label">{{ group.label }}</span>
              @for (row of group.templates; track row.id) {
                <button type="button" class="item" [class.on]="row.id === selectedId()" (click)="selectedId.set(row.id)">
                  <div class="item-head">
                    <span class="tile" [class.strength]="row.sport === 'strength'">
                      <tw-icon [name]="row.sport === 'strength' ? 'dumbbell' : 'run'" [size]="18" />
                    </span>
                    <div class="stack grow">
                      <span class="h3 truncate">{{ row.name }}</span>
                      <span class="caption muted">{{ row.meta }}</span>
                    </div>
                  </div>
                  @if (row.segments.length) {
                    <div class="mini-profile">
                      <tw-workout-profile [segments]="row.segments" [width]="230" [height]="26" />
                    </div>
                  }
                </button>
              }
            } @empty {
              <tw-state kind="empty" icon="folder" message="Aucune séance type." />
            }
          </section>

          <section class="detail">
            @if (selected(); as template) {
              <div class="card card-pad">
                <div class="detail-head">
                  <div class="stack min">
                    <div class="tags">
                      <span class="chip chip-accent">
                        <tw-icon [name]="template.sport === 'strength' ? 'dumbbell' : 'run'" [size]="13" [strokeWidth]="2" />
                        {{ template.sport === 'strength' ? 'Muscu' : 'Course' }}
                      </span>
                      <span class="chip">{{ typeLabel(template.sessionType) }}</span>
                      <span class="caption muted">{{ usageLabel(template) }}</span>
                    </div>
                    <h2 class="h1">{{ template.name }}</h2>
                    @if (template.description) {
                      <p class="body muted">{{ template.description }}</p>
                    }
                  </div>
                  <div class="detail-actions">
                    <button class="btn btn-ghost btn-sm" type="button" (click)="duplicate(template)">
                      <tw-icon name="copy" [size]="16" [strokeWidth]="2" />
                      Dupliquer
                    </button>
                    <button class="btn btn-ghost btn-sm" type="button" (click)="edit(template._id)">
                      <tw-icon name="edit" [size]="16" [strokeWidth]="2" />
                      Modifier
                    </button>
                    <button class="btn btn-primary btn-sm" type="button" (click)="assignOpen.set(true)">
                      <tw-icon name="send" [size]="16" [strokeWidth]="2" />
                      Assigner
                    </button>
                  </div>
                </div>

                <div class="summary">
                  <div class="summary-stats">
                    <div class="stat"><span class="caption muted">Distance</span><span class="value num">{{ detail().distance }}</span></div>
                    <div class="stat"><span class="caption muted">Durée</span><span class="value num">{{ detail().duration }}</span></div>
                    @if (detail().main) {
                      <div class="stat"><span class="caption muted">Répétitions</span><span class="value">{{ detail().main }}</span></div>
                    }
                  </div>
                  @if (referenceVma()) {
                    <span class="caption muted">Aperçu pour VMA {{ dec(referenceVma()!) }}</span>
                  }
                </div>

                @if (detail().segments.length) {
                  <div class="profile">
                    <tw-workout-profile [segments]="detail().segments" [width]="700" [height]="72" />
                  </div>
                  <tw-intensity-legend />
                }
              </div>

              @if (detail().blocks.length) {
                <div class="card card-pad">
                  <span class="h2">Structure</span>
                  <div class="blocks">
                    @for (block of detail().blocks; track block.key) {
                      <div class="block">
                        <div class="block-head">
                          <span class="chip chip-accent">{{ block.roleLabel }}</span>
                          @if (block.repetitions > 1) {
                            <span class="chip">{{ block.repetitions }} ×</span>
                          }
                        </div>
                        @for (step of block.steps; track step.key) {
                          <div class="step">
                            <span class="swatch" [style.background]="shade(step.pct)"></span>
                            <div class="stack">
                              <span class="h3">{{ step.label }}</span>
                              <span class="small muted">{{ step.paceLabel || step.note || '' }}</span>
                            </div>
                          </div>
                        }
                        @if (block.recoveryLabel) {
                          <div class="step">
                            <span class="swatch" style="background: var(--border)"></span>
                            <div class="stack">
                              <span class="h3">Récupération · {{ block.recoveryLabel }}</span>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              }

              @if (template.sport === 'running' && percentInfo()) {
                <div class="card card-pad">
                  <div class="spread">
                    <span class="h2">Allures individualisées</span>
                    <span class="caption muted">calculées depuis la VMA</span>
                  </div>
                  <div class="paces">
                    <span class="overline muted-3">Athlète</span>
                    <span class="overline muted-3">VMA</span>
                    <span class="overline muted-3">Allure</span>
                    <span class="overline muted-3">Récup</span>
                    @for (row of individualPaces(); track row.id) {
                      <span class="cell who">
                        <tw-avatar [initials]="row.initials" tone="accent" [size]="26" />
                        <span class="truncate">{{ row.name }}</span>
                      </span>
                      <span class="cell num">{{ row.vma }}</span>
                      <span class="cell num">{{ row.pace }}</span>
                      <span class="cell num muted">{{ row.recovery }}</span>
                    }
                  </div>
                  <span class="caption muted mt-sm">Ajustables athlète par athlète au moment d'assigner.</span>
                </div>
              }
            } @else {
              <div class="card card-pad">
                <tw-state kind="empty" icon="folder" message="Choisis une séance dans la liste." />
              </div>
            }
          </section>
        </div>
      }

      @if (assignOpen() && selected(); as template) {
        <div class="scrim" (click)="assignOpen.set(false)">
          <div class="modal card" (click)="$event.stopPropagation()">
            <div class="spread">
              <span class="h2">Assigner « {{ template.name }} »</span>
              <button class="icon-btn" type="button" (click)="assignOpen.set(false)" aria-label="Fermer">
                <tw-icon name="close" [size]="18" />
              </button>
            </div>
            <div class="field mt">
              <label for="assign-date">Date</label>
              <input id="assign-date" type="date" class="input" [value]="assignDate()" (change)="assignDate.set(value($event))" />
            </div>
            <div class="athletes scroll-y">
              @for (athlete of athletes.data() ?? []; track athlete.id) {
                <button type="button" class="pick" [class.on]="picked().includes(athlete.id)" (click)="togglePick(athlete.id)">
                  <tw-avatar [initials]="athlete.initials" tone="accent" [size]="36" />
                  <span class="grow truncate">{{ athlete.name }}</span>
                  @if (picked().includes(athlete.id)) {
                    <tw-icon name="check" [size]="18" [strokeWidth]="2.5" />
                  }
                </button>
              }
            </div>
            <div class="modal-actions">
              <button class="btn btn-ghost grow" type="button" (click)="assignOpen.set(false)">Annuler</button>
              <button class="btn btn-primary grow" type="button" [disabled]="!picked().length || !assignDate()" (click)="assign(template._id)">
                Assigner à {{ picked().length }} athlète{{ picked().length > 1 ? 's' : '' }}
              </button>
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

      .toolbar {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .tabs {
        display: flex;
        align-items: center;
        gap: 28px;
        border-bottom: 1px solid var(--border);
      }

      .tab {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 0 12px;
        font-size: 15px;
        font-weight: 500;
        color: var(--text2);
        border-bottom: 2px solid transparent;
      }

      .tab.on {
        color: var(--ink);
        font-weight: 600;
        border-bottom-color: var(--brand);
      }

      .count {
        font-size: 12px;
        font-weight: 600;
        color: var(--text3);
      }

      .filters {
        display: flex;
        align-items: center;
        gap: 10px;
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
        padding: 0 16px;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 500;
        color: var(--text2);
      }

      .seg.on {
        background: var(--surface);
        color: var(--ink);
        font-weight: 600;
      }

      .search {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 260px;
        height: 38px;
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

      .cols {
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr);
        gap: 20px;
        align-items: start;
      }

      .list {
        padding: 12px;
        max-height: calc(100vh - 260px);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .group-label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text3);
        padding: 12px 8px 4px;
      }

      .item {
        padding: 10px 8px;
        border-radius: var(--r-md);
        text-align: left;
        width: 100%;
      }

      .item:hover {
        background: var(--bg);
      }

      .item.on {
        background: var(--subtle);
      }

      .item-head {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .tile {
        width: 32px;
        height: 32px;
        border-radius: var(--r-sm);
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

      .mini-profile {
        margin: 8px 0 0 42px;
      }

      .detail {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }

      .detail-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }

      .stack.min {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
      }

      .tags {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .detail-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }

      .summary {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        margin-top: 20px;
        padding-top: 18px;
        border-top: 1px solid var(--border);
      }

      .summary-stats {
        display: flex;
        gap: 36px;
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

      .profile {
        margin: 16px 0 14px;
      }

      .blocks {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 14px;
      }

      .block {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        border: 1px solid var(--border);
        border-radius: var(--r-md);
      }

      .block-head {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .step {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-left: 4px;
      }

      .swatch {
        width: 6px;
        height: 28px;
        border-radius: 3px;
        flex-shrink: 0;
      }

      .paces {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) 90px 100px 100px;
        column-gap: 12px;
        align-items: center;
        margin-top: 14px;
      }

      .cell {
        height: 40px;
        display: flex;
        align-items: center;
        border-top: 1px solid var(--border);
        font-size: 13px;
      }

      .cell.who {
        gap: 8px;
        min-width: 0;
      }

      .mt-sm {
        display: block;
        margin-top: 12px;
      }

      .mt {
        margin-top: 14px;
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

      .athletes {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: 14px;
        max-height: 280px;
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

      .pick.on {
        background: var(--accent-soft);
        color: var(--accent-ink);
      }

      .modal-actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
      }
    `,
  ],
})
export class CoachLibraryPage {
  private readonly coach = inject(CoachService);
  private readonly router = inject(Router);

  readonly sports = [
    { value: 'all', label: 'Tous' },
    { value: 'running', label: 'Course' },
    { value: 'strength', label: 'Muscu' },
  ] as const;

  readonly templates = load(() => this.coach.templates$());
  readonly athletes = load(() => this.coach.athletes$());

  readonly sport = signal<'all' | 'running' | 'strength'>('all');
  readonly search = signal('');
  readonly selectedId = signal<string | null>(null);

  readonly assignOpen = signal(false);
  readonly assignDate = signal(toIsoDay(new Date()));
  readonly picked = signal<string[]>([]);

  readonly matching = computed(() => {
    const all = this.templates.data() ?? [];
    const sport = this.sport();
    const term = this.search().trim().toLowerCase();
    return all.filter(
      (template) =>
        (sport === 'all' || template.sport === sport) &&
        (!term || `${template.name} ${template.description ?? ''}`.toLowerCase().includes(term)),
    );
  });

  readonly groups = computed(() => groupTemplates(this.matching()));

  readonly selected = computed(() => this.matching().find((template) => template._id === this.selectedId()) ?? null);

  readonly detail = computed(() => {
    const template = this.selected();
    if (!template) return { distance: '—', duration: '—', main: '', segments: [], blocks: [] };
    const view = templateToDetail(template);
    const total = totals(view.segments);
    const km = template.targetDistance ?? (total.dist ? total.dist / 1000 : undefined);
    const minutes = template.targetDuration ?? (total.sec ? total.sec / 60 : view.strength?.estimatedDuration);
    return {
      distance: km ? `≈ ${formatDecimal(km, 1)} km` : '—',
      duration: minutes ? `≈ ${formatHoursMinutes(minutes * 60)}` : '—',
      main: mainPercent(template)?.label ?? '',
      segments: view.segments,
      blocks: view.blocks,
    };
  });

  readonly percentInfo = computed(() => {
    const template = this.selected();
    return template ? mainPercent(template) : undefined;
  });

  readonly referenceVma = computed(() => this.athletes.data()?.find((athlete) => athlete.vma)?.vma);

  /** Une allure par athlète : la même séance ne se court pas au même rythme. */
  readonly individualPaces = computed(() => {
    const info = this.percentInfo();
    if (!info) return [];
    return (this.athletes.data() ?? []).map((athlete) => {
      if (!athlete.vma) {
        return { id: athlete.id, initials: athlete.initials, name: athlete.name, vma: '—', pace: 'VMA manquante', recovery: '—' };
      }
      return {
        id: athlete.id,
        initials: athlete.initials,
        name: athlete.name,
        vma: `${formatDecimal(athlete.vma, 1)} km/h`,
        pace: `${formatPace(paceFor(athlete.vma, info.percent))} /km`,
        recovery: `${formatPace(paceFor(athlete.vma, 50))} /km`,
      };
    });
  });

  constructor() {
    // Une séance est ouverte d'office : le panneau de droite ne reste pas vide.
    effect(() => {
      const rows = this.matching();
      if (!rows.length) return;
      if (!rows.some((template) => template._id === this.selectedId())) this.selectedId.set(rows[0]._id);
    });
  }

  typeLabel(sessionType: string) {
    return SESSION_TYPE_LABELS[sessionType] ?? sessionType;
  }

  usageLabel(template: ApiSessionTemplate) {
    if (!template.usageCount) return 'Jamais utilisée';
    const last = template.lastUsedAt ? ` · dernière le ${new Date(template.lastUsedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : '';
    return `Utilisée ${template.usageCount} fois${last}`;
  }

  shade(pct: number) {
    if (pct >= 95) return '#05608F';
    if (pct >= 84) return '#0A8ED6';
    if (pct >= 78) return '#3DB4F5';
    if (pct >= 68) return '#8FD2F8';
    return '#CDEBFB';
  }

  dec(value: number) {
    return formatDecimal(value, 1);
  }

  newTemplate() {
    void this.router.navigate(['/coach/bibliotheque/editeur']);
  }

  edit(id: string) {
    void this.router.navigate(['/coach/bibliotheque/editeur', id]);
  }

  duplicate(template: ApiSessionTemplate) {
    this.coach.saveTemplate(null, templateCopyPayload(template)).subscribe({ next: () => this.templates.reload(true) });
  }

  openExercises() {
    void this.router.navigate(['/coach/exercices']);
  }

  togglePick(id: string) {
    this.picked.update((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  }

  assign(templateId: string) {
    this.coach.assignTemplate(templateId, { athleteIds: this.picked(), date: this.assignDate() }).subscribe({
      next: () => {
        this.assignOpen.set(false);
        this.picked.set([]);
        this.templates.reload(true);
      },
    });
  }

  value(event: Event) {
    return (event.target as HTMLInputElement).value;
  }
}
