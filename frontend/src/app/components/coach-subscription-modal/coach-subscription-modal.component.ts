import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { CoachPackage, COACH_PACKAGES, PackageType } from '../../interfaces/package.interface';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-coach-subscription-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-subscription-modal.component.html',
  styleUrl: './coach-subscription-modal.component.scss'
})
export class CoachSubscriptionModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() contactCoach = new EventEmitter<void>();

  private subscriptionService = inject(SubscriptionService);

  isNative = Capacitor.isNativePlatform();
  readonly packages: CoachPackage[] = [COACH_PACKAGES.bronze, COACH_PACKAGES.silver, COACH_PACKAGES.gold];

  selected = signal<PackageType>('silver');
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  get selectedPackage(): CoachPackage {
    return COACH_PACKAGES[this.selected()];
  }

  select(type: PackageType) {
    this.selected.set(type);
    this.errorMessage.set(null);
  }

  async subscribe() {
    if (!this.isNative) {
      this.contactCoach.emit();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      await this.subscriptionService.purchasePackage(this.selectedPackage.revenueCatId);
      this.successMessage.set(`Abonnement ${this.selectedPackage.name} activé !`);
      setTimeout(() => this.close.emit(), 2000);
    } catch {
      this.errorMessage.set('Achat annulé ou indisponible.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
