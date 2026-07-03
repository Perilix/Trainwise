import { Component, OnInit, signal, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CoachService } from '../../../services/coach.service';
import { ChatService } from '../../../services/chat.service';
import { AthleteDetail, RecentActivity } from '../../../interfaces/coach.interfaces';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { CompetitionsManagerComponent } from '../../../components/competitions-manager/competitions-manager.component';

@Component({
  selector: 'app-athlete-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, CompetitionsManagerComponent],
  templateUrl: './athlete-detail.component.html',
  styleUrl: './athlete-detail.component.scss'
})
export class AthleteDetailComponent implements OnInit {
  athleteId = '';
  athlete = signal<AthleteDetail | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  selectedActivity = signal<RecentActivity | null>(null);
  selectedActivityData: RecentActivity | null = null;

  editingVma = signal(false);
  vmaInput = signal<number | null>(null);
  vmaSaving = signal(false);
  vmaError = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private coachService: CoachService,
    private chatService: ChatService,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.athleteId = this.route.snapshot.paramMap.get('id') || '';
    if (this.athleteId) {
      this.loadAthlete();
    }
  }

  loadAthlete() {
    this.isLoading.set(true);
    this.coachService.getAthlete(this.athleteId).subscribe({
      next: (athlete) => {
        this.athlete.set(athlete);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Erreur lors du chargement');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }

  goBack() {
    this.location.back();
  }

  viewPlanning() {
    this.router.navigate(['/coach/athletes', this.athleteId, 'planning']);
  }

  startChat() {
    this.chatService.getOrCreateConversation(this.athleteId).subscribe({
      next: (conversation) => {
        this.router.navigate(['/chat', conversation._id]);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Erreur lors de la création de la conversation');
      }
    });
  }

  getStatusLabel(status: string | undefined): string {
    if (status === 'green') return 'Top';
    if (status === 'orange') return 'À surveiller';
    return 'Alerte';
  }

  formatShortDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
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

  getPreferredTimeLabel(time: string | undefined): string {
    const times: Record<string, string> = {
      'matin': 'Matin',
      'midi': 'Midi',
      'soir': 'Soir',
      'flexible': 'Flexible'
    };
    return time ? times[time] || time : 'Non défini';
  }

  getGenderLabel(gender: string | undefined): string {
    const genders: Record<string, string> = {
      'homme': 'Homme',
      'femme': 'Femme',
      'autre': 'Autre'
    };
    return gender ? genders[gender] || gender : 'Non défini';
  }

  getSessionTypeLabel(type: string): string {
    const types: Record<string, string> = {
      'upper_body': 'Haut du corps',
      'lower_body': 'Bas du corps',
      'full_body': 'Full body',
      'push': 'Push',
      'pull': 'Pull',
      'legs': 'Jambes',
      'core': 'Gainage',
      'hiit': 'HIIT',
      'other': 'Autre'
    };
    return types[type] || type;
  }

  getStrengthGoalLabel(value: string | undefined): string {
    const goals: Record<string, string> = {
      'force': 'Force / Puissance',
      'hypertrophie': 'Hypertrophie',
      'endurance_musculaire': 'Endurance musculaire',
      'remise_en_forme': 'Remise en forme',
      'fonctionnel': 'Fonctionnel / Mobilité'
    };
    return value ? goals[value] || value : 'Non défini';
  }

  getStrengthTypeLabel(value: string | undefined): string {
    const types: Record<string, string> = {
      'poids_libres': 'Poids libres',
      'machines': 'Machines',
      'bodyweight': 'Poids de corps',
      'crossfit': 'CrossFit / HIIT',
      'mixte': 'Mixte'
    };
    return value ? types[value] || value : 'Non défini';
  }

  formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h > 0) return `${h}h${m > 0 ? m + 'min' : ''}`;
    return `${m}min`;
  }

  openActivity(activity: RecentActivity) {
    this.selectedActivityData = activity;
    this.selectedActivity.set(activity);
    this.cdr.detectChanges();
  }

  closeActivity() {
    this.selectedActivityData = null;
    this.selectedActivity.set(null);
    this.cdr.detectChanges();
  }

  formatActivityDate(date: Date | string): string {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (d.toDateString() === yesterday.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  getAvailableDaysLabel(days: string[] | undefined): string {
    if (!days || days.length === 0) return 'Non définis';
    const dayLabels: Record<string, string> = {
      'lundi': 'Lun',
      'mardi': 'Mar',
      'mercredi': 'Mer',
      'jeudi': 'Jeu',
      'vendredi': 'Ven',
      'samedi': 'Sam',
      'dimanche': 'Dim'
    };
    return days.map(d => dayLabels[d] || d).join(', ');
  }

  startEditVma() {
    this.vmaInput.set(this.athlete()?.vma ?? null);
    this.vmaError.set(null);
    this.editingVma.set(true);
  }

  cancelEditVma() {
    this.editingVma.set(false);
    this.vmaError.set(null);
  }

  saveVma() {
    const vma = this.vmaInput();
    if (!vma || vma < 8 || vma > 30) {
      this.vmaError.set('VMA invalide (entre 8 et 30 km/h)');
      return;
    }
    this.vmaSaving.set(true);
    this.coachService.updateAthleteVma(this.athleteId, vma).subscribe({
      next: (res) => {
        this.athlete.update(a => a ? { ...a, vma: res.vma } : a);
        this.editingVma.set(false);
        this.vmaSaving.set(false);
      },
      error: () => {
        this.vmaError.set('Erreur lors de la sauvegarde');
        this.vmaSaving.set(false);
      }
    });
  }
}
