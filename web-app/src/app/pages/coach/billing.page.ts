import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ApiError } from '../../core/api.service';
import { formatDayShort } from '../../core/format';
import { load } from '../../core/load';
import { BillingService, priceOf, savingOf, type BillingCycle, type Plan } from '../../data/billing.service';
import { IconComponent } from '../../ui/icon.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { StateViewComponent } from '../../ui/state-view.component';

/**
 * Abonnement du coach à Trainwise.
 *
 * Le paiement se fait chez Stripe : on envoie le coach sur une page de
 * paiement, et c'est le webhook signé qui écrit l'abonnement. Aucune
 * coordonnée bancaire ne passe par Trainwise. Carte, factures et résiliation
 * vivent dans le portail client, pour la même raison.
 */
@Component({
  selector: 'tw-coach-billing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PageHeaderComponent, StateViewComponent],
  template: `
    <main class="page">
      <tw-page-header title="Abonnement" subtitle="Votre plan, vos athlètes et vos factures.">
        @if (data(); as billing) {
          @if (!billing.configured) {
            <span class="chip chip-warn"><tw-icon name="alert" [size]="13" [strokeWidth]="2" />Paiement pas encore branché</span>
          }
        }
      </tw-page-header>

      @if (billing.loading()) {
        <tw-state kind="loading" />
      } @else if (billing.error()) {
        <tw-state kind="error" [message]="billing.error()">
          <button class="btn btn-ghost btn-sm" type="button" (click)="billing.reload()">Réessayer</button>
        </tw-state>
      } @else if (data(); as state) {
        @if (justPaid()) {
          <div class="banner">
            <tw-icon name="check" [size]="18" [strokeWidth]="2" />
            <span class="body grow">Paiement accepté. Votre plan se met à jour dès que Stripe nous l'a confirmé.</span>
            <button class="link" type="button" (click)="billing.reload(true)">Rafraîchir</button>
          </div>
        }

        <div class="cols">
          <div class="col">
            <section class="card card-pad current">
              <div class="spread">
                <div class="stack">
                  <span class="overline">Plan actuel</span>
                  <span class="display">{{ current().name }}</span>
                </div>
                <div class="stack right">
                  <span class="h2 num">{{ priceLabel() }}</span>
                  <span class="small muted">{{ state.subscription.cycle === 'yearly' ? 'facturé chaque année' : 'facturé chaque mois' }}</span>
                </div>
              </div>

              @if (state.subscription.status === 'past_due') {
                <p class="small err note">Le dernier prélèvement a échoué. Mettez votre carte à jour pour garder votre plan.</p>
              }

              <div class="usage">
                <div class="usage-line">
                  <span class="body grow">Athlètes suivis</span>
                  <span class="h3 num">{{ state.usage.athletes }}{{ state.usage.athleteLimit ? ' / ' + state.usage.athleteLimit : '' }}</span>
                </div>
                <div class="bar">
                  <span class="fill" [class.full]="overLimit()" [style.width.%]="usagePercent()"></span>
                </div>
                @if (overLimit()) {
                  <span class="small err">Ce plan couvre {{ state.usage.athleteLimit }} athlètes. Passez au plan supérieur pour en suivre plus.</span>
                } @else if (state.usage.athleteLimit) {
                  <span class="small muted">Il vous reste {{ state.usage.athleteLimit - state.usage.athletes }} places sur ce plan.</span>
                } @else {
                  <span class="small muted">Athlètes sans limite.</span>
                }
              </div>

              <div class="usage">
                <div class="usage-line">
                  <span class="body grow">Groupes</span>
                  <span class="h3 num">
                    {{ state.usage.groups }}{{ state.usage.groupLimit !== null ? ' / ' + state.usage.groupLimit : '' }}
                  </span>
                </div>
                @if (state.usage.groupLimit === 0) {
                  <span class="small muted">Les groupes font partie du plan Coach.</span>
                } @else if (state.usage.groupLimit === null) {
                  <span class="small muted">Groupes sans limite.</span>
                }
              </div>

              <div class="renew">
                <tw-icon name="calendar" [size]="16" />
                <span class="small muted grow">
                  @if (state.subscription.cancelAtPeriodEnd) {
                    Votre plan prend fin le {{ renewLabel() }}
                  } @else if (state.subscription.renewsOn) {
                    Prochain prélèvement le {{ renewLabel() }}
                  } @else {
                    Aucun prélèvement en cours
                  }
                </span>
                @if (state.subscription.managed) {
                  <button class="link" type="button" [disabled]="leaving()" (click)="openPortal()">Gérer l'abonnement</button>
                } @else if (state.subscription.planId !== 'decouverte') {
                  <span class="caption muted-3">Plan offert</span>
                }
              </div>
            </section>
          </div>

          <aside class="col">
            <section class="card card-pad">
              <span class="h2">Moyen de paiement</span>
              @if (state.card; as card) {
                <div class="card-row">
                  <span class="tile"><tw-icon name="lock" [size]="18" /></span>
                  <div class="stack grow">
                    <span class="h3">{{ card.brand }} •••• {{ card.last4 }}</span>
                    <span class="small muted">Expire {{ card.expires }}</span>
                  </div>
                  <button class="link" type="button" [disabled]="leaving()" (click)="openPortal()">Modifier</button>
                </div>
              } @else {
                <p class="small muted mt-sm">
                  Aucune carte enregistrée. Le formulaire de carte est celui de Stripe : les coordonnées bancaires ne passent jamais par Trainwise.
                </p>
              }
            </section>

            <section class="card">
              <div class="card-pad head-pad">
                <span class="h2">Factures</span>
              </div>
              @for (invoice of state.invoices; track invoice.id) {
                <div class="invoice">
                  <div class="stack grow">
                    <span class="h3">{{ invoice.label }}</span>
                    <span class="small muted">{{ invoice.date ? dayLabel(invoice.date) : '' }} · {{ invoice.id }}</span>
                  </div>
                  <span class="body num">{{ invoice.amount }} €</span>
                  <span class="chip" [class.chip-done]="invoice.status === 'paid'">{{ invoice.status === 'paid' ? 'Payée' : 'En attente' }}</span>
                  @if (invoice.url) {
                    <a class="icon-btn" [href]="invoice.url" target="_blank" rel="noopener" aria-label="Ouvrir la facture">
                      <tw-icon name="chevron-right" [size]="18" />
                    </a>
                  }
                </div>
              } @empty {
                <p class="small muted card-pad">Aucune facture pour l'instant.</p>
              }
            </section>
          </aside>
        </div>

        <section class="card card-pad">
          <div class="spread mb">
            <span class="h2">Changer de plan</span>
            <div class="segmented">
              <button type="button" class="seg" [class.on]="cycle() === 'monthly'" (click)="cycle.set('monthly')">Mensuel</button>
              <button type="button" class="seg" [class.on]="cycle() === 'yearly'" (click)="cycle.set('yearly')">Annuel · 2 mois offerts</button>
            </div>
          </div>

          <div class="plans">
            @for (plan of state.plans; track plan.id) {
              <div class="plan" [class.on]="plan.id === current().id" [class.tight]="tooSmall(plan)">
                <div class="plan-head">
                  <span class="h3">{{ plan.name }}</span>
                  @if (plan.id === current().id) {
                    <span class="chip chip-done">Actuel</span>
                  }
                </div>
                <div class="price">
                  <span class="num big">{{ priceOf(plan, cycle()) }} €</span>
                  <span class="caption muted">/ mois</span>
                </div>
                @if (cycle() === 'yearly' && savingOf(plan) > 0) {
                  <span class="caption saving num">{{ savingOf(plan) }} € économisés par an</span>
                }
                <span class="small muted pitch">{{ plan.pitch }}</span>
                <ul class="features">
                  @for (feature of plan.features; track feature) {
                    <li><tw-icon name="check" [size]="14" [strokeWidth]="2" />{{ feature }}</li>
                  }
                </ul>
                @if (tooSmall(plan)) {
                  <span class="caption err">Trop petit pour vos {{ state.usage.athletes }} athlètes</span>
                }
                <button
                  class="btn btn-block"
                  [class.btn-primary]="plan.id !== current().id"
                  [class.btn-ghost]="plan.id === current().id"
                  type="button"
                  [disabled]="plan.id === current().id || tooSmall(plan) || plan.id === 'decouverte'"
                  (click)="choose(plan)"
                >
                  {{ planAction(plan) }}
                </button>
              </div>
            }
          </div>

          @if (!state.configured) {
            <p class="small muted note">
              Les tarifs sont en place, le paiement attend encore les clés Stripe. Choisir un plan restera sans effet tant qu'elles manquent.
            </p>
          }
          <p class="caption muted-3 note">Prix hors taxes. Résiliable à tout moment depuis le portail.</p>
        </section>

        @if (pending(); as plan) {
          <div class="scrim" (click)="close()">
            <div class="card modal" (click)="$event.stopPropagation()">
              <div class="spread">
                <span class="h2">Récapitulatif</span>
                <button class="icon-btn" type="button" (click)="close()" aria-label="Fermer">
                  <tw-icon name="close" [size]="18" />
                </button>
              </div>

              <div class="lines">
                <div class="line">
                  <span class="grow body muted">Plan</span>
                  <span class="h3">{{ plan.name }}</span>
                </div>
                <div class="line">
                  <span class="grow body muted">Facturation</span>
                  <span class="h3">{{ cycle() === 'yearly' ? 'Annuelle' : 'Mensuelle' }}</span>
                </div>
                <div class="line">
                  <span class="grow body muted">Athlètes inclus</span>
                  <span class="h3 num">{{ plan.athletes ?? 'Sans limite' }}</span>
                </div>
                <div class="line">
                  <span class="grow body muted">Groupes</span>
                  <span class="h3 num">{{ plan.groups === null ? 'Sans limite' : plan.groups }}</span>
                </div>
                <div class="line total">
                  <span class="grow body">À payer aujourd'hui</span>
                  <span class="h2 num">{{ dueToday(plan) }} €</span>
                </div>
              </div>

              <p class="small muted note">
                {{
                  cycle() === 'yearly'
                    ? 'Puis ' + priceOf(plan, cycle()) * 12 + ' € chaque année. Résiliable à tout moment.'
                    : 'Puis ' + priceOf(plan, cycle()) + ' € chaque mois. Résiliable à tout moment.'
                }}
              </p>

              <div class="secure">
                <tw-icon name="lock" [size]="16" />
                <span class="small muted grow">Le paiement se fait dans la fenêtre sécurisée de Stripe.</span>
              </div>

              @if (error()) {
                <p class="small err note">{{ error() }}</p>
              }

              <div class="row">
                <button class="btn btn-ghost grow" type="button" (click)="close()">Annuler</button>
                <button class="btn btn-primary grow" type="button" [disabled]="leaving()" (click)="pay(plan)">
                  {{ leaving() ? 'Ouverture de Stripe…' : 'Continuer vers le paiement' }}
                </button>
              </div>
            </div>
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
        gap: 20px;
      }

      .banner {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 18px;
        border-radius: var(--r-lg, 16px);
        background: var(--success-soft);
        color: var(--success-ink);
      }

      .cols {
        display: grid;
        grid-template-columns: minmax(0, 1.75fr) minmax(0, 1fr);
        gap: 20px;
        align-items: start;
      }

      .col {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }

      .current {
        border-color: var(--border-strong);
      }

      .stack.right {
        align-items: flex-end;
      }

      .usage {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 18px;
      }

      .usage-line {
        display: flex;
        align-items: baseline;
        gap: 12px;
      }

      .bar {
        height: 8px;
        border-radius: var(--r-pill);
        background: var(--subtle);
        overflow: hidden;
      }

      .fill {
        display: block;
        height: 100%;
        border-radius: var(--r-pill);
        background: var(--accent);
      }

      .fill.full {
        background: var(--danger);
      }

      .renew {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid var(--border);
        color: var(--text2);
      }

      .plans {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
      }

      .plan {
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        padding: 20px 18px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
      }

      .plan.on {
        border-color: var(--brand);
        box-shadow: inset 0 0 0 1px var(--brand);
      }

      .plan.tight {
        opacity: 0.6;
      }

      .plan-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }

      .price {
        display: flex;
        align-items: baseline;
        gap: 4px;
      }

      .big {
        font-size: 26px;
        line-height: 32px;
        font-weight: 600;
      }

      .saving {
        color: var(--success-ink);
      }

      .pitch {
        min-height: 36px;
      }

      .features {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
      }

      .features li {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        font-size: 13px;
        line-height: 18px;
        color: var(--text2);
      }

      .features tw-icon {
        color: var(--success);
        flex-shrink: 0;
        margin-top: 2px;
      }

      .card-row,
      .invoice {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .invoice {
        padding: 12px 20px;
        border-top: 1px solid var(--border);
      }

      .head-pad {
        padding-bottom: 12px;
      }

      .tile {
        width: 40px;
        height: 40px;
        border-radius: var(--r-md);
        background: var(--subtle);
        color: var(--text2);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
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

      .card-row {
        margin-top: 14px;
      }

      .row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 14px;
      }

      .note {
        margin: 12px 0 0;
      }

      .mb {
        margin-bottom: 14px;
      }

      .mt-sm {
        margin-top: 8px;
      }

      .err {
        color: var(--danger);
      }

      .scrim {
        position: fixed;
        inset: 0;
        background: var(--overlay);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 50;
      }

      .modal {
        width: 460px;
        max-width: calc(100vw - 48px);
        padding: 24px;
      }

      .lines {
        display: flex;
        flex-direction: column;
        margin-top: 12px;
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

      .line.total {
        border-top: 1px solid var(--border-strong);
        margin-top: 4px;
      }

      .secure {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 14px;
        padding: 12px 14px;
        border-radius: var(--r-md);
        border: 1px dashed var(--border-strong);
      }

      @media (max-width: 1280px) {
        .cols {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      @media (max-width: 1080px) {
        .plans {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `,
  ],
})
export class CoachBillingPage {
  private readonly billingApi = inject(BillingService);
  private readonly route = inject(ActivatedRoute);

