import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.scss'
})
export class ShopComponent implements OnInit {
  subscriptionService = inject(SubscriptionService);
  private router = inject(Router);

  isNative = Capacitor.isNativePlatform();
  isLoadingPro = signal(false);
  isLoadingCoins = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  proPlan = signal<'monthly' | 'annual'>('annual');

  // Offre fondateurs : passer à false à la fin des 3 mois de lancement.
  readonly launchPromo = true;

  // Prix affichés : on privilégie le prix réel de l'App Store (via RevenueCat) ;
  // à défaut (web, offering pas encore chargé) on retombe sur les prix par défaut.
  get monthlyPrice() { return this.subscriptionService.prices()['trainwise_pro_monthly'] ?? '9,99€'; }
  get annualPrice() { return this.subscriptionService.prices()['trainwise_pro_annual'] ?? (this.launchPromo ? '59,99€' : '79,99€'); }
  get coins10Price() { return this.subscriptionService.prices()['trainwise_coins_10'] ?? '2,99€'; }
  get coins50Price() { return this.subscriptionService.prices()['trainwise_coins_50b'] ?? '9,99€'; }

  ngOnInit() {
    // Rafraîchit les prix réels au cas où la boutique est ouverte directement.
    this.subscriptionService.loadOfferings();
  }

  get isPro() { return this.subscriptionService.isPro(); }
  get coins() { return this.subscriptionService.trainCoins(); }

  async subscribePro() {
    if (!this.isNative) return;
    this.isLoadingPro.set(true);
    this.errorMessage.set(null);
    try {
      const packageId = this.proPlan() === 'annual' ? 'trainwise_pro_annual' : 'trainwise_pro_monthly';
      await this.subscriptionService.purchasePackage(packageId);
      this.successMessage.set('Abonnement Pro activé !');
      setTimeout(() => this.successMessage.set(null), 4000);
    } catch {
      this.errorMessage.set('Achat annulé ou indisponible.');
    } finally {
      this.isLoadingPro.set(false);
    }
  }

  coinsPack = signal<10 | 50>(10);

  async buyCoins() {
    if (!this.isNative) return;
    this.isLoadingCoins.set(true);
    this.errorMessage.set(null);
    try {
      const pack = this.coinsPack();
      // Le pack 50 utilise l'ID `_50b` (l'ancien `trainwise_coins_50` a été supprimé sur l'App Store).
      const productId = pack === 50 ? 'trainwise_coins_50b' : 'trainwise_coins_10';
      await this.subscriptionService.purchasePackage(productId);
      this.successMessage.set(`+${pack} TrainCoins ajoutés !`);
      setTimeout(() => this.successMessage.set(null), 4000);
    } catch {
      this.errorMessage.set('Achat annulé ou indisponible.');
    } finally {
      this.isLoadingCoins.set(false);
    }
  }

  async restorePurchases() {
    this.errorMessage.set(null);
    try {
      await this.subscriptionService.restorePurchases();
      this.successMessage.set('Achats restaurés avec succès.');
      setTimeout(() => this.successMessage.set(null), 4000);
    } catch {
      this.errorMessage.set('Impossible de restaurer les achats.');
    }
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
