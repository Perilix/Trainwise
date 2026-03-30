import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export type PaywallAction = 'analyze' | 'generate';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly API = `${environment.apiUrl}/api/subscription`;

  // Paywall modal state
  showPaywall = signal(false);
  paywallAction = signal<PaywallAction | null>(null);

  // Computed depuis le user courant
  trainCoins = computed(() => this.authService.currentUser()?.trainCoins ?? 0);
  subscriptionStatus = computed(() => this.authService.currentUser()?.subscriptionStatus ?? 'free');
  subscriptionExpiry = computed(() => this.authService.currentUser()?.subscriptionExpiry ?? null);
  isPro = computed(() => {
    const status = this.subscriptionStatus();
    const expiry = this.subscriptionExpiry();
    return status === 'pro' && !!expiry && new Date(expiry) > new Date();
  });

  openPaywall(action: PaywallAction) {
    this.paywallAction.set(action);
    this.showPaywall.set(true);
  }

  closePaywall() {
    this.showPaywall.set(false);
    this.paywallAction.set(null);
  }

  /** Rafraîchit le statut depuis le backend (après achat) */
  refreshStatus(): Promise<void> {
    return new Promise(resolve => {
      this.http.get<any>(`${this.API}/status`).subscribe({
        next: (data) => {
          this.authService.updateLocalUser({
            trainCoins: data.trainCoins,
            subscriptionStatus: data.subscriptionStatus,
            subscriptionExpiry: data.subscriptionExpiry
          });
          resolve();
        },
        error: () => resolve()
      });
    });
  }

  /** Initialise RevenueCat (à appeler une fois au démarrage si natif) */
  async initRevenueCat(userId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { Purchases, LOG_LEVEL } = await import('@revenuecat/purchases-capacitor');
      const apiKey = Capacitor.getPlatform() === 'ios'
        ? environment.revenueCatAppleApiKey
        : environment.revenueCatGoogleApiKey;
      await Purchases.configure({ apiKey, appUserID: userId });

      // Lier l'userId RevenueCat au backend
      this.http.post(`${this.API}/link-revenuecat`, { revenueCatUserId: userId }).subscribe();
    } catch (e) {
      console.warn('RevenueCat init failed', e);
    }
  }

  /** Achète un package RevenueCat (natif uniquement) */
  async purchasePackage(packageIdentifier: string): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const offerings = await Purchases.getOfferings();
      const offering = offerings.current;
      if (!offering) throw new Error('Aucune offre disponible');

      const pkg = offering.availablePackages.find(
        (p: any) => p.identifier === packageIdentifier
      );
      if (!pkg) throw new Error('Package introuvable');

      await Purchases.purchasePackage({ aPackage: pkg });
      await this.refreshStatus();
      return true;
    } catch (e: any) {
      if (e?.code !== 'PURCHASE_CANCELLED') throw e;
      return false;
    }
  }

  /** Restore les achats (bouton standard exigé par Apple) */
  async restorePurchases(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      await Purchases.restorePurchases();
      await this.refreshStatus();
    } catch (e) {
      console.warn('Restore failed', e);
    }
  }
}
