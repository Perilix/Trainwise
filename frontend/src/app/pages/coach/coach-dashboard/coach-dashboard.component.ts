import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CoachService } from '../../../services/coach.service';
import { AuthService } from '../../../services/auth.service';
import { Athlete, CoachStats, UserSearchResult, PendingInvitation } from '../../../interfaces/coach.interfaces';
import { NavbarComponent } from '../../../components/navbar/navbar.component';

@Component({
  selector: 'app-coach-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent],
  templateUrl: './coach-dashboard.component.html',
  styleUrl: './coach-dashboard.component.scss'
})
export class CoachDashboardComponent implements OnInit {
  athletes = signal<Athlete[]>([]);
  stats = signal<CoachStats | null>(null);
  pendingInvitations = signal<PendingInvitation[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Invitation modal
  showInviteModal = signal(false);
  inviteCode = signal<string | null>(null);
  isGeneratingCode = signal(false);
  searchQuery = signal('');
  searchResults = signal<UserSearchResult[]>([]);
  isSearching = signal(false);
  isSendingInvite = signal(false);

  constructor(
    private coachService: CoachService,
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.isLoading.set(true);
    this.error.set(null);

    Promise.all([
      this.coachService.getStats().toPromise(),
      this.coachService.getAthletes().toPromise(),
      this.coachService.getPendingInvitations().toPromise(),
      this.coachService.getInviteCode().toPromise()
    ]).then(([stats, athletes, pending, code]) => {
      this.stats.set(stats || null);
      this.athletes.set(athletes || []);
      this.pendingInvitations.set(pending || []);
      this.inviteCode.set(code?.code || null);
      this.isLoading.set(false);
    }).catch(err => {
      this.error.set('Erreur lors du chargement');
      this.isLoading.set(false);
      console.error(err);
    });
  }

  openInviteModal() {
    this.showInviteModal.set(true);
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  closeInviteModal() {
    this.showInviteModal.set(false);
  }

  generateCode() {
    this.isGeneratingCode.set(true);
    this.coachService.generateInviteCode().subscribe({
      next: (response) => {
        this.inviteCode.set(response.code);
        this.isGeneratingCode.set(false);
      },
      error: (err) => {
        this.error.set('Erreur lors de la génération du code');
        this.isGeneratingCode.set(false);
        console.error(err);
      }
    });
  }

  copyCode() {
    const code = this.inviteCode();
    if (code) {
      navigator.clipboard.writeText(code);
      this.successMessage.set('Code copié !');
      setTimeout(() => this.successMessage.set(null), 2000);
    }
  }

  searchUsers() {
    const query = this.searchQuery();
    if (query.length < 2) {
      this.searchResults.set([]);
      return;
    }

    this.isSearching.set(true);
    this.coachService.searchUsers(query).subscribe({
      next: (results) => {
        this.searchResults.set(results);
        this.isSearching.set(false);
      },
      error: (err) => {
        this.isSearching.set(false);
        console.error(err);
      }
    });
  }

  sendInvite(user: UserSearchResult) {
    this.isSendingInvite.set(true);
    this.coachService.sendDirectInvite(user._id).subscribe({
      next: () => {
        this.isSendingInvite.set(false);
        this.successMessage.set(`Invitation envoyée à ${user.firstName} ${user.lastName}`);
        // Mettre à jour la liste
        const updated = this.searchResults().map(u =>
          u._id === user._id ? { ...u, relationStatus: 'pending' as const } : u
        );
        this.searchResults.set(updated);
        this.loadDashboard();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err) => {
        this.isSendingInvite.set(false);
        this.error.set(err.error?.error || 'Erreur lors de l\'envoi de l\'invitation');
        setTimeout(() => this.error.set(null), 3000);
      }
    });
  }

  removeAthlete(athlete: Athlete) {
    if (!confirm(`Retirer ${athlete.firstName} ${athlete.lastName} de vos athlètes ?`)) {
      return;
    }

    this.coachService.removeAthlete(athlete._id).subscribe({
      next: () => {
        this.successMessage.set('Athlète retiré');
        this.loadDashboard();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err) => {
        this.error.set('Erreur lors du retrait');
        console.error(err);
      }
    });
  }

  viewAthlete(athlete: Athlete) {
    this.router.navigate(['/coach/athletes', athlete._id]);
  }

  viewAthletePlanning(athlete: Athlete) {
    this.router.navigate(['/coach/athletes', athlete._id, 'planning']);
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }

  getLevelLabel(level: string | undefined): string {
    const levels: Record<string, string> = {
      'debutant': 'Débutant',
      'intermediaire': 'Intermédiaire',
      'confirme': 'Confirmé',
      'expert': 'Expert'
    };
    return level ? levels[level] || level : 'Non défini';
  }

  getGoalLabel(goal: string | undefined): string {
    const goals: Record<string, string> = {
      'remise_en_forme': 'Remise en forme',
      '5km': '5 km',
      '10km': '10 km',
      'semi_marathon': 'Semi-marathon',
      'marathon': 'Marathon',
      'trail': 'Trail',
      'ultra': 'Ultra',
      'autre': 'Autre'
    };
    return goal ? goals[goal] || goal : 'Non défini';
  }
}
