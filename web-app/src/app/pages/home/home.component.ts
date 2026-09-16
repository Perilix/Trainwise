import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RunService, Run } from '../../services/run.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { TourTooltipComponent, TourStep } from '../../components/tour-tooltip/tour-tooltip.component';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, CommonModule, NavbarComponent, TourTooltipComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  private subscriptionService = inject(SubscriptionService);
  // Form data
  runData = {
    date: this.getTodayDate(),
    distance: null as number | null,
    duration: null as number | null,
    averagePace: '',
    averageHeartRate: null as number | null,
    maxHeartRate: null as number | null,
    averageCadence: null as number | null,
    elevationGain: null as number | null,
    sessionType: '',
    feeling: null as number | null,
    notes: ''
  };

  getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  // State
  isLoading = signal(false);
  analysis = signal<string | null>(null);
  error = signal<string | null>(null);

  sessionTypes = ['Endurance', 'Fractionné', 'Tempo', 'Récupération', 'Sortie longue', 'Compétition'];

  // Visite guidée de la page d'accueil (spotlight étape par étape)
  homeTourSteps: TourStep[] = [
    {
      anchor: 'nav-profile',
      faIcon: 'fa-user',
      title: 'Ton profil',
      description: 'Clique sur ta photo en haut pour accéder à ton profil et tes informations personnelles.',
    },
    {
      anchor: 'nav-coins',
      faIcon: 'fa-coins',
      title: 'Tes TrainCoins',
      description: 'Voici tes TrainCoins. Clique dessus pour ouvrir la boutique et débloquer des fonctionnalités.',
    },
    {
      anchor: 'run-form',
      faIcon: 'fa-person-running',
      title: 'Enregistre ta séance',
      description: 'Saisis les données de ta course ici. Tu peux aussi synchroniser depuis Strava dans tes réglages.',
    },
    {
      anchor: 'analyse-actions',
      faIcon: 'fa-wand-magic-sparkles',
      title: 'Analyse IA',
      description: 'Lance l\'analyse : l\'IA décortique ta séance et te donne un retour personnalisé.',
    },
  ];

  constructor(private runService: RunService) {}

  submitRun() {
    this.isLoading.set(true);
    this.error.set(null);
    this.analysis.set(null);

    // Convertir null en undefined pour le typage
    const payload: Partial<Run> = {
      date: new Date(this.runData.date),
      distance: this.runData.distance ?? undefined,
      duration: this.runData.duration ?? undefined,
      averagePace: this.runData.averagePace || undefined,
      averageHeartRate: this.runData.averageHeartRate ?? undefined,
      maxHeartRate: this.runData.maxHeartRate ?? undefined,
      averageCadence: this.runData.averageCadence ?? undefined,
      elevationGain: this.runData.elevationGain ?? undefined,
      sessionType: this.runData.sessionType || undefined,
      feeling: this.runData.feeling != null && this.runData.feeling !== ('' as any) ? Number(this.runData.feeling) : undefined,
      notes: this.runData.notes || undefined
    };

    this.runService.createRun(payload).subscribe({
      next: (run) => {
        this.isLoading.set(false);
        if (run.analysis) {
          this.analysis.set(run.analysis);
        } else {
          this.analysis.set('Analyse en cours... Vérifie que ton webhook n8n est configuré.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 402) {
          this.subscriptionService.openPaywall('analyze');
        } else {
          this.error.set('Erreur lors de l\'envoi. Vérifie que le backend est lancé.');
        }
        console.error(err);
      }
    });
  }

  resetForm() {
    this.runData = {
      date: this.getTodayDate(),
      distance: null,
      duration: null,
      averagePace: '',
      averageHeartRate: null,
      maxHeartRate: null,
      averageCadence: null,
      elevationGain: null,
      sessionType: '',
      feeling: null,
      notes: ''
    };
    this.analysis.set(null);
    this.error.set(null);
  }
}
