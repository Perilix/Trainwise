import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';

const TOURS_KEY = 'tw_tours_seen';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private authService = inject(AuthService);

  /** Vrai si l'utilisateur connecté n'a pas encore complété l'onboarding */
  showOnboarding = computed(() => {
    const user = this.authService.currentUser();
    return !!user && user.role === 'user' && !user.hasCompletedOnboarding;
  });

  hasSeenTour(pageId: string): boolean {
    try {
      const seen: string[] = JSON.parse(localStorage.getItem(TOURS_KEY) || '[]');
      return seen.includes(pageId);
    } catch {
      return false;
    }
  }

  markTourSeen(pageId: string): void {
    try {
      const seen: string[] = JSON.parse(localStorage.getItem(TOURS_KEY) || '[]');
      if (!seen.includes(pageId)) {
        seen.push(pageId);
        localStorage.setItem(TOURS_KEY, JSON.stringify(seen));
      }
    } catch {}
  }

  resetTours(): void {
    localStorage.removeItem(TOURS_KEY);
  }
}
