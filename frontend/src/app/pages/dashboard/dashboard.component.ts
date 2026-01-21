import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { RunService, Run } from '../../services/run.service';
import { PlanningService, PlannedRun } from '../../services/planning.service';
import { AuthService } from '../../services/auth.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';

interface WeekDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  runs: Run[];
  plannedRuns: PlannedRun[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  // Data
  recentRuns = signal<Run[]>([]);
  weekDays = signal<WeekDay[]>([]);
  upcomingSession = signal<PlannedRun | null>(null);

  // Loading states
  isLoading = signal(true);

  // Computed
  streak = signal(0);
  weekStats = signal({ runs: 0, distance: 0, duration: 0 });

  constructor(
    private runService: RunService,
    private planningService: PlanningService,
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.isLoading.set(true);

    // Load current week calendar
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    this.planningService.getCalendarData(month, year).subscribe({
      next: (data) => {
        this.buildWeekView(data.runs, data.plannedRuns);
        this.calculateStreak(data.runs);
        this.calculateWeekStats(data.runs);
        this.findUpcomingSession(data.plannedRuns);
        this.recentRuns.set(data.runs.slice(0, 4));
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.isLoading.set(false);
      }
    });
  }

  buildWeekView(runs: Run[], plannedRuns: PlannedRun[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get Monday of current week
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const days: WeekDay[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);

      const dateStr = this.formatDateStr(date);

      const dayRuns = runs.filter(r => {
        const d = new Date(r.date);
        return this.formatDateStr(d) === dateStr;
      });

      const dayPlanned = plannedRuns.filter(p => {
        const d = new Date(p.date);
        return this.formatDateStr(d) === dateStr;
      });

      days.push({
        date,
        dayName: dayNames[i],
        dayNumber: date.getDate(),
        isToday: this.formatDateStr(date) === this.formatDateStr(today),
        isPast: date < today,
        runs: dayRuns,
        plannedRuns: dayPlanned
      });
    }

    this.weekDays.set(days);
  }

  formatDateStr(date: Date): string {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  calculateStreak(runs: Run[]) {
    if (runs.length === 0) {
      this.streak.set(0);
      return;
    }

    // Sort by date descending
    const sortedRuns = [...runs].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let checkDate = new Date(today);

    // Check if ran today or yesterday to start streak
    const lastRunDate = new Date(sortedRuns[0].date);
    lastRunDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
      this.streak.set(0);
      return;
    }

    // Count consecutive days with runs (looking at weeks, not strict days)
    const runDates = new Set(sortedRuns.map(r => this.formatDateStr(new Date(r.date))));

    for (let i = 0; i < 365; i++) {
      checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);

      if (runDates.has(this.formatDateStr(checkDate))) {
        currentStreak++;
      } else if (i > 0) {
        // Allow one day gap for rest days
        const prevDate = new Date(today);
        prevDate.setDate(today.getDate() - i + 1);
        if (!runDates.has(this.formatDateStr(prevDate))) {
          break;
        }
      }
    }

    // Simplified: count weeks with at least one run
    const weeksWithRuns = new Set<string>();
    sortedRuns.forEach(r => {
      const d = new Date(r.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      weeksWithRuns.add(this.formatDateStr(weekStart));
    });

    this.streak.set(Math.min(currentStreak, 99)); // Cap at 99 for display
  }

  calculateWeekStats(runs: Run[]) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weekRuns = runs.filter(r => {
      const runDate = new Date(r.date);
      return runDate >= monday && runDate <= sunday;
    });

    const totalDistance = weekRuns.reduce((sum, r) => sum + (r.distance || 0), 0);
    const totalDuration = weekRuns.reduce((sum, r) => sum + (r.duration || 0), 0);

    this.weekStats.set({
      runs: weekRuns.length,
      distance: Math.round(totalDistance * 10) / 10,
      duration: Math.round(totalDuration)
    });
  }

  findUpcomingSession(plannedRuns: PlannedRun[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = plannedRuns
      .filter(p => {
        const pDate = new Date(p.date);
        pDate.setHours(0, 0, 0, 0);
        return pDate >= today && p.status === 'planned';
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    this.upcomingSession.set(upcoming[0] || null);
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }

  getMotivationalMessage(): string {
    const messages = [
      "Prêt à repousser tes limites ?",
      "Chaque kilomètre compte !",
      "La constance fait la différence.",
      "Un pas après l'autre.",
      "Ta meilleure version t'attend."
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  getSessionTypeLabel(type: string): string {
    return this.planningService.getSessionTypeLabel(type as any);
  }

  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h${mins > 0 ? mins : ''}`;
    }
    return `${mins}min`;
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (this.formatDateStr(d) === this.formatDateStr(today)) {
      return "Aujourd'hui";
    }
    if (this.formatDateStr(d) === this.formatDateStr(tomorrow)) {
      return "Demain";
    }

    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'short'
    });
  }

  formatRunDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  }

  getDayStatus(day: WeekDay): string {
    if (day.runs.length > 0) return 'completed';
    if (day.plannedRuns.some(p => p.status === 'planned')) return 'planned';
    if (day.plannedRuns.some(p => p.status === 'completed')) return 'done';
    if (day.plannedRuns.some(p => p.status === 'skipped')) return 'skipped';
    return 'empty';
  }

  openRunDetail(run: Run) {
    if (run._id) {
      this.router.navigate(['/run', run._id]);
    }
  }

  getRunTitle(notes: string | undefined): string {
    if (!notes) return 'Course';
    return notes.split('\n')[0] || 'Course';
  }

  getTips(): { icon: string; title: string; text: string }[] {
    const user = this.authService.currentUser();
    const tips: { icon: string; title: string; text: string }[] = [];

    // Tip basé sur la streak
    if (this.streak() >= 7) {
      tips.push({
        icon: '🔥',
        title: 'Série en cours !',
        text: `${this.streak()} jours d'affilée, continue comme ça !`
      });
    }

    // Tip basé sur le niveau
    if (user?.runningLevel === 'debutant') {
      tips.push({
        icon: '💡',
        title: 'Conseil du jour',
        text: 'Privilégie la régularité à l\'intensité. 3 sorties de 30min valent mieux qu\'une de 2h.'
      });
    }

    // Tip basé sur l'objectif
    if (user?.goal === 'marathon') {
      tips.push({
        icon: '🎯',
        title: 'Objectif Marathon',
        text: 'N\'oublie pas ta sortie longue hebdomadaire, clé de l\'endurance.'
      });
    }

    // Tips génériques si rien de spécifique
    if (tips.length === 0) {
      tips.push({
        icon: '⚡',
        title: 'Le saviez-vous ?',
        text: 'Une bonne hydratation améliore tes performances de 10 à 15%.'
      });
    }

    return tips.slice(0, 2);
  }
}
