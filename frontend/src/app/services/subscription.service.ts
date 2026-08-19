import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';
import { environment } from '../../environments/environment';

export type PaywallAction = 'analyze' | 'generate' | 'strava';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private socketService = inject(SocketService);
  private readonly API = `${environment.apiUrl}/api/subscription`;

  // Paywall modal state
  showPaywall = signal(false);
  paywallAction = signal<PaywallAction | null>(null);

  // Prix localisés récupérés depuis RevenueCat (clé = product id, ex: 'trainwise_pro_annual')
  // Vide tant que l'offering n'est pas chargé → l'UI retombe sur ses prix par défaut.
  prices = signal<Record<string, string>>({});

  constructor() {
    this.socketService.on<{ trainCoins?: number; subscriptionStatus?: string; subscriptionExpiry?: string | null }>('traincoin:update')
      .subscribe(data => {
        this.authService.updateLocalUser({
          ...(data.trainCoins !== undefined && { trainCoins: data.trainCoins }),
          ...(data.subscriptionStatus !== undefined && { subscriptionStatus: data.subscriptionStatus as any }),
          ...(data.subscriptionExpiry !== undefined && { subscriptionExpiry: data.subscriptionExpiry })
        });
      });
  }

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

      // Charger les prix réels de la boutique (App Store) pour l'affichage
      this.loadOfferings();
    } catch (e) {
      console.warn('RevenueCat init failed', e);
    }
  }

  /**
   * Récupère les prix localisés facturés par l'App Store (via l'offering courant)
   * et les stocke dans `prices` (clé = identifiant du package = product id).
   * L'affichage doit toujours prévoir un repli : sur le web, ou tant que ce chargement
   * n'a pas abouti, la map reste vide.
   */
  async loadOfferings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const offerings = await Purchases.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      const map: Record<string, string> = {};
      for (const p of packages as any[]) {
        const price = p?.product?.priceString;
        if (p?.identifier && price) map[p.identifier] = price;
      }
      this.prices.set(map);
    } catch (e) {
      console.warn('Load offerings failed', e);
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
