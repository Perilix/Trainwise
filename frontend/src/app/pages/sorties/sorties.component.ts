import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RunService, Run } from '../../services/run.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { RunMiniMapComponent } from '../../components/run-mini-map/run-mini-map.component';

type Period = 'month' | '3months' | 'all';

interface KPIs {
  totalKm: number;
  totalRuns: number;
  avgPaceStr: string;
  totalDurationMin: number;
  trend: number | null;
}

interface WeekData {
  label: string;
  totalKm: number;
  totalRuns: number;
  deltaKm: number | null;
  isCurrentWeek: boolean;
}

@Component({
  selector: 'app-sorties',
  standalone: true,
  imports: [CommonModule, NavbarComponent, RunMiniMapComponent],
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

    const trend = this.computeTrend(runs, totalKm);
    return { totalKm, totalRuns, avgPaceStr, totalDurationMin, trend };
  });

  weeklyData = computed<WeekData[]>(() => {
    const runs = this.allRuns();
    const now = new Date();
    const currentMonday = this.getMonday(now);
    const weeks: WeekData[] = [];

    for (let i = 0; i < 10; i++) {
      const weekStart = new Date(currentMonday);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekRuns = runs.filter(r => {
        const d = new Date(r.date);
        return d >= weekStart && d < weekEnd;
      });

      const totalKm = weekRuns.reduce((s, r) => s + (r.distance || 0), 0);
      const day = weekStart.getDate();
      const month = weekStart.toLocaleDateString('fr-FR', { month: 'short' });

      weeks.push({
        label: i === 0 ? 'Cette sem.' : `${day} ${month}`,
        totalKm,
        totalRuns: weekRuns.length,
        deltaKm: null,
        isCurrentWeek: i === 0
      });
    }

    // Calcul delta vs semaine précédente
    for (let i = 0; i < weeks.length - 1; i++) {
      const prevKm = weeks[i + 1].totalKm;
      if (prevKm > 0) {
        weeks[i].deltaKm = Math.round(((weeks[i].totalKm - prevKm) / prevKm) * 100);
      } else if (weeks[i].totalKm > 0) {
        weeks[i].deltaKm = null; // Pas de référence
      }
    }

    // Garder semaine actuelle + semaines avec des sorties
    return weeks.filter((w, i) => i === 0 || w.totalRuns > 0);
  });

  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

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

  getRunTitle(run: Run): string {
    const name = run.notes?.split('\n')[0];
    return name || this.formatDate(run.date);
  }
}
