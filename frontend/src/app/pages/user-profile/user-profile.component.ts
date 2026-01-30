import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { ChatService } from '../../services/chat.service';
import { environment } from '../../../environments/environment';

interface UserProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
  runningLevel?: string;
  goal?: string;
  weeklyFrequency?: number;
  createdAt: Date;
}

interface UserStats {
  totalRuns: number;
  totalDistance: number;
  totalDuration: number;
}

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss'
})
export class UserProfileComponent implements OnInit {
  user = signal<UserProfile | null>(null);
  stats = signal<UserStats | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  private apiUrl = `${environment.apiUrl}/api/friends`;

  runningLevels: Record<string, string> = {
    'debutant': 'Débutant',
    'intermediaire': 'Intermédiaire',
    'confirme': 'Confirmé',
    'expert': 'Expert'
  };

  goals: Record<string, string> = {
    'remise_en_forme': 'Remise en forme',
    '5km': '5 km',
    '10km': '10 km',
    'semi_marathon': 'Semi-marathon',
    'marathon': 'Marathon',
    'trail': 'Trail',
    'ultra': 'Ultra-trail',
    'autre': 'Autre'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private chatService: ChatService,
    private location: Location
  ) {}

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id');
    if (userId) {
      this.loadUserProfile(userId);
    } else {
      this.error.set('Utilisateur non trouvé');
      this.isLoading.set(false);
    }
  }

  loadUserProfile(userId: string): void {
    this.isLoading.set(true);
    this.http.get<{ user: UserProfile; stats: UserStats }>(`${this.apiUrl}/profile/${userId}`).subscribe({
      next: (response) => {
        this.user.set(response.user);
        this.stats.set(response.stats);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Impossible de charger le profil');
        this.isLoading.set(false);
      }
    });
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }

  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  }

  openConversation(): void {
    const userId = this.user()?._id;
    if (!userId) return;

    this.chatService.getOrCreateConversation(userId).subscribe({
      next: (conversation) => {
        this.router.navigate(['/chat', conversation._id]);
      },
      error: (err) => {
        console.error('Erreur création conversation:', err);
      }
    });
  }

  goBack(): void {
    this.location.back();
  }
}
