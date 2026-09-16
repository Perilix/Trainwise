import { Component, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RunService, Run } from '../../services/run.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { RunMiniMapComponent } from '../../components/run-mini-map/run-mini-map.component';
import { TourTooltipComponent, TourStep } from '../../components/tour-tooltip/tour-tooltip.component';

type ViewMode = 'week' | 'month' | 'year';

interface KPIs {
  totalKm: number;
  totalRuns: number;
  avgPaceStr: string;
  totalDurationMin: number;
}

export interface PeriodBlock {
  id: string;
  label: string;
  sublabel: string;
  startDate: Date;
  endDate: Date;
  totalKm: number;
  totalRuns: number;
  deltaKm: number | null;
}

@Component({
  selector: 'app-sorties',
  standalone: true,
  imports: [CommonModule, NavbarComponent, RunMiniMapComponent, TourTooltipComponent],
  templateUrl: './sorties.component.html',
  styleUrl: './sorties.component.scss'
})
export class SortiesComponent implements OnInit {
  // Visite guidée de la page "Mes sorties" (spotlight étape par étape)
  readonly sortiesTourSteps: TourStep[] = [
    {
      anchor: 'sorties-period',
      faIcon: 'fa-calendar-week',
      title: 'Choisis ta période',
      description: 'Bascule entre semaine, mois et année pour analyser tes sorties sur la durée qui t\'intéresse.',
    },
    {
      anchor: 'sorties-blocks',
      faIcon: 'fa-layer-group',
      title: 'Navigue dans le temps',
      description: 'Chaque bloc résume une période (km, nombre de sorties, évolution). Clique pour la sélectionner.',
    },
    {
      anchor: 'sorties-kpis',
      faIcon: 'fa-gauge-high',
      title: 'Tes indicateurs clés',
      description: 'Distance totale, nombre de sorties, allure moyenne et temps cumulé sur la période choisie.',
    },
    {
      anchor: 'sorties-feed',
      faIcon: 'fa-list',
      title: 'Le détail de tes sorties',
      description: 'La liste de toutes tes sorties. Clique sur l\'une d\'elles pour voir son analyse complète.',
    },
  ];

  allRuns = signal<Run[]>([]);
  loading = signal(true);
  viewMode = signal<ViewMode>('week');
  selectedBlockId = signal<string | null>(null);

  constructor(private runService: RunService, private router: Router) {
    // Quand le viewMode change, sélectionner automatiquement le bloc le plus récent
    effect(() => {
      this.viewMode(); // dépendance
      const blocks = this.periodBlocks();
      if (blocks.length > 0) {
        this.selectedBlockId.set(blocks[0].id);
      }
    });
  }

