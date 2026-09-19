import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ApiService } from '../../core/api.service';
import { load } from '../../core/load';
import { IconComponent } from '../../ui/icon.component';
import { PageHeaderComponent } from '../../ui/page-header.component';

type Status = { trainCoins: number; subscriptionStatus: 'pro' | 'free'; subscriptionExpiry: string | null; isPro: boolean };

/**
 * Boutique : les achats passent par les stores (RevenueCat), donc le web informe
 * et affiche le solde, sans proposer de paiement qui ne pourrait pas aboutir.
 */
@Component({
  selector: 'tw-shop',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PageHeaderComponent],
  template: `
    <main class="page">
      <tw-page-header title="Boutique" subtitle="Abonnement et TrainCoins pour les fonctionnalités IA.">
        <span class="coins">
          <tw-icon name="zap" [size]="18" />
          {{ status.data()?.trainCoins ?? 0 }} TrainCoins
        </span>
      </tw-page-header>

      <section class="card notice">
        <span class="tile"><tw-icon name="phone" [size]="20" /></span>
        <div class="stack grow">
          <span class="h3">Les achats se font depuis l'application mobile</span>
          <span class="small muted">Ton abonnement et tes coins sont ensuite disponibles ici automatiquement.</span>
        </div>
        <a class="btn btn-ghost btn-sm" href="https://www.trainwise-app.com" target="_blank" rel="noopener">Télécharger l'app</a>
      </section>

      <div class="offers">
        <section class="card card-pad offer">
          <div class="offer-head">
            <span class="tile violet"><tw-icon name="sparkles" [size]="20" /></span>
            <div class="stack grow">
              <div class="line">
                <span class="offer-title">Trainwise Pro</span>
                @if (status.data()?.isPro) {
                  <span class="chip chip-done">Actif</span>
                } @else {
                  <span class="chip chip-coach">Recommandé</span>
                }
              </div>
              <span class="small muted">Toutes les fonctionnalités IA, sans limite.</span>
            </div>
          </div>

          <div class="features">
            @for (feature of proFeatures; track feature) {
              <div class="feature">
                <span class="check"><tw-icon name="check" [size]="14" [strokeWidth]="2.5" /></span>
                <span class="body">{{ feature }}</span>
              </div>
            }
          </div>

          <div class="prices">
            <div class="price">
              <span class="caption muted">Mensuel</span>
              <div class="amount"><span class="num">9,99 €</span><span class="small muted">/mois</span></div>
            </div>
            <div class="price best">
              <span class="best-flag"><tw-icon name="star" [size]="13" [strokeWidth]="2" /></span>
              <span class="caption muted">Annuel</span>
              <div class="amount"><span class="num">59,99 €</span><span class="small muted">/an</span></div>
              <div class="line wrap">
                <span class="caption muted-3 num">au lieu de 79,99 €</span>
                <span class="caption saving">soit 5 €/mois</span>
              </div>
            </div>
          </div>

          <div class="cta">
            <tw-icon name="phone" [size]="16" />
            <span class="small">{{ status.data()?.isPro ? 'Abonnement actif' : "Disponible dans l'app mobile" }}</span>
          </div>
        </section>

        <section class="card card-pad offer">
          <div class="offer-head">
            <span class="tile accent"><tw-icon name="zap" [size]="20" /></span>
            <div class="stack grow">
              <span class="offer-title">Pack TrainCoins</span>
              <span class="small muted">Recharge ton solde, sans abonnement.</span>
            </div>
          </div>

          <div class="features">
            <div class="feature"><span class="check accent"><tw-icon name="zap" [size]="14" /></span><span class="body">1 coin = 1 analyse de séance</span></div>
            <div class="feature"><span class="check accent"><tw-icon name="zap" [size]="14" /></span><span class="body">5 coins = 1 plan IA</span></div>
          </div>

          <div class="prices">
            <div class="price">
              <span class="caption muted">10 coins</span>
              <div class="amount"><span class="num">2,99 €</span></div>
            </div>
            <div class="price best">
              <span class="best-flag"><tw-icon name="star" [size]="13" [strokeWidth]="2" /></span>
              <span class="caption muted">50 coins</span>
              <div class="amount"><span class="num">9,99 €</span></div>
              <div class="line wrap">
                <span class="chip chip-done">Meilleur prix</span>
                <span class="caption muted num">0,20 €/coin</span>
              </div>
            </div>
          </div>

          <div class="cta">
            <tw-icon name="phone" [size]="16" />
            <span class="small">Disponible dans l'app mobile</span>
          </div>
        </section>
      </div>
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

      .coins {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 40px;
        padding: 0 14px;
        border-radius: var(--r-md);
        background: var(--surface);
        border: 1px solid var(--border);
        font-size: 14px;
        font-weight: 600;
      }

      .coins tw-icon {
        color: var(--warn);
      }

      .notice {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px 20px;
      }

      .tile {
        width: 40px;
        height: 40px;
        border-radius: var(--r-md);
        background: var(--subtle);
        color: var(--ink);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .tile.violet {
        background: var(--violet-soft);
        color: var(--violet-ink);
      }

      .tile.accent {
        background: var(--accent-soft);
        color: var(--accent-ink);
      }

      .offers {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;
        align-items: start;
      }

      .offer {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .offer-head {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .offer-title {
        font-size: 18px;
        line-height: 26px;
        font-weight: 600;
      }

      .line {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .line.wrap {
        flex-wrap: wrap;
      }

      .features {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .feature {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .check {
        width: 24px;
        height: 24px;
        border-radius: var(--r-pill);
        background: var(--success-soft);
        color: var(--success-ink);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .check.accent {
        background: var(--accent-soft);
        color: var(--accent-ink);
      }

      .prices {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .price {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 14px;
        border-radius: var(--r-md);
        border: 1px solid var(--border);
      }

      .price.best {
        border-color: var(--brand);
      }

      .best-flag {
        position: absolute;
        top: 10px;
        right: 10px;
        color: var(--warn);
      }

      .amount {
        display: flex;
        align-items: baseline;
        gap: 2px;
      }

      .amount .num {
        font-size: 22px;
        line-height: 30px;
        font-weight: 600;
      }

      .saving {
        color: var(--success-ink);
        font-weight: 600;
      }

      .cta {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 44px;
        border-radius: var(--r-md);
        background: var(--subtle);
        color: var(--text2);
      }
    `,
  ],
})
export class ShopPage {
  private readonly api = inject(ApiService);

  readonly proFeatures = ['IA illimitée', 'Plans personnalisés premium', 'Analyses détaillées', 'Support prioritaire'];

  readonly status = load(() =>
    this.api.getOr<Status>('/api/subscription/status', {
      trainCoins: 0,
      subscriptionStatus: 'free',
      subscriptionExpiry: null,
      isPro: false,
    }),
  );
}
