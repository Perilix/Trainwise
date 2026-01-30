import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CoachService } from '../../../services/coach.service';
import { ChatService } from '../../../services/chat.service';
import { AthleteDetail } from '../../../interfaces/coach.interfaces';
import { NavbarComponent } from '../../../components/navbar/navbar.component';

@Component({
  selector: 'app-athlete-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent],
  templateUrl: './athlete-detail.component.html',
  styleUrl: './athlete-detail.component.scss'
})
export class AthleteDetailComponent implements OnInit {
  athleteId = '';
  athlete = signal<AthleteDetail | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private coachService: CoachService,
    private chatService: ChatService,
    private location: Location
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
}
