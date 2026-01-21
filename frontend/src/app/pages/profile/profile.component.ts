import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RunService, Run } from '../../services/run.service';
import { AuthService, UpdateProfileData } from '../../services/auth.service';
import { StravaService, StravaStatus } from '../../services/strava.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  runs = signal<Run[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  // Edition du profil
  isEditing = signal(false);
  isSaving = signal(false);
  saveError = signal<string | null>(null);
  saveSuccess = signal(false);

  // Strava
  stravaStatus = signal<StravaStatus | null>(null);
  stravaLoading = signal(false);
  stravaSyncing = signal(false);
  stravaMessage = signal<string | null>(null);

  profileForm: UpdateProfileData = {
    runningLevel: undefined,
    goal: undefined,
    goalDetails: '',
    weeklyFrequency: undefined,
    injuries: '',
    availableDays: [],
    preferredTime: undefined
  };

  allDays = [
    { value: 'lundi', label: 'Lun' },
    { value: 'mardi', label: 'Mar' },
    { value: 'mercredi', label: 'Mer' },
    { value: 'jeudi', label: 'Jeu' },
    { value: 'vendredi', label: 'Ven' },
    { value: 'samedi', label: 'Sam' },
    { value: 'dimanche', label: 'Dim' }
  ];

  preferredTimes = [
    { value: 'matin', label: 'Matin' },
    { value: 'midi', label: 'Midi' },
    { value: 'soir', label: 'Soir' },
    { value: 'flexible', label: 'Flexible' }
  ];

  runningLevels = [
    { value: 'debutant', label: 'Débutant' },
    { value: 'intermediaire', label: 'Intermédiaire' },
    { value: 'confirme', label: 'Confirmé' },
    { value: 'expert', label: 'Expert' }
  ];

  goals = [
    { value: 'remise_en_forme', label: 'Remise en forme' },
    { value: '5km', label: '5 km' },
    { value: '10km', label: '10 km' },
    { value: 'semi_marathon', label: 'Semi-marathon' },
    { value: 'marathon', label: 'Marathon' },
    { value: 'trail', label: 'Trail' },
    { value: 'ultra', label: 'Ultra-trail' },
    { value: 'autre', label: 'Autre' }
  ];

  constructor(
    private runService: RunService,
    public authService: AuthService,
    private stravaService: StravaService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  openRunDetail(run: Run) {
    if (run._id) {
      this.router.navigate(['/run', run._id]);
    }
  }

  ngOnInit() {
    this.loadRuns();
    this.initProfileForm();
    this.loadStravaStatus();
    this.handleStravaCallback();
  }

  handleStravaCallback() {
    this.route.queryParams.subscribe(params => {
      if (params['strava'] === 'success') {
        this.stravaMessage.set('Compte Strava connecté avec succès !');
        this.loadStravaStatus();
        setTimeout(() => this.stravaMessage.set(null), 5000);
      } else if (params['strava'] === 'error') {
        this.stravaMessage.set('Erreur de connexion Strava: ' + (params['message'] || 'Erreur inconnue'));
        setTimeout(() => this.stravaMessage.set(null), 5000);
      }
    });
  }

  loadStravaStatus() {
    this.stravaLoading.set(true);
    this.stravaService.getStatus().subscribe({
      next: (status) => {
        this.stravaStatus.set(status);
        this.stravaLoading.set(false);
      },
      error: () => {
        this.stravaLoading.set(false);
      }
    });
  }

  connectStrava() {
    this.stravaLoading.set(true);
    this.stravaService.getAuthUrl().subscribe({
      next: (response) => {
        window.location.href = response.authUrl;
      },
      error: () => {
        this.stravaLoading.set(false);
        this.stravaMessage.set('Erreur lors de la connexion à Strava');
      }
    });
  }

  syncStrava() {
    this.stravaSyncing.set(true);
    this.stravaMessage.set(null);
    this.stravaService.syncActivities().subscribe({
      next: (result) => {
        this.stravaSyncing.set(false);
        this.stravaMessage.set(result.message);
        if (result.imported.length > 0) {
          this.loadRuns();
        }
        setTimeout(() => this.stravaMessage.set(null), 5000);
      },
      error: (err) => {
        this.stravaSyncing.set(false);
        this.stravaMessage.set('Erreur lors de la synchronisation');
        console.error(err);
      }
    });
  }

  resyncStrava() {
    this.stravaSyncing.set(true);
    this.stravaMessage.set(null);
    this.stravaService.resyncActivities().subscribe({
      next: (result) => {
        this.stravaSyncing.set(false);
        this.stravaMessage.set(result.message);
        if (result.updated > 0) {
          this.loadRuns();
        }
        setTimeout(() => this.stravaMessage.set(null), 5000);
      },
      error: (err) => {
        this.stravaSyncing.set(false);
        this.stravaMessage.set('Erreur lors de la resynchronisation');
        console.error(err);
      }
    });
  }

  disconnectStrava() {
    if (!confirm('Déconnecter votre compte Strava ?')) return;

    this.stravaLoading.set(true);
    this.stravaService.disconnect().subscribe({
      next: () => {
        this.stravaStatus.set({ connected: false, athleteId: null, connectedAt: null });
        this.stravaLoading.set(false);
        this.stravaMessage.set('Compte Strava déconnecté');
        setTimeout(() => this.stravaMessage.set(null), 3000);
      },
      error: () => {
        this.stravaLoading.set(false);
        this.stravaMessage.set('Erreur lors de la déconnexion');
      }
    });
  }

  initProfileForm() {
    const user = this.authService.currentUser();
    if (user) {
      this.profileForm = {
        runningLevel: user.runningLevel || undefined,
        goal: user.goal || undefined,
        goalDetails: user.goalDetails || '',
        weeklyFrequency: user.weeklyFrequency || undefined,
        injuries: user.injuries || '',
        availableDays: user.availableDays || [],
        preferredTime: user.preferredTime || undefined
      };
    }
  }

  toggleDay(day: string) {
    const days = this.profileForm.availableDays || [];
    const index = days.indexOf(day);
    if (index === -1) {
      this.profileForm.availableDays = [...days, day];
    } else {
      this.profileForm.availableDays = days.filter(d => d !== day);
    }
  }

  isDaySelected(day: string): boolean {
    return (this.profileForm.availableDays || []).includes(day);
  }

  getAvailableDaysDisplay(): string {
    const days = this.authService.currentUser()?.availableDays || [];
    if (days.length === 0) return 'Non définis';
    return days.map(d => {
      const found = this.allDays.find(day => day.value === d);
      return found ? found.label : d;
    }).join(', ');
  }

  getPreferredTimeLabel(time: string | undefined): string {
    if (!time) return 'Non défini';
    const found = this.preferredTimes.find(t => t.value === time);
    return found ? found.label : time;
  }

  toggleEdit() {
    if (this.isEditing()) {
      this.initProfileForm();
    }
    this.isEditing.set(!this.isEditing());
    this.saveError.set(null);
    this.saveSuccess.set(false);
  }

  saveProfile() {
    this.isSaving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    this.authService.updateProfile(this.profileForm).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saveSuccess.set(true);
        this.isEditing.set(false);
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.saveError.set('Erreur lors de la sauvegarde');
        console.error(err);
      }
    });
  }

  loadRuns() {
    this.isLoading.set(true);
    this.runService.getAllRuns().subscribe({
      next: (runs) => {
        this.runs.set(runs);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Erreur lors du chargement de l\'historique');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }

  getTotalDistance(): number {
    return this.runs().reduce((sum, run) => sum + (run.distance || 0), 0);
  }

  getTotalDuration(): number {
    return this.runs().reduce((sum, run) => sum + (run.duration || 0), 0);
  }

  getTotalRuns(): number {
    return this.runs().length;
  }

  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  getRunSummary(run: Run): string {
    const parts: string[] = [];

    if (run.distance) {
      parts.push(`${run.distance} km`);
    }
    if (run.duration) {
      parts.push(this.formatDuration(run.duration));
    }
    if (run.averagePace) {
      parts.push(`${run.averagePace}/km`);
    }

    return parts.join(' • ') || 'Aucune donnée';
  }

  getFeelingEmoji(feeling: number | undefined): string {
    if (!feeling) return '';
    if (feeling >= 8) return '😄';
    if (feeling >= 6) return '🙂';
    if (feeling >= 4) return '😐';
    return '😓';
  }

  getLevelLabel(level: string | undefined): string {
    if (!level) return 'Non défini';
    const found = this.runningLevels.find(l => l.value === level);
    return found ? found.label : level;
  }

  getGoalLabel(goal: string | undefined): string {
    if (!goal) return 'Non défini';
    const found = this.goals.find(g => g.value === goal);
    return found ? found.label : goal;
  }
}
