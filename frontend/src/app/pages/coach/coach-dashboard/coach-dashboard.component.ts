import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CoachService } from '../../../services/coach.service';
import { AuthService } from '../../../services/auth.service';
import { Athlete, CoachStats, UserSearchResult, PendingInvitation } from '../../../interfaces/coach.interfaces';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { TourTooltipComponent, TourStep } from '../../../components/tour-tooltip/tour-tooltip.component';
import { COACH_PACKAGES, PackageType } from '../../../interfaces/package.interface';

@Component({
  selector: 'app-coach-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent, TourTooltipComponent],
  templateUrl: './coach-dashboard.component.html',
  styleUrl: './coach-dashboard.component.scss'
})
export class CoachDashboardComponent implements OnInit {
  // Visite guidée de l'espace coach (spotlight étape par étape)
  readonly coachTourSteps: TourStep[] = [
    {
      anchor: 'nav-profile',
      faIcon: 'fa-user',
      title: 'Ton profil coach',
      description: 'Accède à ton profil et tes paramètres en cliquant sur ta photo en haut.',
    },
    {
      anchor: 'coach-stats',
      faIcon: 'fa-chart-simple',
      title: 'Tes statistiques',
      description: 'Vue d\'ensemble : nombre d\'athlètes, invitations en attente et séances créées.',
    },
    {
      anchor: 'coach-athletes',
      faIcon: 'fa-users',
      title: 'Tes athlètes',
      description: 'Point vert = actif, orange = inactif depuis 7j ou séances sautées, rouge = alerte. Clique sur un athlète pour le détail.',
    },
  ];

  athletes = signal<Athlete[]>([]);
  stats = signal<CoachStats | null>(null);
  pendingInvitations = signal<PendingInvitation[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  athleteSearch = signal('');
  filteredAthletes = computed(() => {
    const q = this.athleteSearch().toLowerCase().trim();
    if (!q) return this.athletes();
    return this.athletes().filter(a =>
      `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q)
    );
  });

  // Invitation modal
  showInviteModal = signal(false);
  inviteCode = signal<string | null>(null);
  isGeneratingCode = signal(false);
  searchQuery = signal('');
  searchResults = signal<UserSearchResult[]>([]);
  isSearching = signal(false);
  isSendingInvite = signal(false);
  selectedPackage = signal<PackageType>('silver'); // Package par défaut

  // Packages disponibles
  packages = COACH_PACKAGES;
  packagesList: { key: PackageType; value: typeof COACH_PACKAGES[PackageType] }[] = [
    { key: 'bronze', value: COACH_PACKAGES.bronze },
    { key: 'silver', value: COACH_PACKAGES.silver },
    { key: 'gold', value: COACH_PACKAGES.gold }
  ];

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
    this.selectedPackage.set('silver'); // Reset au package par défaut
  }

  selectPackage(packageType: PackageType) {
    this.selectedPackage.set(packageType);
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
    const packageType = this.selectedPackage();
    this.coachService.sendDirectInvite(user._id, packageType).subscribe({
      next: () => {
        this.isSendingInvite.set(false);
        const packageName = this.packages[packageType].name;
        this.successMessage.set(`Invitation ${packageName} envoyée à ${user.firstName} ${user.lastName}`);
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

  getActivityStatus(athlete: Athlete): 'green' | 'orange' | 'red' {
    return athlete.status ?? 'red';
  }

  getPackageDetails(athlete: Athlete) {
    const type: PackageType = athlete.packageType ?? 'silver';
    return COACH_PACKAGES[type];
  }

  getActivityBadgeLabel(athlete: Athlete): string {
    const s = athlete.status ?? 'red';
    if (s === 'green') return 'Top';
    if (s === 'orange') return 'À surveiller';
    return 'Alerte';
  }

  getActivityTooltip(athlete: Athlete): string {
    const parts: string[] = [];
    if (athlete.daysSinceActivity === null || athlete.daysSinceActivity === undefined) {
      parts.push('Aucune activité enregistrée');
    } else if (athlete.daysSinceActivity === 0) {
      parts.push("Actif aujourd'hui");
    } else {
      parts.push(`Dernière activité il y a ${athlete.daysSinceActivity} jour${athlete.daysSinceActivity > 1 ? 's' : ''}`);
    }
    if (athlete.skippedCount && athlete.skippedCount > 0) {
      parts.push(`${athlete.skippedCount} séance${athlete.skippedCount > 1 ? 's' : ''} passée${athlete.skippedCount > 1 ? 's' : ''} (4 sem.)`);
    }
    if (athlete.avgFeeling !== null && athlete.avgFeeling !== undefined) {
      parts.push(`Ressenti moyen : ${athlete.avgFeeling}/10 (4 sem.)`);
    }
    if (athlete.volumeDrop) {
      parts.push(`Volume en baisse : ${athlete.weeklyVolume} km cette sem. (habituel : ${athlete.baselineWeeklyVolume} km/sem)`);
    }
    return parts.join(' · ');
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

}
