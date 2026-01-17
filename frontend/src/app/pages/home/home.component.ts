import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RunService, Run } from '../../services/run.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  // Form data
  runData = {
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

  // State
  isLoading = signal(false);
  analysis = signal<string | null>(null);
  error = signal<string | null>(null);

  sessionTypes = ['Endurance', 'Fractionné', 'Tempo', 'Récupération', 'Sortie longue', 'Compétition'];

  constructor(
    private runService: RunService,
    public authService: AuthService
  ) {}

  submitRun() {
    this.isLoading.set(true);
    this.error.set(null);
    this.analysis.set(null);

    // Convertir null en undefined pour le typage
    const payload: Partial<Run> = {
      date: new Date(),
      distance: this.runData.distance ?? undefined,
      duration: this.runData.duration ?? undefined,
      averagePace: this.runData.averagePace || undefined,
      averageHeartRate: this.runData.averageHeartRate ?? undefined,
      maxHeartRate: this.runData.maxHeartRate ?? undefined,
      averageCadence: this.runData.averageCadence ?? undefined,
      elevationGain: this.runData.elevationGain ?? undefined,
      sessionType: this.runData.sessionType || undefined,
      feeling: this.runData.feeling ?? undefined,
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
        this.error.set('Erreur lors de l\'envoi. Vérifie que le backend est lancé.');
        console.error(err);
      }
    });
  }

  resetForm() {
    this.runData = {
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

  logout() {
    this.authService.logout();
  }
}
