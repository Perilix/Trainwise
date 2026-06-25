import { Injectable, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/api/auth`;

  /** Vrai si l'utilisateur connecté n'a pas encore complété l'onboarding */
  showOnboarding = computed(() => {
    const user = this.authService.currentUser();
    return !!user && user.role === 'user' && !user.hasCompletedOnboarding;
  });

  /** Vrai si la visite guidée de cette page a déjà été vue (état stocké en base sur le user). */
  hasSeenTour(pageId: string): boolean {
    return this.authService.currentUser()?.toursSeen?.includes(pageId) ?? false;
  }

  /** Marque la visite guidée comme vue : mise à jour optimiste locale + persistance en base. */
  markTourSeen(pageId: string): void {
    const user = this.authService.currentUser();
    if (!user || user.toursSeen?.includes(pageId)) return;

    this.authService.mergeCurrentUser({ toursSeen: [...(user.toursSeen ?? []), pageId] });
    this.http.post(`${this.API_URL}/tours`, { pageId }).subscribe({ error: () => {} });
  }

  /** Réinitialise toutes les visites guidées (pour les rejouer). */
  resetTours(): void {
    this.authService.mergeCurrentUser({ toursSeen: [] });
    this.http.delete(`${this.API_URL}/tours`).subscribe({ error: () => {} });
  }
}
