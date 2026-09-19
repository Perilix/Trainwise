import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '../core/api.service';
import { load } from '../core/load';
import { BillingService, type AlertRules } from '../data/billing.service';
import { IconComponent } from './icon.component';

type Field = keyof AlertRules;

/**
 * Les seuils d'alerte du coach : à partir de quand un athlète passe en orange,
 * puis en rouge. Le calcul reste le même (inactivité, séances sautées, ressenti,
 * baisse de volume) — ce sont les bornes qui deviennent celles du coach.
 *
 * Régler ces seuils fait partie du plan Studio : sans lui, l'écran montre les
 * valeurs en vigueur sans permettre de les changer.
 */
@Component({
  selector: 'tw-alert-rules',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  template: `
    <section class="card card-pad">
      <div class="spread">
        <div class="stack">
          <span class="h2">Alertes</span>
          <span class="small muted">Quand considérez-vous qu'un athlète décroche ?</span>
        </div>
        @if (!editable()) {
          <span class="chip chip-accent">Plan Studio</span>
        }
      </div>

      @if (state.loading()) {
        <p class="small muted note">Chargement…</p>
      } @else if (draft(); as rules) {
        <fieldset class="rules" [disabled]="!editable()">
          <div class="rule">
            <div class="stack grow">
              <span class="h3">Sans activité</span>
              <span class="small muted">Ni sortie, ni séance de muscu enregistrée.</span>
            </div>
            <label class="step">
              <span class="dot orange"></span>
              <input class="input" type="number" min="1" max="60" [value]="rules.inactivityOrange" (change)="set('inactivityOrange', $event)" />
              <span class="caption muted">jours</span>
            </label>
            <label class="step">
              <span class="dot red"></span>
              <input class="input" type="number" min="2" max="90" [value]="rules.inactivityRed" (change)="set('inactivityRed', $event)" />
              <span class="caption muted">jours</span>
            </label>
          </div>

          <div class="rule">
            <div class="stack grow">
              <span class="h3">Séances sautées</span>
              <span class="small muted">Sur les 28 derniers jours.</span>
            </div>
            <label class="step">
              <span class="dot orange"></span>
              <input class="input" type="number" min="1" max="20" [value]="rules.skippedOrange" (change)="set('skippedOrange', $event)" />
              <span class="caption muted">séances</span>
            </label>
            <label class="step">
              <span class="dot red"></span>
              <input class="input" type="number" min="2" max="30" [value]="rules.skippedRed" (change)="set('skippedRed', $event)" />
              <span class="caption muted">séances</span>
            </label>
          </div>

          <div class="rule">
            <div class="stack grow">
              <span class="h3">Ressenti moyen</span>
              <span class="small muted">Note donnée par l'athlète après ses sorties, sur 10.</span>
            </div>
            <label class="step">
              <span class="dot orange"></span>
              <span class="caption muted">sous</span>
              <input class="input" type="number" min="2" max="10" [value]="rules.feelingOrange" (change)="set('feelingOrange', $event)" />
            </label>
            <label class="step">
              <span class="dot red"></span>
              <span class="caption muted">sous</span>
              <input class="input" type="number" min="1" max="9" [value]="rules.feelingRed" (change)="set('feelingRed', $event)" />
            </label>
          </div>

          <div class="rule">
            <div class="stack grow">
              <span class="h3">Baisse de volume</span>
              <span class="small muted">Semaine écoulée comparée aux trois précédentes.</span>
            </div>
            <label class="step">
              <span class="dot orange"></span>
              <span class="caption muted">sous</span>
              <input
                class="input"
                type="number"
                min="10"
                max="90"
                step="5"
                [value]="rules.volumeDropPercent"
                [disabled]="!rules.volumeDropEnabled"
                (change)="set('volumeDropPercent', $event)"
              />
              <span class="caption muted">%</span>
            </label>
            <button
              type="button"
              class="switch"
              [class.on]="rules.volumeDropEnabled"
              [attr.aria-pressed]="rules.volumeDropEnabled"
              (click)="toggleVolume()"
            >
              <span class="knob"></span>
            </button>
          </div>
        </fieldset>

        @if (editable()) {
          <div class="foot">
            @if (error()) {
              <span class="small err grow">{{ error() }}</span>
            } @else if (saved()) {
              <span class="small ok grow"><tw-icon name="check" [size]="14" [strokeWidth]="2" />Seuils enregistrés</span>
            } @else {
              <span class="caption muted-3 grow">Le rouge reste toujours plus sévère que l'orange.</span>
            }
            <button class="btn btn-ghost btn-sm" type="button" [disabled]="!dirty()" (click)="reset()">Annuler</button>
            <button class="btn btn-primary btn-sm" type="button" [disabled]="!dirty() || saving()" (click)="save()">
              {{ saving() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
          </div>
        } @else {
          <a class="upsell" routerLink="/coach/abonnement">
            <tw-icon name="crown" [size]="18" />
            <span class="small grow">Fixer vos propres seuils fait partie du plan Studio.</span>
            <span class="link">Voir les plans</span>
          </a>
        }
      }
    </section>
  `,
  styles: [
    `
      .rules {
        display: flex;
        flex-direction: column;
        margin-top: 8px;
        border: 0;
        padding: 0;
      }

      .rules[disabled] {
        opacity: 0.65;
      }

      .rule {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 0;
        border-top: 1px solid var(--border);
      }

      .step {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      .step .input {
        width: 62px;
        height: 36px;
        text-align: center;
        padding: 0 6px;
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: var(--r-pill);
        display: block;
      }

      .dot.orange {
        background: var(--warn);
      }

      .dot.red {
        background: var(--danger);
      }

      .switch {
        width: 44px;
        height: 26px;
        border-radius: var(--r-pill);
        background: var(--subtle);
        padding: 3px;
        display: flex;
        align-items: center;
        cursor: pointer;
        flex-shrink: 0;
      }

      .switch.on {
        background: var(--brand);
      }

      .knob {
        width: 20px;
        height: 20px;
        border-radius: var(--r-pill);
        background: var(--surface);
        transition: transform 0.14s ease;
      }

      .switch.on .knob {
        transform: translateX(18px);
      }

      .foot {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid var(--border);
      }

      .ok {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--success-ink);
      }

      .err {
        color: var(--danger);
      }

      .upsell {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 14px;
        padding: 12px 14px;
        border-radius: var(--r-md);
        background: var(--accent-soft);
        color: var(--accent-ink);
      }

      .note {
        margin: 12px 0 0;
      }
    `,
  ],
})
export class AlertRulesComponent {
  private readonly billing = inject(BillingService);

