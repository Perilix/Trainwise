import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AthleteService } from './athlete.service';
import { AuthService } from './auth.service';
import { ChatService } from './chat.service';
import { Coach } from '../interfaces/coach.interfaces';

// Logique de navigation "Coach" partagée entre la bottom-nav (mobile) et la sidebar (desktop),
// toutes deux instanciées dans app.html : un seul chargement du coach courant par utilisateur.
@Injectable({ providedIn: 'root' })
export class CoachNavService {
  private athleteService = inject(AthleteService);
  private authService = inject(AuthService);
  private chatService = inject(ChatService);
  private router = inject(Router);

  currentCoach = signal<Coach | null>(null);
  isLoadingCoach = signal(true);

  private loadedForUserId: string | null = null;

  loadCurrentCoach() {
    const user = this.authService.currentUser();
    if (!user || this.authService.isCoach()) {
      this.isLoadingCoach.set(false);
      return;
    }
    if (this.loadedForUserId === user.id) {
      return;
    }
    this.loadedForUserId = user.id;
    this.isLoadingCoach.set(true);
    this.athleteService.getCurrentCoach().subscribe({
      next: (coach) => {
        this.currentCoach.set(coach);
        this.isLoadingCoach.set(false);
      },
      error: () => {
        this.currentCoach.set(null);
        this.isLoadingCoach.set(false);
      }
    });
  }

  navigateToCoach() {
    const coach = this.currentCoach();
    if (coach) {
      // Si l'athlète a un coach, créer/ouvrir la conversation avec lui
      this.chatService.getOrCreateConversation(coach._id).subscribe({
        next: (conversation) => {
          this.router.navigate(['/chat', conversation._id]);
        },
        error: (err) => {
          console.error('Erreur lors de la création de la conversation:', err);
        }
      });
    } else {
      this.router.navigate(['/discover-coach']);
    }
  }

  isCoachPageActive(): boolean {
    return this.router.url === '/discover-coach';
  }

  getCoachUnreadCount(): number {
    const coach = this.currentCoach();
    if (!coach) return 0;

    // Chercher la conversation avec le coach et retourner le nombre de messages non lus
    const conversations = this.chatService.conversations();
    const coachConversation = conversations.find(conv =>
      conv.otherParticipant?._id === coach._id
    );

    return coachConversation?.unreadCount || 0;
  }
}
