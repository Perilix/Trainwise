import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RunService, Run } from '../../services/run.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';

type Period = 'month' | '3months' | 'all';

interface KPIs {
  totalKm: number;
  totalRuns: number;
  avgPaceStr: string;
  totalDurationMin: number;
  trend: number | null; // % vs période précédente, null si pas de comparaison
}

@Component({
  selector: 'app-sorties',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './sorties.component.html',
  styleUrl: './sorties.component.scss'
})
export class SortiesComponent implements OnInit {
  allRuns = signal<Run[]>([]);
  period = signal<Period>('month');
  loading = signal(true);

  constructor(private runService: RunService, private router: Router) {}

  ngOnInit() {
    this.runService.getAllRuns().subscribe({
      next: runs => {
        this.allRuns.set(runs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  filteredRuns = computed(() => {
    const runs = this.allRuns();
    const p = this.period();
    const now = new Date();
    if (p === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return runs.filter(r => new Date(r.date) >= start);
    }
    if (p === '3months') {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      return runs.filter(r => new Date(r.date) >= start);
    }
    return runs;
  });

  kpis = computed<KPIs>(() => {
    const runs = this.filteredRuns();
    const totalKm = runs.reduce((s, r) => s + (r.distance || 0), 0);
    const totalRuns = runs.length;
    const totalDurationMin = runs.reduce((s, r) => s + (r.duration || 0), 0);

    // Allure moyenne pondérée par distance
    const runsWithPace = runs.filter(r => r.averagePace && r.distance);
    let avgPaceStr = '—';
    if (runsWithPace.length) {
      const totalSec = runsWithPace.reduce((s, r) => {
        const [min, sec] = (r.averagePace || '0:00').split(':').map(Number);
        return s + (min * 60 + sec) * (r.distance || 0);
      }, 0);
      const totalDist = runsWithPace.reduce((s, r) => s + (r.distance || 0), 0);
      const avgSec = Math.round(totalSec / totalDist);
      avgPaceStr = `${Math.floor(avgSec / 60)}:${String(avgSec % 60).padStart(2, '0')}`;
    }

    // Trend vs période précédente
    const trend = this.computeTrend(runs, totalKm);

    return { totalKm, totalRuns, avgPaceStr, totalDurationMin, trend };
  });

  private computeTrend(currentRuns: Run[], currentKm: number): number | null {
    const p = this.period();
    if (p === 'all') return null;
    const allRuns = this.allRuns();
    const now = new Date();
    let prevStart: Date, prevEnd: Date;
    if (p === 'month') {
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 1);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    } else {
      prevEnd = new Date(now);
      prevEnd.setMonth(prevEnd.getMonth() - 3);
      prevStart = new Date(now);
      prevStart.setMonth(prevStart.getMonth() - 6);
    }
    const prevRuns = allRuns.filter(r => {
      const d = new Date(r.date);
      return d >= prevStart && d < prevEnd;
    });
    const prevKm = prevRuns.reduce((s, r) => s + (r.distance || 0), 0);
    if (!prevKm) return null;
    return Math.round(((currentKm - prevKm) / prevKm) * 100);
  }

  setPeriod(p: Period) { this.period.set(p); }

  goToRun(run: Run) {
    if (run._id) this.router.navigate(['/run', run._id]);
  }

  // ── Formatters ──────────────────────────────────────
  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
  }

  formatDuration(min: number): string {
    if (!min) return '—';
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
  }

  formatTotalDuration(min: number): string {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m}min`;
  }

  feelingColor(f: number): string {
    if (f >= 8) return '#10b981';
    if (f >= 5) return '#f59e0b';
    return '#ef4444';
  }

  sessionIcon(type?: string): string {
    const t = (type || '').toLowerCase();
    if (t.includes('fraction') || t.includes('interval') || t.includes('vitesse')) return 'fa-bolt';
    if (t.includes('récup') || t.includes('recup')) return 'fa-leaf';
    if (t.includes('longue') || t.includes('sortie longue')) return 'fa-road';
    if (t.includes('trail')) return 'fa-mountain';
    if (t.includes('tempo')) return 'fa-gauge-high';
    return 'fa-person-running';
  }

  sessionLabel(type?: string): string {
    const labels: Record<string, string> = {
      endurance: 'Endurance',
      fractionné: 'Fractionné',
      'sortie longue': 'Sortie longue',
      récupération: 'Récupération',
      tempo: 'Tempo',
      trail: 'Trail',
      compétition: 'Compétition',
    };
    return labels[type?.toLowerCase() || ''] || type || 'Course';
  }

  // ── SVG Polyline ─────────────────────────────────────
  decodePolyline(encoded: string): [number, number][] {
    const coords: [number, number][] = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
      let b: number, shift = 0, result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : (result >> 1);
      shift = 0; result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : (result >> 1);
      coords.push([lat / 1e5, lng / 1e5]);
    }
    return coords;
  }

  getSvgStartX(polyline: string): string {
    const path = this.getSvgPath(polyline);
    return path.split('M')[1]?.split(',')[0] ?? '0';
  }

  getSvgStartY(polyline: string): string {
    const path = this.getSvgPath(polyline);
    return path.split('M')[1]?.split('L')[0]?.split(',')[1] ?? '0';
  }

  getSvgPath(polyline: string): string {
    const coords = this.decodePolyline(polyline);
    if (coords.length < 2) return '';
    const W = 280, H = 140, PAD = 14;
    const lats = coords.map(c => c[0]);
    const lngs = coords.map(c => c[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const rangeX = maxLng - minLng || 0.001;
    const rangeY = maxLat - minLat || 0.001;
    const scaleX = (W - PAD * 2) / rangeX;
    const scaleY = (H - PAD * 2) / rangeY;
    const scale = Math.min(scaleX, scaleY);
    const offX = (W - rangeX * scale) / 2;
    const offY = (H - rangeY * scale) / 2;
    return coords.map((c, i) => {
      const x = offX + (c[1] - minLng) * scale;
      const y = H - offY - (c[0] - minLat) * scale;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
}
