import { Component, OnInit, AfterViewInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CoachService } from '../../../services/coach.service';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { RunBlocksEditorComponent } from '../../../components/run-blocks-editor/run-blocks-editor.component';
import * as L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  iconUrl: 'assets/leaflet/marker-icon.png',
  shadowUrl: 'assets/leaflet/marker-shadow.png',
});

@Component({
  selector: 'app-athlete-run-detail',
  standalone: true,
  imports: [CommonModule, NavbarComponent, RunBlocksEditorComponent],
  templateUrl: './athlete-run-detail.component.html',
  styleUrl: './athlete-run-detail.component.scss'
})
export class AthleteRunDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  athleteId = '';
  run = signal<any | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  private map: L.Map | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private coachService: CoachService
  ) {}

  ngOnInit() {
    this.athleteId = this.route.snapshot.paramMap.get('athleteId') || '';
    const runId = this.route.snapshot.paramMap.get('runId') || '';
    if (this.athleteId && runId) {
      this.loadRun(runId);
    }
  }

  ngAfterViewInit() {}

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  loadRun(runId: string) {
    this.isLoading.set(true);
    this.coachService.getAthleteRun(this.athleteId, runId).subscribe({
      next: (run) => {
        this.run.set(run);
        this.isLoading.set(false);
        setTimeout(() => this.initMap(), 100);
      },
      error: () => {
        this.error.set('Course non trouvée');
        this.isLoading.set(false);
      }
    });
  }

  initMap() {
    const run = this.run();
    if (!run?.polyline) return;
    const mapContainer = document.getElementById('coach-run-map');
    if (!mapContainer) return;

    const coordinates = this.decodePolyline(run.polyline);
    if (coordinates.length === 0) return;

    this.map = L.map('coach-run-map');
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '© CartoDB'
    }).addTo(this.map);

    const polyline = L.polyline(coordinates, {
      color: '#00a6fb',
      weight: 5,
      opacity: 1,
      lineJoin: 'round',
      lineCap: 'round'
    }).addTo(this.map);

    const startIcon = L.divIcon({
      className: 'custom-marker start-marker',
      html: '<div class="marker-dot start"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    L.marker(coordinates[0], { icon: startIcon }).addTo(this.map);

    const endIcon = L.divIcon({
      className: 'custom-marker end-marker',
      html: '<div class="marker-dot end"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    L.marker(coordinates[coordinates.length - 1], { icon: endIcon }).addTo(this.map);

    this.map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
  }

  decodePolyline(encoded: string): L.LatLngTuple[] {
    const coordinates: L.LatLngTuple[] = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
      let b: number, shift = 0, result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : (result >> 1);
      shift = 0; result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : (result >> 1);
      coordinates.push([lat / 1e5, lng / 1e5]);
    }
    return coordinates;
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
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  }

  getFeelingLabel(value: number): string {
    if (value >= 9) return 'Excellent';
    if (value >= 7) return 'Bien';
    if (value >= 5) return 'Correct';
    if (value >= 3) return 'Difficile';
    return 'Épuisant';
  }

  getFeelingColor(value: number): string {
    if (value >= 8) return '#10b981';
    if (value >= 6) return '#00a6fb';
    if (value >= 4) return '#f59e0b';
    return '#ef4444';
  }

  goBack() {
    const date = this.run()?.date;
    if (date) {
      const d = new Date(date);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      this.router.navigate(
        ['/coach/athletes', this.athleteId, 'planning'],
        { queryParams: { openDay: dayKey } }
      );
    } else {
      this.router.navigate(['/coach/athletes', this.athleteId, 'planning']);
    }
  }
}