  readonly priceOf = priceOf;
  readonly savingOf = savingOf;

  readonly billing = load(() => this.billingApi.billing$());
  readonly data = computed(() => this.billing.data());

  readonly cycle = signal<BillingCycle>('monthly');
  readonly pending = signal<Plan | null>(null);
  readonly leaving = signal(false);
  readonly error = signal('');

  /** Retour de Stripe : l'abonnement arrive par webhook, parfois une seconde plus tard. */
  readonly justPaid = signal(this.route.snapshot.queryParamMap.get('paiement') === 'ok');

  constructor() {
    // Le cycle affiché part de celui que le coach paie déjà, puis il lui appartient.
    const stop = effect(() => {
      const cycle = this.billing.data()?.subscription.cycle;
      if (!cycle) return;
      untracked(() => this.cycle.set(cycle));
      stop.destroy();
    });
  }

  readonly current = computed(() => {
    const state = this.data();
    const plans = state?.plans ?? [];
    return plans.find((plan) => plan.id === state?.subscription.planId) ?? plans[0] ?? EMPTY_PLAN;
  });

  readonly usagePercent = computed(() => {
    const state = this.data();
    if (!state?.usage.athleteLimit) return 12;
    return Math.min(100, Math.round((state.usage.athletes / state.usage.athleteLimit) * 100));
  });