  readonly state = load(() => this.billing.alertRules$());

  readonly draft = signal<AlertRules | null>(null);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');

  readonly editable = computed(() => Boolean(this.state.data()?.editable));

  readonly dirty = computed(() => {
    const saved = this.state.data()?.rules;
    const draft = this.draft();
    return Boolean(saved && draft && JSON.stringify(saved) !== JSON.stringify(draft));
  });

  constructor() {
    // Les seuils arrivent après coup : on les recopie dans le brouillon, sans
    // écraser ce que le coach est en train de modifier.
    effect(() => {
      const rules = this.state.data()?.rules;
      if (!rules) return;
      untracked(() => {
        if (!this.draft() || !this.dirty()) this.draft.set({ ...rules });
      });
    });
  }

  set(field: Field, event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    this.draft.update((rules) => (rules ? { ...rules, [field]: Math.round(value) } : rules));
    this.saved.set(false);
  }

  toggleVolume() {
    this.draft.update((rules) => (rules ? { ...rules, volumeDropEnabled: !rules.volumeDropEnabled } : rules));
    this.saved.set(false);
  }

  reset() {
    const rules = this.state.data()?.rules;
    if (rules) this.draft.set({ ...rules });
    this.error.set('');
    this.saved.set(false);
  }

  save() {
    const rules = this.draft();
    if (!rules || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.billing.saveAlertRules(rules).subscribe({
      next: (state) => {
        this.saving.set(false);
        this.saved.set(true);
        // Le serveur peut corriger un seuil incohérent : on affiche ce qu'il a retenu.
        this.draft.set({ ...state.rules });
        this.state.reload(true);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
      },
    });
  }
}
