import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Split {
  split: number;
  distance: number;
  movingTime: number;
  averageSpeed: number;
  paceZone: number | null;
  pace: string | null;
  averageHeartrate: number | null;
}
interface BestEffort {
  name: string;
  distance: number;
  movingTime: number;
  prRank: number | null;
  pace: string | null;
}

const ZONE_COLORS: Record<string, string> = {
  '1': '#9fd4f5', '2': '#00a6fb', '3': '#9159f1', '4': '#f5a623', '5': '#e0666a'
};
const ZONE_LABELS: Record<string, string> = {
  '1': 'Z1 · Récup', '2': 'Z2 · Endurance', '3': 'Z3 · Tempo', '4': 'Z4 · Seuil', '5': 'Z5 · VMA'
};

/**
 * Affichage enrichi d'une séance à partir des données détaillées Strava (stravaData) :
 * allure par km, temps par zone d'allure, contexte (chaussures, calories, social…),
 * meilleurs efforts, et FC (conditionnelle).
 */
@Component({
  selector: 'app-strava-insights',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './strava-insights.component.html',
  styleUrl: './strava-insights.component.scss'
})
export class StravaInsightsComponent {
  data = signal<any | null>(null);

  @Input() set stravaData(value: any) {
    this.data.set(value || null);
  }

  get hasData(): boolean {
    return !!this.data();
  }

  // ---------- Allure par km ----------
  splits = computed<Split[]>(() => (this.data()?.splits || []) as Split[]);

  splitBars = computed(() => {
    const sp = this.splits().filter(s => s.averageSpeed > 0);
    if (!sp.length) return [];
    const speeds = sp.map(s => s.averageSpeed);
    const min = Math.min(...speeds);
    const max = Math.max(...speeds);
    return sp.map(s => {
      const ratio = max > min ? (s.averageSpeed - min) / (max - min) : 1;
      return {
        km: s.split,
        pace: s.pace || '—',
        width: 35 + Math.round(ratio * 65),
        fastest: s.averageSpeed === max,
        slowest: s.averageSpeed === min
      };
    });
  });

  /** Negative split : 2e moitié plus rapide (vitesse moyenne) que la 1re. */
  negativeSplit = computed<boolean | null>(() => {
    const sp = this.splits().filter(s => s.averageSpeed > 0);
    if (sp.length < 4) return null;
    const half = Math.floor(sp.length / 2);
    const avg = (arr: Split[]) => arr.reduce((a, s) => a + s.averageSpeed, 0) / arr.length;
    return avg(sp.slice(half)) > avg(sp.slice(0, half));
  });

  // ---------- Zones d'allure ----------
  zoneEntries = computed(() => {
    const dist = this.data()?.paceZoneDistribution || {};
    const total = Object.values(dist).reduce((a: number, b: any) => a + (b || 0), 0) as number;
    if (!total) return [];
    return Object.keys(dist)
      .sort()
      .map(z => ({
        zone: z,
        seconds: dist[z],
        percent: Math.round((dist[z] / total) * 100),
        color: ZONE_COLORS[z] || '#8a94a1',
        label: ZONE_LABELS[z] || ('Z' + z),
        time: this.mmss(dist[z])
      }));
  });

  // ---------- Best efforts ----------
  bestEfforts = computed<BestEffort[]>(() => (this.data()?.bestEfforts || []).slice(0, 5) as BestEffort[]);

  // ---------- Contexte ----------
  get gear() { return this.data()?.gear || null; }
  get calories() { return this.data()?.calories || null; }
  get elevation() { return this.data()?.totalElevationGain != null ? Math.round(this.data().totalElevationGain) : null; }
  get athleteCount() { return this.data()?.athleteCount || 1; }
  get kudos() { return this.data()?.kudosCount || 0; }
  get comments() { return this.data()?.commentCount || 0; }

  get partnerName(): string | null {
    const desc = this.data()?.description || '';
    const m = /(?:w\/|avec\s+)([^\n,;]+)/i.exec(desc);
    return m ? m[1].trim().slice(0, 28) : null;
  }

  get startTime(): string | null {
    const d = this.data()?.startDateLocal;
    if (!d || typeof d !== 'string' || d.length < 16) return null;
    return d.substring(11, 16);
  }
  get timeEmoji(): string {
    const t = this.startTime;
    if (!t) return '🕐';
    const h = parseInt(t.substring(0, 2), 10);
    if (h < 7) return '🌅';
    if (h < 12) return '☀️';
    if (h < 18) return '🌤️';
    return '🌙';
  }

