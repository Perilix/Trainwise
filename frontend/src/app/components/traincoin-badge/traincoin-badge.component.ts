import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-traincoin-badge',
  standalone: true,
  template: `
    <button class="traincoin-badge" (click)="goToShop()" title="TrainCoins">
      <i class="fa-solid fa-bolt"></i>
      <span>{{ subscriptionService.trainCoins() }}</span>
    </button>
  `,
  styles: [`
    .traincoin-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(245, 158, 11, 0.15);
      border: 1.5px solid rgba(245, 158, 11, 0.4);
      border-radius: 20px;
      padding: 4px 10px;
      cursor: pointer;
      transition: background 0.2s;

      i {
        color: #F59E0B;
        font-size: 0.75rem;
      }

      span {
        color: #F59E0B;
        font-size: 0.78rem;
        font-weight: 700;
        font-family: 'Poppins', sans-serif;
      }

      &:active {
        background: rgba(245, 158, 11, 0.25);
      }
    }
  `]
})
export class TraincoinBadgeComponent {
  subscriptionService = inject(SubscriptionService);
  private router = inject(Router);

  goToShop() {
    this.router.navigate(['/shop']);
  }
}
