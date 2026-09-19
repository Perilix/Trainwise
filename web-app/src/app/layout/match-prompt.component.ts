import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AuthService } from '../core/auth.service';
import { RefreshService } from '../core/refresh.service';
import { MatchService, type MatchCandidate, type PendingMatch } from '../data/match.service';
import { IconComponent } from '../ui/icon.component';

/**
 * À l'ouverture, on propose de rapprocher les activités importées de Strava de la
 * séance qui était prévue ce jour-là. Sans ce geste, l'entraînement apparaît deux
 * fois dans le planning : une séance « à faire » et une séance « faite ».
 */
@Component({
  selector: 'tw-match-prompt',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (current(); as item) {
      <div class="scrim">
        <div class="card modal">
          <div class="head">
            <span class="tile"><tw-icon name="repeat" [size]="20" [strokeWidth]="2" /></span>
            <div class="stack grow">
              <span class="h2">C'était cette séance ?</span>
              <span class="small muted">{{ item.dayLabel }}</span>
            </div>
            @if (queue().length > 1) {
              <span class="chip">{{ index() + 1 }} / {{ queue().length }}</span>
            }
          </div>

          <div class="pair">
            <div class="side done">
              <span class="overline">Importé de Strava</span>
              <span class="h3">{{ item.activityLabel }}</span>
            </div>
            <tw-icon name="arrow-right" [size]="18" [strokeWidth]="2" />
            <div class="side planned">
              <span class="overline">Séance prévue</span>
              <span class="h3">{{ chosen()?.title || item.planned.title }}</span>
              <span class="small muted">{{ chosen()?.meta || item.planned.meta }}</span>
            </div>
          </div>

          @if (others().length) {
            <div class="others">
              <span class="caption muted">Une autre séance ?</span>
              <div class="chips">
                @for (candidate of others(); track candidate.id) {
                  <button type="button" class="chip pick" [class.on]="candidate.id === chosen()?.id" (click)="choose(candidate)">
                    {{ candidate.dayLabel }} · {{ candidate.title }}
                  </button>
                }
              </div>
            </div>
          }

          @if (error()) {
            <p class="err small">{{ error() }}</p>
          }

          <div class="actions">
            <button class="btn btn-ghost grow" type="button" [disabled]="busy()" (click)="no()">Non, séance à part</button>
            <button class="btn btn-primary grow" type="button" [disabled]="busy()" (click)="yes()">
              <tw-icon name="check" [size]="18" [strokeWidth]="2" />
              {{ busy() ? 'Fusion…' : 'Oui, fusionner' }}
            </button>
          </div>

          <button type="button" class="later" (click)="later()">Plus tard</button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .scrim {
        position: fixed;
        inset: 0;
        background: var(--overlay);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 60;
      }

      .modal {
        width: 480px;
        max-width: calc(100vw - 48px);
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .head {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .tile {
        width: 44px;
        height: 44px;
        border-radius: var(--r-md);
        background: var(--accent-soft);
        color: var(--accent-ink);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .pair {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .side {
        flex: 1;
        min-width: 0;
        border-radius: var(--r-md);
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .side.done {
        background: var(--success-soft);
        color: var(--success-ink);
      }

      .side.planned {
        background: var(--violet-soft);
        color: var(--violet-ink);
      }

      .others {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .pick {
        cursor: pointer;
      }

      .pick.on {
        background: var(--brand);
        color: var(--on-brand);
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .later {
        align-self: center;
        font-size: 13px;
        color: var(--text3);
        cursor: pointer;
      }

      .later:hover {
        color: var(--ink);
      }

      .err {
        color: var(--danger);
        margin: 0;
      }
    `,
  ],
})
export class MatchPromptComponent {
  private readonly match = inject(MatchService);
  private readonly auth = inject(AuthService);
  private readonly refresh = inject(RefreshService);

  readonly queue = signal<PendingMatch[]>([]);
  readonly index = signal(0);
  readonly busy = signal(false);
  readonly error = signal('');

  /** Séances prévues proches, quand la proposition de l'API n'est pas la bonne. */
  readonly candidates = signal<MatchCandidate[]>([]);
  readonly chosen = signal<MatchCandidate | null>(null);

  readonly current = computed(() => this.queue()[this.index()]);

  readonly others = computed(() => {
    const item = this.current();
    if (!item) return [];
    return this.candidates().filter((candidate) => candidate.id !== item.planned.id);
  });

  constructor() {
    if (this.auth.isCoach()) return;
    this.match.pending$().subscribe({
      next: (items) => {
        this.queue.set(items);
        if (items.length) this.loadCandidates(items[0]);
      },
      error: () => this.queue.set([]),
    });
  }

  choose(candidate: MatchCandidate) {
    this.chosen.set(this.chosen()?.id === candidate.id ? null : candidate);
  }

  yes() {
    const item = this.current();
    if (!item || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const picked = this.chosen();
    const request = picked && picked.id !== item.planned.id ? this.match.link(item.id, picked.id) : this.match.confirm(item);
    request.subscribe({
      next: () => this.done(),
      error: () => {
        this.busy.set(false);
        this.error.set('Fusion impossible pour le moment.');
      },
    });
  }

  no() {
    const item = this.current();
    if (!item || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.match.dismiss(item).subscribe({
      next: () => this.done(),
      error: () => {
        this.busy.set(false);
        this.error.set('Action impossible pour le moment.');
      },
    });
  }

  /** Repoussé : les activités restent « à relire », la fenêtre reviendra. */
  later() {
    this.queue.set([]);
  }

  private done() {
    const item = this.current();
    this.busy.set(false);
    if (item) {
      // Relue : la fenêtre ne se rouvrira pas pour cette activité.
      this.match.clear(item.kind === 'run' ? [item.id] : [], item.kind === 'strength' ? [item.id] : []).subscribe({ error: () => undefined });
    }
    this.refresh.bump();
    const next = this.index() + 1;
    this.chosen.set(null);
    this.candidates.set([]);
    if (next >= this.queue().length) {
      this.queue.set([]);
      this.index.set(0);
      return;
    }
    this.index.set(next);
    this.loadCandidates(this.queue()[next]);
  }

  private loadCandidates(item: PendingMatch) {
    if (item.kind !== 'run') return;
    this.match.candidates$(item.id).subscribe({
      next: (candidates) => this.candidates.set(candidates),
      error: () => this.candidates.set([]),
    });
  }
}
