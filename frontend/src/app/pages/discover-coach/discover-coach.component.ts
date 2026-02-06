import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { ChatService, UserPreview } from '../../services/chat.service';
import { AthleteService } from '../../services/athlete.service';

@Component({
  selector: 'app-discover-coach',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './discover-coach.component.html',
  styleUrl: './discover-coach.component.scss'
})
export class DiscoverCoachComponent implements OnInit {
  partnerCoach = signal<UserPreview | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  isJoining = signal(false);

  constructor(
    private chatService: ChatService,
    private athleteService: AthleteService,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit() {
    this.loadPartnerCoach();
  }

  goBack() {
    this.location.back();
  }

  loadPartnerCoach() {
    this.chatService.getPartnerCoach().subscribe({
      next: (coach) => {
        this.partnerCoach.set(coach);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Impossible de charger les informations du coach');
        this.isLoading.set(false);
      }
    });
  }

  contactCoach() {
    const coach = this.partnerCoach();
    if (!coach) return;

    this.chatService.getOrCreateConversation(coach._id).subscribe({
      next: (conversation) => {
        this.router.navigate(['/chat', conversation._id]);
      },
      error: (err) => {
        console.error('Erreur lors de la création de la conversation:', err);
        this.error.set('Impossible de contacter le coach');
      }
    });
  }
}
