import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  // Prix localisés (clé = product id). Les achats passent par l'app mobile :
  // sur le web la map reste vide et l'UI affiche ses prix par défaut.
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

  /** Rafraîchit le statut depuis l'API (après un achat fait sur mobile) */
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

  /** Pas de catalogue de prix sur le web (achats dans l'app mobile). */
  async loadOfferings(): Promise<void> {}

  /** Pas d'achat sur le web (achats dans l'app mobile). */
  async purchasePackage(_packageIdentifier: string): Promise<boolean> {
    return false;
  }

  /** Sur le web, « restaurer » revient à relire le statut côté API. */
  async restorePurchases(): Promise<void> {
    await this.refreshStatus();
  }
}
