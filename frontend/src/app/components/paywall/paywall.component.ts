import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-paywall',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paywall.component.html',
  styleUrl: './paywall.component.scss'
})
export class PaywallComponent {
  subscriptionService = inject(SubscriptionService);
  private router = inject(Router);

  isNative = Capacitor.isNativePlatform();
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  get action() { return this.subscriptionService.paywallAction(); }
  get coins() { return this.subscriptionService.trainCoins(); }

  get actionLabel(): string {
    if (this.action === 'analyze') return 'analyser un run';
    if (this.action === 'strava') return 'analyser vos sorties Strava';
    return 'générer un plan IA';
  }

  get coinCost(): number {
    if (this.action === 'analyze') return 1;
    if (this.action === 'strava') return 0.5;
    return 5;
  }

  async buyCoins() {
    if (!this.isNative) {
      this.goToShop();
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      await this.subscriptionService.purchasePackage('trainwise_coins_10');
      this.subscriptionService.closePaywall();
    } catch (e: any) {
      this.errorMessage.set("Achat annulé ou indisponible.");
    } finally {
      this.isLoading.set(false);
    }
  }

  async subscribePro() {
    if (!this.isNative) {
      this.goToShop();
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      await this.subscriptionService.purchasePackage('trainwise_pro_monthly');
      this.subscriptionService.closePaywall();
    } catch (e: any) {
      this.errorMessage.set("Achat annulé ou indisponible.");
    } finally {
      this.isLoading.set(false);
    }
  }

  goToShop() {
    this.subscriptionService.closePaywall();
    this.router.navigate(['/shop']);
  }

  close() {
    this.subscriptionService.closePaywall();
  }
}
