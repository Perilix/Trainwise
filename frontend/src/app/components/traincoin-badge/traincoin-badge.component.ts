import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-traincoin-badge',
  standalone: true,
  template: `
    @if (subscriptionService.isPro()) {
      <button class="pro-badge" (click)="goToShop()">PRO</button>
    } @else {
      <button class="traincoin-badge" (click)="goToShop()" title="TrainCoins">
        <i class="fa-solid fa-bolt"></i>
        <span>{{ subscriptionService.trainCoins() }}</span>
      </button>
    }
  `,
  styles: [`
    .pro-badge {
      background: #f0fdf4;
      color: #16a34a;
      border: 1.5px solid rgba(22, 163, 74, 0.35);
      font-size: 0.70rem;
      font-weight: 800;
      font-family: 'Poppins', sans-serif;
      letter-spacing: 0.8px;
      padding: 5px 10px;
      border-radius: 20px;
      cursor: pointer;
    }

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
