import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { formatDayShort, parseDecimal } from '../../core/format';
import { load } from '../../core/load';
import { AthleteService } from '../../data/athlete.service';
import { buildStrengthPayload, entriesFromPlan, type LogEntry } from '../../domain/strength-log';
import { IconComponent } from '../../ui/icon.component';
import { StatComponent } from '../../ui/stat.component';
import { StateViewComponent } from '../../ui/state-view.component';

/**
 * Saisie d'une séance de musculation : le plan du coach devient une grille de séries,
 * cochées au fur et à mesure. Seules les séries cochées partent à l'API.
 */
@Component({
  selector: 'tw-athlete-strength',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, StatComponent, StateViewComponent],
  template: `
    <main class="page">
      @if (session.loading()) {
        <tw-state kind="loading" />
      } @else if (session.error()) {
        <tw-state kind="error" [message]="session.error()">
          <button class="btn btn-ghost btn-sm" (click)="session.reload()">Réessayer</button>
        </tw-state>
      } @else if (session.data(); as data) {
        <header class="head">
          <button type="button" class="back" (click)="goBack()">
            <tw-icon name="chevron-left" [size]="16" />
            <span class="small">Planning</span>
          </button>
          <div class="title-line">
            <div class="stack min">
              <span class="small muted">{{ dayLabel() }}</span>
              <h1 class="display">{{ data.title }}</h1>
              <div class="chips">
                @if (data.status === 'done') {
                  <span class="chip chip-done"><tw-icon name="check" [size]="13" [strokeWidth]="2" />Effectuée</span>
                }
                @if (data.plannedBy === 'coach' && data.coachName) {
                  <span class="chip chip-coach"><tw-icon name="user" [size]="13" [strokeWidth]="2" />Planifiée par {{ data.coachName }}</span>
                }
              </div>
            </div>
            <div class="actions">
              <button class="btn btn-ghost" type="button" (click)="goBack()">Annuler</button>
              <button class="btn btn-primary" type="button" [disabled]="saving() || !doneSets()" (click)="save()">
                {{ saving() ? 'Enregistrement…' : 'Enregistrer la séance' }}
              </button>
            </div>
          </div>
          @if (saveError()) {
            <p class="err small">{{ saveError() }}</p>
          }
        </header>

        <div class="cols">
          <div class="main-col">
            <div class="spread">
              <span class="h2">Exercices</span>
            </div>

            @for (entry of entries(); track entry.key) {
              <section class="card card-pad">
                <div class="ex-head">
                  <span class="tile"><tw-icon name="dumbbell" [size]="20" /></span>
                  <div class="grow stack gap">
                    <span class="h2">{{ entry.name }}</span>
                    <div class="tags">
                      @if (entry.muscle) {
                        <span class="chip">{{ entry.muscle }}</span>
                      }
                      @if (entry.context) {
                        <span class="small muted">{{ entry.context }}</span>
                      }
                      @if (entry.target.reps) {
                        <span class="small muted">Objectif {{ entry.target.sets }} × {{ entry.target.reps }}</span>
                      }
                    </div>
                  </div>
                </div>

                <div class="grid">
                  <span class="caption muted-3">Série</span>
                  <span class="caption muted-3">Reps</span>
                  <span class="caption muted-3">Poids (kg)</span>
                  <span class="caption muted-3">Repos</span>
                  <span class="caption muted-3"></span>

                  @for (set of entry.sets; track $index) {
                    <div class="cell num">{{ $index + 1 }}</div>
                    <div class="cell">
                      <input class="mini" inputmode="numeric" [value]="set.reps" (input)="setField(entry.key, $index, 'reps', $event)" />
                    </div>
                    <div class="cell">
                      <input class="mini" inputmode="decimal" [value]="set.weight" placeholder="—" (input)="setField(entry.key, $index, 'weight', $event)" />
                    </div>
                    <div class="cell muted">{{ entry.target.rest || '—' }}</div>
                    <button type="button" class="check" [class.on]="set.done" (click)="toggle(entry.key, $index)" aria-label="Série faite">
                      <tw-icon name="check" [size]="16" [strokeWidth]="2.5" />
                    </button>
                  }
                </div>

                <button type="button" class="add" (click)="addSet(entry.key)">
                  <tw-icon name="plus" [size]="16" [strokeWidth]="2" />
                  Ajouter une série
                </button>
              </section>
            } @empty {
              <div class="card card-pad">
                <tw-state kind="empty" icon="dumbbell" message="Cette séance n'a pas encore d'exercices." />
              </div>
            }
          </div>

          <aside class="side">
            <section class="card card-pad">
              <div class="summary">
                <tw-stat label="Durée" [value]="duration()" unit="min" />
                <tw-stat label="Séries" [value]="doneSets()" />
                <tw-stat label="Volume" [value]="volume()" unit="kg" />
              </div>
              <div class="field mt">
                <label for="duration">Durée de la séance (min)</label>
                <input id="duration" class="input" inputmode="numeric" [value]="duration()" (input)="duration.set(number($event))" />
              </div>
            </section>

            @if (data.strength?.superset; as superset) {
              <section class="card card-pad">
                <div class="spread">
                  <span class="h2">Super-set</span>
                  <span class="chip">{{ superset.sets }} séries · récup {{ superset.restBetweenSetsSec }} s</span>
                </div>
                <div class="pairs">
                  @for (pair of superset.pairs; track $index) {
                    @if (pair.a) {
                      <div class="pair"><span class="slot">A</span><div class="stack"><span class="h3">{{ pair.a.name }}</span><span class="small muted">{{ target(pair.a.reps, pair.a.weight) }}</span></div></div>
                    }
                    @if (pair.b) {
                      <div class="pair"><span class="slot">B</span><div class="stack"><span class="h3">{{ pair.b.name }}</span><span class="small muted">{{ target(pair.b.reps, pair.b.weight) }}</span></div></div>
                    }
                  }
                </div>
                <span class="caption muted mt-sm">Enchaîne A puis B sans repos</span>
              </section>
            }

            @if (data.strength?.circuit; as circuit) {
              <section class="card card-pad">
                <div class="spread">
                  <span class="h2">Circuit</span>
                  <span class="chip">{{ circuit.rounds }} tours · récup {{ circuit.restBetweenRoundsSec }} s</span>
                </div>
                <div class="pairs">
                  @for (exercise of circuit.exercises; track exercise.key) {
                    <div class="pair">
                      <span class="slot small-slot">{{ $index + 1 }}</span>
                      <div class="stack"><span class="h3">{{ exercise.name }}</span><span class="small muted">{{ target(exercise.reps, exercise.weight) }}</span></div>
                    </div>
                  }
                </div>
              </section>
            }

            <section class="card card-pad">
              <div class="spread mb">
                <span class="h2">Ressenti</span>
                <div class="feel">
                  <span class="num">{{ feeling() }}</span>
                  <span class="small muted">/10</span>
                </div>
              </div>
              <input class="slider" type="range" min="1" max="10" [value]="feeling()" (input)="feeling.set(number($event))" aria-label="Ressenti" />
              <div class="spread">
                <span class="caption muted">Épuisant</span>
                <span class="caption muted">Excellent</span>
              </div>
            </section>

            <section class="card card-pad">
              <div class="field">
                <label for="notes">Notes (optionnel)</label>
                <textarea id="notes" class="input" rows="3" [value]="notes()" (input)="notes.set(text($event))"></textarea>
              </div>
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

      .stack.gap {
        gap: 4px;
      }

      .chips {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
      }

      .actions {
        display: flex;
        gap: 10px;
        flex-shrink: 0;
      }

      .err {
        color: var(--danger);
        margin-top: 10px;
      }

      .cols {
        display: grid;
        grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
        gap: 20px;
        align-items: start;
      }

      .main-col {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 0;
      }

      .side {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }

      .ex-head {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .tile {
        width: 44px;
        height: 44px;
        border-radius: var(--r-md);
        background: var(--subtle);
        color: var(--brand);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .tags {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .grid {
        display: grid;
        grid-template-columns: 56px minmax(0, 1fr) minmax(0, 1fr) 80px 44px;
        column-gap: 8px;
        align-items: center;
        margin-top: 16px;
      }

      .cell {
        height: 44px;
        display: flex;
        align-items: center;
        border-top: 1px solid var(--border);
        font-size: 14px;
      }

      .mini {
        width: 100%;
        height: 34px;
        border-radius: var(--r-sm);
        border: 1px solid var(--border);
        background: var(--surface);
        padding: 0 10px;
        outline: none;
        font-variant-numeric: tabular-nums;
      }

      .mini:focus {
        border-color: var(--accent);
      }

      .check {
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-top: 1px solid var(--border);
        color: var(--text3);
      }

      .check.on {
        color: var(--success-ink);
      }

      .add {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        height: 40px;
        margin-top: 12px;
        border-radius: var(--r-md);
        border: 1px dashed var(--border-strong);
        color: var(--text2);
        font-size: 13px;
        font-weight: 600;
      }

      .add:hover {
        color: var(--ink);
        background: var(--bg);
      }

      .summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .pairs {
        position: relative;
        margin-top: 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .pair {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .slot {
        width: 28px;
        height: 28px;
        border-radius: var(--r-sm);
        background: var(--violet-soft);
        color: var(--violet-ink);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 600;
        flex-shrink: 0;
      }

      .slot.small-slot {
        background: var(--subtle);
        color: var(--ink);
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

      .slider {
        width: 100%;
        accent-color: var(--brand);
        margin: 0 0 8px;
      }

      .mb {
        margin-bottom: 14px;
      }

      .mt {
        margin-top: 14px;
      }

      .mt-sm {
        margin-top: 12px;
        display: block;
      }
    `,
  ],
})
export class AthleteStrengthPage {
  private readonly athlete = inject(AthleteService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly id = input.required<string>();

  readonly session = load(() => this.athlete.plannedSession$(this.id()));

  readonly entries = signal<LogEntry[]>([]);
  readonly duration = signal(45);
  readonly feeling = signal(7);
  readonly notes = signal('');
  readonly saving = signal(false);
  readonly saveError = signal('');

  readonly dayLabel = computed(() => {
    const data = this.session.data();
    return data ? formatDayShort(data.date) : '';
  });

  readonly doneSets = computed(() =>
    this.entries().reduce((total, entry) => total + entry.sets.filter((set) => set.done).length, 0),
  );

  readonly volume = computed(() => {
    const total = this.entries().reduce(
      (sum, entry) =>
        sum +
        entry.sets
          .filter((set) => set.done)
          .reduce((setSum, set) => setSum + (parseDecimal(set.reps) ?? 0) * (parseDecimal(set.weight) ?? 0), 0),
      0,
    );
    return Math.round(total).toLocaleString('fr-FR');
  });

  constructor() {
    // Le plan du coach amorce la grille de saisie dès qu'il est chargé.
    effect(() => {
      const plan = this.session.data()?.strength;
      if (!plan || this.entries().length) return;
      this.entries.set(entriesFromPlan(plan));
      if (plan.estimatedDuration) this.duration.set(plan.estimatedDuration);
    });
  }

  target(reps?: string, weight?: number) {
    const parts: string[] = [];
    if (reps) parts.push(`${reps} reps`);
    if (weight) parts.push(`${weight} kg`);
    return parts.join(' · ') || 'Poids du corps';
  }

  toggle(key: string, index: number) {
    this.patchSet(key, index, (set) => ({ ...set, done: !set.done }));
  }

  setField(key: string, index: number, field: 'reps' | 'weight', event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.patchSet(key, index, (set) => ({ ...set, [field]: value, done: true }));
  }

  addSet(key: string) {
    this.entries.update((entries) =>
      entries.map((entry) =>
        entry.key === key
          ? { ...entry, sets: [...entry.sets, { ...(entry.sets.at(-1) ?? { reps: '10', weight: '' }), done: false }] }
          : entry,
      ),
    );
  }

  save() {
    const data = this.session.data();
    const plan = data?.strength;
    if (!data || !plan || this.saving()) return;
    this.saving.set(true);
    this.saveError.set('');
    const payload = buildStrengthPayload({
      plannedId: this.id(),
      sessionType: data.sessionType,
      plan,
      entries: this.entries(),
      durationMin: this.duration(),
      feeling: this.feeling(),
      notes: this.notes(),
    });
    this.api.post('/api/strength/sessions', payload).subscribe({
      next: () => {
        this.api.invalidate();
        this.saving.set(false);
        void this.router.navigate(['/accueil']);
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set("La séance n'a pas pu être enregistrée.");
      },
    });
  }

  goBack() {
    if (history.length > 1) this.location.back();
    else void this.router.navigate(['/planning']);
  }

  number(event: Event) {
    return Number((event.target as HTMLInputElement).value) || 0;
  }

  text(event: Event) {
    return (event.target as HTMLTextAreaElement).value;
  }

  private patchSet(key: string, index: number, update: (set: LogEntry['sets'][number]) => LogEntry['sets'][number]) {
    this.entries.update((entries) =>
      entries.map((entry) =>
        entry.key === key ? { ...entry, sets: entry.sets.map((set, i) => (i === index ? update(set) : set)) } : entry,
      ),
    );
  }
}