  ngOnInit() {
    this.runService.getAllRuns().subscribe({
      next: runs => {
        this.allRuns.set(runs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  // ── Blocs de période ────────────────────────────────────────
  periodBlocks = computed<PeriodBlock[]>(() => {
    const runs = this.allRuns();
    const mode = this.viewMode();
    const now = new Date();

    if (mode === 'week') return this.buildWeekBlocks(runs, now);
    if (mode === 'month') return this.buildMonthBlocks(runs, now);
    return this.buildYearBlocks(runs, now);
  });

  private buildWeekBlocks(runs: Run[], now: Date): PeriodBlock[] {
    const currentMonday = this.getMonday(now);
    const blocks: PeriodBlock[] = [];

    for (let i = 0; i < 20; i++) {
      const start = new Date(currentMonday);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      const weekRuns = runs.filter(r => {
        const d = new Date(r.date);
        return d >= start && d < end;
      });

      if (i > 0 && weekRuns.length === 0) continue;

      const totalKm = weekRuns.reduce((s, r) => s + (r.distance || 0), 0);
      const startDay = start.getDate();
      const endDay = new Date(end.getTime() - 1).getDate();
      const startMonth = start.toLocaleDateString('fr-FR', { month: 'short' });
      const endMonth = new Date(end.getTime() - 1).toLocaleDateString('fr-FR', { month: 'short' });
      const monthSuffix = startMonth !== endMonth ? ` ${endMonth}` : '';

      blocks.push({
        id: start.toISOString(),
        label: i === 0 ? 'Cette sem.' : `${startDay}–${endDay}${monthSuffix}`,
        sublabel: i === 0 ? `${startDay} ${startMonth}` : startMonth,
        startDate: start,
        endDate: end,
        totalKm,
        totalRuns: weekRuns.length,
        deltaKm: null
      });

      if (blocks.length === 5) break;
    }

    this.computeDeltas(blocks);
    return blocks;
  }

  private buildMonthBlocks(runs: Run[], now: Date): PeriodBlock[] {
    const blocks: PeriodBlock[] = [];

    for (let i = 0; i < 24; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthRuns = runs.filter(r => {
        const d = new Date(r.date);
        return d >= start && d < end;
      });

      if (i > 0 && monthRuns.length === 0) continue;

      const totalKm = monthRuns.reduce((s, r) => s + (r.distance || 0), 0);
      const monthName = start.toLocaleDateString('fr-FR', { month: 'long' });
      const year = start.getFullYear();

      blocks.push({
        id: `${year}-${start.getMonth()}`,
        label: i === 0 ? 'Ce mois' : monthName.charAt(0).toUpperCase() + monthName.slice(1),
        sublabel: year.toString(),
        startDate: start,
        endDate: end,
        totalKm,
        totalRuns: monthRuns.length,
        deltaKm: null
      });

      if (blocks.length === 5) break;
    }

    this.computeDeltas(blocks);
    return blocks;
  }

  private buildYearBlocks(runs: Run[], now: Date): PeriodBlock[] {
    const blocks: PeriodBlock[] = [];

    for (let i = 0; i < 10; i++) {
      const year = now.getFullYear() - i;
      const start = new Date(year, 0, 1);
      const end = new Date(year + 1, 0, 1);

      const yearRuns = runs.filter(r => {
        const d = new Date(r.date);
        return d >= start && d < end;
      });

      if (i > 0 && yearRuns.length === 0) continue;

      const totalKm = yearRuns.reduce((s, r) => s + (r.distance || 0), 0);

      blocks.push({
        id: year.toString(),
        label: i === 0 ? 'Cette année' : year.toString(),
        sublabel: `${yearRuns.length} sortie${yearRuns.length > 1 ? 's' : ''}`,
        startDate: start,
        endDate: end,
        totalKm,
        totalRuns: yearRuns.length,
        deltaKm: null
      });

      if (blocks.length === 5) break;
    }

    this.computeDeltas(blocks);
    return blocks;
  }

  private computeDeltas(blocks: PeriodBlock[]) {
    for (let i = 0; i < blocks.length - 1; i++) {
      const prevKm = blocks[i + 1].totalKm;
      if (prevKm > 0) {
        blocks[i].deltaKm = Math.round(((blocks[i].totalKm - prevKm) / prevKm) * 100);
      }
    }
  }

  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // ── Runs filtrés selon le bloc sélectionné ──────────────────
  filteredRuns = computed<Run[]>(() => {
    const id = this.selectedBlockId();
    const blocks = this.periodBlocks();
    const block = blocks.find(b => b.id === id);
    if (!block) return [];
    const runs = this.allRuns();
    return runs.filter(r => {
      const d = new Date(r.date);
      return d >= block.startDate && d < block.endDate;
    });
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

    return { totalKm, totalRuns, avgPaceStr, totalDurationMin };
  });

  // ── Actions ──────────────────────────────────────────────────
  setViewMode(m: ViewMode) { this.viewMode.set(m); }
  selectBlock(id: string) { this.selectedBlockId.set(id); }

  goToRun(run: Run) {
    if (run._id) this.router.navigate(['/run', run._id]);
  }

  // ── Formatters ───────────────────────────────────────────────
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
