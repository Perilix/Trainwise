import { Component, EventEmitter, inject, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoachPackage, COACH_PACKAGES, PackageType } from '../../interfaces/package.interface';
import { ChatService } from '../../services/chat.service';

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

  private chatService = inject(ChatService);

  readonly packages: CoachPackage[] = [COACH_PACKAGES.bronze, COACH_PACKAGES.silver, COACH_PACKAGES.gold];

  selected = signal<PackageType>('silver');
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  requestSent = signal(false);

  get selectedPackage(): CoachPackage {
    return COACH_PACKAGES[this.selected()];
  }

  select(type: PackageType) {
    this.selected.set(type);
    this.errorMessage.set(null);
  }

  sendRequest() {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.chatService.requestCoachSubscription(this.selected()).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.requestSent.set(true);
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Impossible d\'envoyer la demande. Réessaie dans un instant.');
      }
    });
  }
}
