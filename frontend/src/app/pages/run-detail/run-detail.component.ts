import { Component, OnInit, signal, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RunService, Run } from '../../services/run.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';
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
  imports: [CommonModule, RouterLink, NavbarComponent],
  templateUrl: './run-detail.component.html',
  styleUrl: './run-detail.component.scss'
})
export class RunDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  run = signal<Run | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  isAnalyzing = signal(false);
  analyzeSuccess = signal(false);

  private map: L.Map | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private runService: RunService
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadRun(id);
    }
  }

  ngAfterViewInit() {
    // Map will be initialized after run is loaded
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  loadRun(id: string) {
    this.isLoading.set(true);
    this.runService.getRunById(id).subscribe({
      next: (run) => {
        this.run.set(run);
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

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Create polyline
    const polyline = L.polyline(coordinates, {
      color: '#FC4C02',
      weight: 4,
      opacity: 0.8
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
      },
      error: (err) => {
        this.isAnalyzing.set(false);
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

  goBack() {
    this.router.navigate(['/profile']);
  }
}
