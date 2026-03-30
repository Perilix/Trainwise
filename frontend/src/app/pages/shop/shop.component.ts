import { Component, inject, signal } from '@angular/core';
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
export class ShopComponent {
  subscriptionService = inject(SubscriptionService);
  private router = inject(Router);

  isNative = Capacitor.isNativePlatform();
  isLoadingPro = signal(false);
  isLoadingCoins = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  get isPro() { return this.subscriptionService.isPro(); }
  get coins() { return this.subscriptionService.trainCoins(); }

  async subscribePro() {
    if (!this.isNative) return;
    this.isLoadingPro.set(true);
    this.errorMessage.set(null);
    try {
      await this.subscriptionService.purchasePackage('trainwise_pro_monthly');
      this.successMessage.set('Abonnement Pro activé !');
      setTimeout(() => this.successMessage.set(null), 4000);
    } catch {
      this.errorMessage.set('Achat annulé ou indisponible.');
    } finally {
      this.isLoadingPro.set(false);
    }
  }

  async buyCoins() {
    if (!this.isNative) return;
    this.isLoadingCoins.set(true);
    this.errorMessage.set(null);
    try {
      await this.subscriptionService.purchasePackage('trainwise_coins_20');
      this.successMessage.set('+20 TrainCoins ajoutés !');
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