  // ---------- Contexte (liste sobre) ----------
  contextItems = computed(() => {
    const d = this.data();
    if (!d) return [];
    const items: { label: string; value: string; sub?: string | null }[] = [];
    if (d.gear) items.push({ label: 'Chaussures', value: d.gear.nickname || d.gear.name, sub: d.gear.distanceKm != null ? d.gear.distanceKm + ' km au total' : null });
    if (this.calories) items.push({ label: 'Calories', value: this.calories + ' kcal' });
    if (this.elevation != null) items.push({ label: 'Dénivelé+', value: '+' + this.elevation + ' m' });
    if (this.athleteCount > 1) items.push({ label: 'Partenaires', value: 'À ' + this.athleteCount, sub: this.partnerName ? 'avec ' + this.partnerName : null });
    if (this.startTime) items.push({ label: 'Départ', value: this.startTime });
    if (this.cadence) items.push({ label: 'Cadence', value: this.cadence + ' ppm' });
    return items;
  });

  // ---------- FC ----------
  get hasHr(): boolean { return !!this.data()?.hasHeartrate; }
  get avgHr() { return this.data()?.averageHeartrate ? Math.round(this.data().averageHeartrate) : null; }
  get maxHr() { return this.data()?.maxHeartrate ? Math.round(this.data().maxHeartrate) : null; }
  get cadence() { return this.data()?.averageCadence ? Math.round(this.data().averageCadence * 2) : null; }

  hrCursor = signal<number | null>(null);

  /** Courbe FC par km (depuis les splits) → path SVG + points cliquables. */
  hrChart = computed(() => {
    const splits = this.splits().filter(s => !!s.averageHeartrate);
    const hr = splits.map(s => s.averageHeartrate as number);
    if (hr.length < 2) return null;
    const W = 100, H = 38, pad = 4;
    const min = Math.min(...hr), max = Math.max(...hr);
    const range = max - min || 1;
    const points = hr.map((v, i) => {
      const x = (i / (hr.length - 1)) * W;
      const y = pad + (1 - (v - min) / range) * (H - 2 * pad);
      return { x, y, xPct: (x / W) * 100, yPct: (y / H) * 100, bpm: Math.round(v), km: splits[i].split ?? (i + 1) };
    });
    const line = this.smoothPath(points);
    const area = `${line} L ${W} ${H} L 0 ${H} Z`;
    return { line, area, points, min: Math.round(min), max: Math.round(max), avg: Math.round(hr.reduce((a, b) => a + b, 0) / hr.length) };
  });

  /** Graduations axe Y (bpm) : max, milieu, min — alignées au tracé. */
  hrYTicks = computed(() => {
    const c = this.hrChart();
    if (!c) return [];
    const H = 38, pad = 4;
    const range = c.max - c.min || 1;
    const yPctFor = (v: number) => ((pad + (1 - (v - c.min) / range) * (H - 2 * pad)) / H) * 100;
    const mid = Math.round((c.max + c.min) / 2);
    return [c.max, mid, c.min].map(v => ({ bpm: v, topPct: yPctFor(v) }));
  });

  /** Graduations axe X (km) : sous-ensemble régulier pour rester lisible. */
  hrXTicks = computed(() => {
    const c = this.hrChart();
    if (!c) return [];
    const pts = c.points;
    const n = pts.length;
    const step = Math.max(1, Math.round((n - 1) / 5));
    const out: { km: number; xPct: number }[] = [];
    for (let i = 0; i < n; i += step) out.push({ km: pts[i].km, xPct: pts[i].xPct });
    const last = pts[n - 1];
    if (out[out.length - 1].km !== last.km) out.push({ km: last.km, xPct: last.xPct });
    return out;
  });

  /** Point FC actuellement sélectionné (au tap/survol). */
  selectedHr = computed(() => {
    const c = this.hrCursor();
    const chart = this.hrChart();
    if (c == null || !chart) return null;
    return chart.points[c] || null;
  });

  /** Met à jour le curseur depuis un tap/déplacement sur la courbe. */
  onHrPointer(event: PointerEvent | MouseEvent) {
    const chart = this.hrChart();
    if (!chart) return;
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    this.hrCursor.set(Math.round(ratio * (chart.points.length - 1)));
  }

  clearHrCursor() {
    this.hrCursor.set(null);
  }

  /** Construit un tracé SVG lissé (spline Catmull-Rom → Bézier) à partir des points. */
  private smoothPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  // ---------- helpers ----------
  mmss(sec: number): string {
    if (!sec) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}