  readonly overLimit = computed(() => {
    const state = this.data();
    return Boolean(state?.usage.athleteLimit && state.usage.athletes > state.usage.athleteLimit);
  });

  readonly renewLabel = computed(() => {
    const iso = this.data()?.subscription.renewsOn;
    return iso ? formatDayShort(iso) : '—';
  });

  priceLabel() {
    const plan = this.current();
    const cycle = this.data()?.subscription.cycle ?? 'monthly';
    const price = priceOf(plan, cycle);
    if (!price) return 'Gratuit';
    return cycle === 'yearly' ? `${price * 12} € / an` : `${price} € / mois`;
  }

  /** Un plan qui ne couvre pas les athlètes déjà suivis ne peut pas être choisi. */
  tooSmall(plan: Plan) {
    const used = this.data()?.usage.athletes ?? 0;
    return Boolean(plan.athletes && used > plan.athletes);
  }

  planAction(plan: Plan) {
    if (plan.id === this.current().id) return 'Votre plan';
    if (plan.id === 'decouverte') return 'Plan de départ';
    return priceOf(plan, this.cycle()) > priceOf(this.current(), this.cycle()) ? 'Passer à ce plan' : 'Revenir à ce plan';
  }

  dueToday(plan: Plan) {
    const price = priceOf(plan, this.cycle());
    return this.cycle() === 'yearly' ? price * 12 : price;
  }

  dayLabel(iso: string) {
    return formatDayShort(iso);
  }

  choose(plan: Plan) {
    this.error.set('');
    this.pending.set(plan);
  }

  /** On quitte Trainwise : le paiement se passe entièrement chez Stripe. */
  pay(plan: Plan) {
    if (this.leaving()) return;
    this.leaving.set(true);
    this.error.set('');
    this.billingApi.checkout(plan.id, this.cycle()).subscribe({
      next: ({ url }) => (window.location.href = url),
      error: (err: unknown) => {
        this.leaving.set(false);
        this.error.set(err instanceof ApiError ? err.message : 'Le paiement est indisponible pour le moment.');
      },
    });
  }

  openPortal() {
    if (this.leaving()) return;
    this.leaving.set(true);
    this.billingApi.portal().subscribe({
      next: ({ url }) => (window.location.href = url),
      error: () => this.leaving.set(false),
    });
  }

  close() {
    this.pending.set(null);
    this.error.set('');
  }
}

const EMPTY_PLAN: Plan = {
  id: 'decouverte',
  name: 'Découverte',
  pitch: '',
  monthly: 0,
  yearlyMonthly: 0,
  athletes: 3,
  groups: 0,
  customAlerts: false,
  features: [],
};
