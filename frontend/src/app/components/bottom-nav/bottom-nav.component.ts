import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { FriendService } from '../../services/friend.service';
import { AthleteService } from '../../services/athlete.service';
import { AuthService } from '../../services/auth.service';
import { Coach } from '../../interfaces/coach.interfaces';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss'
})
export class BottomNavComponent implements OnInit {
  currentCoach = signal<Coach | null>(null);
  isLoadingCoach = signal(true);

  constructor(
    public chatService: ChatService,
    public friendService: FriendService,
    private athleteService: AthleteService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Charger le coach uniquement si l'utilisateur n'est pas un coach
    if (!this.authService.isCoach()) {
      this.loadCurrentCoach();
    } else {
      this.isLoadingCoach.set(false);
    }
  }

  loadCurrentCoach() {
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
      // Si pas de coach, rediriger vers la page de découverte (profil d'Hugo)
      // Pour l'instant, on va créer une route vers /discover-coach
      // TODO: Obtenir l'ID d'Hugo depuis le backend ou config
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
