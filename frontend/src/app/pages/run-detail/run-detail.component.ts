import { Component, OnInit, inject, signal, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RunService, Run, RunBlock } from '../../services/run.service';
import { PlanningService, PlannedSession } from '../../services/planning.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { RunBlocksEditorComponent } from '../../components/run-blocks-editor/run-blocks-editor.component';
import { StravaInsightsComponent } from '../../components/strava-insights/strava-insights.component';
import { TourTooltipComponent, TourStep } from '../../components/tour-tooltip/tour-tooltip.component';
import { SubscriptionService } from '../../services/subscription.service';
import { AthleteService } from '../../services/athlete.service';
import * as L from 'leaflet';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  iconUrl: 'assets/leaflet/marker-icon.png',
  shadowUrl: 'assets/leaflet/marker-shadow.png',
});

@Component({
  selector: 'app-run-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, RunBlocksEditorComponent, StravaInsightsComponent, TourTooltipComponent],
  templateUrl: './run-detail.component.html',
  styleUrl: './run-detail.component.scss'
})
export class RunDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  run = signal<Run | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  isAnalyzing = signal(false);
  analyzeSuccess = signal(false);
  hasCoach = signal(false);
  feelingValue = signal<number>(5);
  feelingSaved = signal(false);

  // Planned session mode
  isPlannedMode = signal(false);
  plannedSession = signal<PlannedSession | null>(null);
  isSubmittingCompletion = signal(false);
  completionForm = {
    distance: undefined as number | undefined,
    duration: undefined as number | undefined,
    averagePace: '' as string,
    averageHeartRate: undefined as number | undefined,
    maxHeartRate: undefined as number | undefined,
    elevationGain: undefined as number | undefined,
    notes: '' as string
  };

  // Blocs (séance détaillée par le coach et/ou par l'athlète)
  plannedBlocks = signal<RunBlock[]>([]);
  myBlocks = signal<RunBlock[]>([]);
  isEditingBlocks = signal(false);
  isSavingBlocks = signal(false);
  blocksSavedMessage = signal<string | null>(null);

  // ── Visite guidée : complétion d'une séance coach (mode "à compléter") ──
  get completeTourSteps(): TourStep[] {
    return [
      { faIcon: 'fa-person-running', title: 'La séance de ton coach', description: 'Ton coach a prévu cette séance. Renseigne ce que tu as réellement fait pour la valider et suivre ta progression.' },
      { anchor: 'rd-complete-blocks', faIcon: 'fa-list-check', title: 'Le plan est pré-rempli', description: 'Chaque bloc reprend ce que le coach a prévu. Touche le crayon ✎ pour ajuster une valeur si tu as fait différemment.' },
      { anchor: 'rd-feeling', faIcon: 'fa-face-smile', title: 'Ton ressenti', description: 'Note la difficulté ressentie, de 1 (épuisant) à 10 (excellent).' },
      { anchor: 'rd-complete-submit', faIcon: 'fa-circle-check', title: 'Valide ta séance', description: 'Une fois rempli, enregistre : ta séance devient une course réalisée, comparée au plan du coach.' },
    ];
  }

  // ── Visite guidée : 1re visualisation d'une séance réalisée ──
  get viewTourSteps(): TourStep[] {
    const steps: TourStep[] = [
      { faIcon: 'fa-chart-simple', title: 'Ta séance en détail', description: "Voici l'analyse complète de ta sortie. Petit tour rapide des sections 👇" },
    ];
    if (this.run()?.polyline) {
      steps.push({ anchor: 'rd-map', faIcon: 'fa-map-location-dot', title: 'Ton parcours', description: 'La trace GPS de ta sortie.' });
    }
    if (this.plannedBlocks().length > 0) {
      steps.push({ anchor: 'rd-compare', faIcon: 'fa-code-compare', title: 'Coach vs réalisé', description: 'Le prévu par ton coach (barré) face à ce que tu as fait (en bleu), bloc par bloc.' });
    }
    if (this.run()?.stravaData) {
      steps.push({ anchor: 'rd-insights', faIcon: 'fa-heart-pulse', title: 'Tes métriques', description: "Allure par km, zones d'effort, fréquence cardiaque (touche la courbe !), meilleurs efforts et contexte." });
    }
    return steps;
  }

  private map: L.Map | null = null;
  private feelingTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptionService = inject(SubscriptionService);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private runService: RunService,
    private planningService: PlanningService,
    private athleteService: AthleteService,
    private location: Location
  ) {}

  ngOnInit() {
    this.athleteService.getCurrentCoach().subscribe({
      next: (coach) => this.hasCoach.set(!!coach),
      error: () => this.hasCoach.set(false)
    });
    // On souscrit à paramMap seul (le query param est lu via snapshot pour éviter
    // une double émission de combineLatest pendant une navigation qui change les deux)
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (!id) return;
      // Reset state on each navigation
      this.run.set(null);
      this.plannedSession.set(null);
      this.error.set(null);
      this.isPlannedMode.set(false);
      if (this.map) {
        this.map.remove();
        this.map = null;
      }
      const isPlanned = this.route.snapshot.queryParamMap.get('planned') === '1';
      if (isPlanned) {
        this.loadPlannedSession(id);
      } else {
        this.loadRun(id);
      }
    });
  }

  loadPlannedSession(id: string) {
    this.isLoading.set(true);
    this.isPlannedMode.set(true);
    this.planningService.getPlannedSessionById(id).subscribe({
      next: (planned) => {
        this.plannedSession.set(planned);
        // Map target* fields onto a Run-shaped object so the existing template renders them
        const proxyRun: Run = {
          _id: planned._id,
          date: planned.date,
          distance: planned.targetDistance,
          duration: planned.targetDuration,
          averagePace: planned.targetPace,
          feeling: planned.feeling,
          notes: planned.description,
          sessionType: planned.sessionType
        };
        this.run.set(proxyRun);
        this.feelingValue.set(planned.feeling ?? 5);
        // Prefill completion form with the targets so the user can adjust
        this.completionForm.distance = planned.targetDistance;
        this.completionForm.duration = planned.targetDuration;
        this.completionForm.averagePace = planned.targetPace ?? '';
        this.completionForm.notes = planned.description ?? '';
        // Blocs : copie du plan coach pour affichage read-only + pré-remplir le formulaire athlète
        const coachBlocks = planned.runBlocks || [];
        this.plannedBlocks.set(coachBlocks.map(b => ({ ...b })));
        this.myBlocks.set(coachBlocks.map(b => ({ ...b })));
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Séance non trouvée');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }

  submitCompletion() {
    const planned = this.plannedSession();
    if (!planned?._id) return;
    this.isSubmittingCompletion.set(true);

    const blocks = this.myBlocks();
    const payload: Partial<Run> = {
      date: planned.date,
      distance: this.completionForm.distance ?? undefined,
      duration: this.completionForm.duration ?? undefined,
      averagePace: this.completionForm.averagePace || undefined,
      averageHeartRate: this.completionForm.averageHeartRate ?? undefined,
      maxHeartRate: this.completionForm.maxHeartRate ?? undefined,
      elevationGain: this.completionForm.elevationGain ?? undefined,
      sessionType: planned.sessionType,
      feeling: this.feelingValue(),
      notes: this.completionForm.notes || undefined,
      runBlocks: blocks.length > 0 ? blocks : undefined
    };

    this.runService.createRun(payload).subscribe({
      next: (run) => {
        if (!run._id) {
          this.isSubmittingCompletion.set(false);
          return;
        }
        // Supprimer la planned : le nouveau Run la remplace
        // replaceUrl pour que la flèche retour ne tente pas de revisiter la planned supprimée
        this.planningService.deletePlannedSession(planned._id!).subscribe({
          next: () => {
            this.isSubmittingCompletion.set(false);
            this.router.navigate(['/run', run._id], { replaceUrl: true });
          },
          error: () => {
            this.isSubmittingCompletion.set(false);
            this.router.navigate(['/run', run._id], { replaceUrl: true });
          }
        });
      },
      error: (err) => {
        this.isSubmittingCompletion.set(false);
        console.error(err);
      }
    });
  }

  ngAfterViewInit() {
    // Map will be initialized after run is loaded
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
    if (this.feelingTimer) {
      clearTimeout(this.feelingTimer);
      this.feelingTimer = null;
    }
  }

  loadRun(id: string) {
    this.isLoading.set(true);
    this.runService.getRunById(id).subscribe({
      next: (run) => {
        this.run.set(run);
        this.feelingValue.set(run.feeling ?? 5);
        this.plannedBlocks.set((run.plannedSnapshot?.runBlocks || []).map(b => ({ ...b })));
        this.myBlocks.set((run.runBlocks || []).map(b => ({ ...b })));
        this.isEditingBlocks.set(false);
        this.isLoading.set(false);
        // Initialize map after a small delay to ensure DOM is ready
        setTimeout(() => this.initMap(), 100);
      },
      error: (err) => {
        this.error.set('Course non trouvée');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }

  startEditBlocks() {
    if (this.myBlocks().length === 0) {
      // Si pas de blocs réalisés, partir du snapshot coach s'il existe
      const seed = this.plannedBlocks();
      this.myBlocks.set(seed.map(b => ({ ...b })));
    }
    this.isEditingBlocks.set(true);
  }

  cancelEditBlocks() {
    const run = this.run();
    this.myBlocks.set((run?.runBlocks || []).map(b => ({ ...b })));
    this.isEditingBlocks.set(false);
  }

  onMyBlocksChange(blocks: RunBlock[]) {
    this.myBlocks.set(blocks);
  }

  saveMyBlocks() {
    const run = this.run();
    if (!run?._id) return;
    this.isSavingBlocks.set(true);
    this.runService.updateRun(run._id, { runBlocks: this.myBlocks() } as any).subscribe({
      next: (updated) => {
        this.run.set(updated);
        this.myBlocks.set((updated.runBlocks || []).map(b => ({ ...b })));
        this.isSavingBlocks.set(false);
        this.isEditingBlocks.set(false);
        this.blocksSavedMessage.set('Blocs enregistrés');
        setTimeout(() => this.blocksSavedMessage.set(null), 3000);
      },
      error: (err) => {
        this.isSavingBlocks.set(false);
        console.error(err);
      }
    });
  }

  initMap() {
    const run = this.run();
    if (!run?.polyline) return;

    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;

    // Decode polyline
    const coordinates = this.decodePolyline(run.polyline);
    if (coordinates.length === 0) return;

    // Create map
    this.map = L.map('map');

    // CartoDB Voyager — même style que les mini-maps
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '© CartoDB'
    }).addTo(this.map);

    // Create polyline
    const polyline = L.polyline(coordinates, {
      color: '#00a6fb',
      weight: 5,
      opacity: 1,
      lineJoin: 'round',
      lineCap: 'round'
    }).addTo(this.map);

    // Add start marker
    const startIcon = L.divIcon({
      className: 'custom-marker start-marker',
      html: '<div class="marker-dot start"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    L.marker(coordinates[0], { icon: startIcon }).addTo(this.map);

    // Add end marker
    const endIcon = L.divIcon({
      className: 'custom-marker end-marker',
      html: '<div class="marker-dot end"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    L.marker(coordinates[coordinates.length - 1], { icon: endIcon }).addTo(this.map);

    // Fit bounds
    this.map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
  }

  // Decode Google Polyline Algorithm
  decodePolyline(encoded: string): L.LatLngTuple[] {
    const coordinates: L.LatLngTuple[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b: number;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += dlng;

      coordinates.push([lat / 1e5, lng / 1e5]);
    }

    return coordinates;
  }

  analyzeRun() {
    const run = this.run();
    if (!run?._id) return;

    this.isAnalyzing.set(true);
    this.runService.analyzeRun(run._id).subscribe({
      next: (updatedRun) => {
        this.run.set(updatedRun);
        this.isAnalyzing.set(false);
        this.analyzeSuccess.set(true);
        setTimeout(() => this.analyzeSuccess.set(false), 3000);
        // Fallback : resync les coins si le WebSocket n'a pas mis à jour
        this.subscriptionService.refreshStatus();
      },
      error: (err) => {
        this.isAnalyzing.set(false);
        if (err.status === 402) {
          this.subscriptionService.openPaywall('analyze');
        }
        console.error(err);
      }
    });
  }

  getRunTitle(): string {
    const notes = this.run()?.notes;
    if (!notes) return 'Course';
    return notes.split('\n')[0] || 'Course';
  }

  getRunDescription(): string {
    const notes = this.run()?.notes;
    if (!notes) return '';
    return notes.split('\n').slice(2).join('\n').trim();
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  }

  onFeelingChange(value: number) {
    this.feelingValue.set(value);
  }

  saveFeelingNow() {
    const value = this.feelingValue();
    if (this.feelingTimer) clearTimeout(this.feelingTimer);
    this.feelingTimer = null;

    if (this.isPlannedMode()) {
      const planned = this.plannedSession();
      if (!planned?._id) return;
      this.planningService.updatePlannedSession(planned._id, { feeling: value }).subscribe({
        next: () => {
          this.plannedSession.set({ ...planned, feeling: value });
          this.feelingSaved.set(true);
          setTimeout(() => this.feelingSaved.set(false), 2000);
        },
        error: (err) => console.error(err)
      });
      return;
    }

    const run = this.run();
    if (!run?._id) return;
    this.runService.updateRun(run._id, { feeling: value }).subscribe({
      next: () => {
        this.run.set({ ...run, feeling: value });
        this.feelingSaved.set(true);
        setTimeout(() => this.feelingSaved.set(false), 2000);
      },
      error: (err) => console.error(err)
    });
  }

  getFeelingLabel(value: number): string {
    if (value >= 9) return 'Excellent';
    if (value >= 7) return 'Bien';
    if (value >= 5) return 'Correct';
    if (value >= 3) return 'Difficile';
    return 'Épuisant';
  }

  getFeelingColor(value: number): string {
    if (value >= 9) return '#16a34a';
    if (value >= 7) return '#22c55e';
    if (value >= 5) return '#eab308';
    if (value >= 3) return '#f97316';
    return '#ef4444';
  }

  goBack() {
    const date = this.run()?.date || this.plannedSession()?.date;
    if (date) {
      const d = new Date(date);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      this.router.navigate(['/planning'], { queryParams: { openDay: dayKey } });
    } else {
      this.location.back();
    }
  }
}
