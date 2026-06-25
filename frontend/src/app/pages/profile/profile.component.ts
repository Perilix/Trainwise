import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RunService, Run } from '../../services/run.service';
import { AuthService, UpdateProfileData } from '../../services/auth.service';
import { StravaService, StravaStatus } from '../../services/strava.service';
import { AthleteService } from '../../services/athlete.service';
import { CoachInvitation, Coach } from '../../interfaces/coach.interfaces';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { CompetitionsManagerComponent } from '../../components/competitions-manager/competitions-manager.component';
import { TourTooltipComponent, TourStep } from '../../components/tour-tooltip/tour-tooltip.component';

type Metric = 'seances' | 'distance' | 'temps';
type ChartPeriod = 'semaine' | 'mois' | 'annee';

interface PeriodStat {
  label: string;
  isCurrent: boolean;
  seances: number;
  distance: number;
  temps: number;
  periodStart: Date;
  periodEnd: Date;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent, CompetitionsManagerComponent, TourTooltipComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  // Visite guidée de la page profil (spotlight étape par étape)
  readonly profileTourSteps: TourStep[] = [
    {
      anchor: 'profile-card',
      faIcon: 'fa-id-card',
      title: 'Ta carte de profil',
      description: 'Ta photo, ton nom et l\'accès à tes paramètres (icône engrenage) se trouvent ici.',
    },
    {
      anchor: 'profile-sport',
      faIcon: 'fa-person-running',
      title: 'Ton profil sportif',
      description: 'Niveau, VMA, fréquence... Clique sur Modifier pour mettre à jour tes données d\'entraînement.',
    },
    {
      anchor: 'profile-competitions',
      faIcon: 'fa-trophy',
      title: 'Tes compétitions',
      description: 'Ajoute tes objectifs de la saison pour orienter tes plans et suivre tes échéances.',
    },
    {
      anchor: 'profile-coach',
      faIcon: 'fa-user-group',
      title: 'Ton coach',
      description: 'Gère ta relation avec ton coach ou rejoins-en un via un code d\'invitation.',
    },
    {
      anchor: 'profile-stats',
      faIcon: 'fa-chart-line',
      title: 'Tes statistiques',
      description: 'Visualise ton volume d\'entraînement par semaine, mois ou année.',
    },
  ];

  runs = signal<Run[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  // Edition du profil
  isEditing = signal(false);
  profileExpanded = signal(false);
  isSaving = signal(false);
  saveError = signal<string | null>(null);
  saveSuccess = signal(false);

  // Strava (uniquement déconnexion)
  stravaStatus = signal<StravaStatus | null>(null);
  stravaLoading = signal(false);
  stravaMessage = signal<string | null>(null);

  // Graphique
  selectedMetric = signal<Metric>('seances');
  selectedPeriod = signal<ChartPeriod>('semaine');
  selectedWeekIndex = signal<number | null>(null);
  readonly currentYear = new Date().getFullYear();

  chartStats = computed<PeriodStat[]>(() => {
    const period = this.selectedPeriod();
    if (period === 'mois') return this.computeMonthlyStats();
    if (period === 'annee') return this.computeYearlyStats();
    return this.computeWeeklyStats();
  });

  comparisonStats = computed<PeriodStat[] | null>(() => {
    if (this.selectedPeriod() !== 'annee') return null;
    return this.computePrevYearStats();
  });

  comparisonTotals = computed(() => {
    const comparison = this.comparisonStats();
    if (!comparison) return null;
    return {
      seances: comparison.reduce((sum, s) => sum + s.seances, 0),
      distance: Math.round(comparison.reduce((sum, s) => sum + s.distance, 0) * 10) / 10,
      temps: Math.round(comparison.reduce((sum, s) => sum + s.temps, 0))
    };
  });

  chartData = computed(() => {
    const stats = this.chartStats();
    const metric = this.selectedMetric();
    const comparison = this.comparisonStats();

    const values = stats.map(s => s[metric]);
    const compValues = comparison ? comparison.map(s => s[metric]) : [];
    const dataMax = Math.max(...values, ...compValues, 0);

    const padL = 30, padR = 8, padT = 12, plotW = 262, plotH = 75;
    const bottomY = padT + plotH;

    const { ticks, niceMax } = this.computeNiceTicks(dataMax, metric);
    const scaleMax = niceMax;

    const points = stats.map((s, i) => {
      const x = stats.length === 1 ? padL + plotW / 2 : padL + (i / (stats.length - 1)) * plotW;
      const value = s[metric];
      const y = scaleMax > 0 ? padT + plotH - (value / scaleMax) * plotH : bottomY;
      return {
        x, y, value, label: s.label, isCurrent: s.isCurrent,
        displayValue: this.formatMetricValue(value, metric),
        index: i,
        seances: s.seances,
        distance: s.distance,
        temps: s.temps,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd
      };
    });

    const linePath = this.smoothLinePath(points);
    const areaPath = `${linePath} L ${points[points.length - 1].x},${bottomY} L ${points[0].x},${bottomY} Z`;

    const tickLines = ticks.map(v => ({
      value: v,
      y: padT + plotH - (v / scaleMax) * plotH,
      label: this.formatTickLabel(v, metric)
    }));

    let comparisonPoints: { x: number; y: number; value: number; label: string }[] | null = null;
    let comparisonLinePath: string | null = null;
    if (comparison && stats.length > 0) {
      comparisonPoints = comparison.map((s, i) => {
        const x = stats.length === 1 ? padL + plotW / 2 : padL + (i / (stats.length - 1)) * plotW;
        const value = s[metric];
        const y = scaleMax > 0 ? padT + plotH - (value / scaleMax) * plotH : bottomY;
        return { x, y, value, label: s.label };
      });
      comparisonLinePath = this.smoothLinePath(comparisonPoints);
    }

    return { points, linePath, areaPath, bottomY, tickLines, padL, comparisonPoints, comparisonLinePath };
  });



  selectedPointData = computed(() => {
    const idx = this.selectedWeekIndex();
    if (idx === null) return null;
    return this.chartData().points[idx] ?? null;
  });

  selectedPointTooltip = computed(() => {
    const pt = this.selectedPointData();
    if (!pt) return null;
    const tooltipW = 82;
    const tooltipH = 24;
    const padL = 30;
    const boxX = Math.max(padL, Math.min(pt.x - tooltipW / 2, 292 - tooltipW));
    const boxY = Math.max(4, pt.y - tooltipH - 8);
    const label = this.formatPeriodRange(pt.periodStart, pt.periodEnd);
    const value = this.getMetricDisplay(pt);
    return { pt, boxX, boxY, tooltipW, tooltipH, label, value };
  });

  periodTotals = computed(() => {
    const stats = this.chartStats();
    return {
      seances: stats.reduce((sum, s) => sum + s.seances, 0),
      distance: Math.round(stats.reduce((sum, s) => sum + s.distance, 0) * 10) / 10,
      temps: Math.round(stats.reduce((sum, s) => sum + s.temps, 0))
    };
  });

  // Coach
  currentCoach = signal<Coach | null>(null);
  pendingInvitations = signal<CoachInvitation[]>([]);
  coachLoading = signal(false);
  coachMessage = signal<string | null>(null);
  coachMessageType = signal<'success' | 'error'>('success');
  inviteCode = '';
  joiningByCode = signal(false);

  profileForm: UpdateProfileData = {
    runningLevel: undefined,
    weeklyFrequency: undefined,
    injuries: '',
    availableDays: [],
    preferredTime: undefined,
    age: 0,
    gender: '',
    height: undefined,
    weight: undefined,
    vma: undefined,
    fcmax: undefined,
    strengthFrequency: undefined,
    strengthGoal: undefined,
    strengthType: undefined
  };

  allDays = [
    { value: 'lundi', label: 'Lun' },
    { value: 'mardi', label: 'Mar' },
    { value: 'mercredi', label: 'Mer' },
    { value: 'jeudi', label: 'Jeu' },
    { value: 'vendredi', label: 'Ven' },
    { value: 'samedi', label: 'Sam' },
    { value: 'dimanche', label: 'Dim' }
  ];

  preferredTimes = [
    { value: 'matin', label: 'Matin' },
    { value: 'midi', label: 'Midi' },
    { value: 'soir', label: 'Soir' },
    { value: 'flexible', label: 'Flexible' }
  ];

  runningLevels = [
    { value: 'debutant', label: 'Débutant' },
    { value: 'intermediaire', label: 'Intermédiaire' },
    { value: 'confirme', label: 'Confirmé' },
    { value: 'expert', label: 'Expert' }
  ];

  genders = [
    { value: 'homme', label: 'Homme' },
    { value: 'femme', label: 'Femme' },
    { value: 'autre', label: 'Autre' }
  ];

  strengthGoals = [
    { value: 'force', label: 'Force / Puissance' },
    { value: 'hypertrophie', label: 'Hypertrophie' },
    { value: 'endurance_musculaire', label: 'Endurance musculaire' },
    { value: 'remise_en_forme', label: 'Remise en forme' },
    { value: 'fonctionnel', label: 'Fonctionnel / Mobilité' }
  ];

  strengthTypes = [
    { value: 'poids_libres', label: 'Poids libres' },
    { value: 'machines', label: 'Machines' },
    { value: 'bodyweight', label: 'Poids de corps' },
    { value: 'crossfit', label: 'CrossFit / HIIT' },
    { value: 'mixte', label: 'Mixte' }
  ];

  constructor(
    private runService: RunService,
    public authService: AuthService,
    private stravaService: StravaService,
    private athleteService: AthleteService,
    private router: Router
  ) {}

  openRunDetail(run: Run) {
    if (run._id) {
      this.router.navigate(['/run', run._id]);
    }
  }

  ngOnInit() {
    this.loadRuns();
    this.initProfileForm();
    this.loadCoachData();
    this.loadStravaStatus();
  }

  loadStravaStatus() {
    this.stravaLoading.set(true);
    this.stravaService.getStatus().subscribe({
      next: (status) => {
        this.stravaStatus.set(status);
        this.stravaLoading.set(false);
      },
      error: () => {
        this.stravaLoading.set(false);
      }
    });
  }

  disconnectStrava() {
    if (!confirm('Déconnecter votre compte Strava ?')) return;

    this.stravaLoading.set(true);
    this.stravaService.disconnect().subscribe({
      next: () => {
        this.stravaStatus.set({ connected: false, athleteId: null, connectedAt: null });
        this.stravaLoading.set(false);
        this.stravaMessage.set('Compte Strava déconnecté');
        setTimeout(() => this.stravaMessage.set(null), 3000);
      },
      error: () => {
        this.stravaLoading.set(false);
        this.stravaMessage.set('Erreur lors de la déconnexion');
      }
    });
  }

  initProfileForm() {
    const user = this.authService.currentUser();
    if (user) {
      this.profileForm = {
        runningLevel: user.runningLevel || undefined,
        weeklyFrequency: user.weeklyFrequency || undefined,
        injuries: user.injuries || '',
        availableDays: user.availableDays || [],
        preferredTime: user.preferredTime || undefined,
        age: user.age || 0,
        gender: user.gender || '',
        height: user.height ?? undefined,
        weight: user.weight ?? undefined,
        vma: user.vma ?? undefined,
        fcmax: user.fcmax ?? undefined,
        strengthFrequency: user.strengthFrequency ?? undefined,
        strengthGoal: user.strengthGoal || undefined,
        strengthType: user.strengthType || undefined
      };
    }
  }

  getStrengthGoalLabel(value: string | undefined): string {
    if (!value) return 'Non défini';
    return this.strengthGoals.find(g => g.value === value)?.label ?? value;
  }

  getStrengthTypeLabel(value: string | undefined): string {
    if (!value) return 'Non défini';
    return this.strengthTypes.find(t => t.value === value)?.label ?? value;
  }

  toggleDay(day: string) {
    const days = this.profileForm.availableDays || [];
    const index = days.indexOf(day);
    if (index === -1) {
      this.profileForm.availableDays = [...days, day];
    } else {
      this.profileForm.availableDays = days.filter(d => d !== day);
    }
  }

  isDaySelected(day: string): boolean {
    return (this.profileForm.availableDays || []).includes(day);
  }

  getAvailableDaysDisplay(): string {
    const days = this.authService.currentUser()?.availableDays || [];
    if (days.length === 0) return 'Non définis';
    return days.map(d => {
      const found = this.allDays.find(day => day.value === d);
      return found ? found.label : d;
    }).join(', ');
  }

  getPreferredTimeLabel(time: string | undefined): string {
    if (!time) return 'Non défini';
    const found = this.preferredTimes.find(t => t.value === time);
    return found ? found.label : time;
  }

  toggleEdit() {
    if (this.isEditing()) {
      this.initProfileForm();
    }
    this.isEditing.set(!this.isEditing());
    this.saveError.set(null);
    this.saveSuccess.set(false);
  }

  saveProfile() {
    this.isSaving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    this.authService.updateProfile(this.profileForm).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saveSuccess.set(true);
        this.isEditing.set(false);
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.saveError.set('Erreur lors de la sauvegarde');
        console.error(err);
      }
    });
  }

  loadRuns() {
    this.isLoading.set(true);
    this.runService.getAllRuns().subscribe({
      next: (runs) => {
        this.runs.set(runs);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Erreur lors du chargement de l\'historique');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }

  getTotalDistance(): number {
    return this.runs().reduce((sum, run) => sum + (run.distance || 0), 0);
  }

  getTotalDuration(): number {
    return this.runs().reduce((sum, run) => sum + (run.duration || 0), 0);
  }

  getTotalRuns(): number {
    return this.runs().length;
  }

  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  getRunSummary(run: Run): string {
    const parts: string[] = [];

    if (run.distance) {
      parts.push(`${run.distance} km`);
    }
    if (run.duration) {
      parts.push(this.formatDuration(run.duration));
    }
    if (run.averagePace) {
      parts.push(`${run.averagePace}/km`);
    }

    return parts.join(' • ') || 'Aucune donnée';
  }

  getFeelingEmoji(feeling: number | undefined): string {
    if (!feeling) return '';
    if (feeling >= 9) return '🔥';
    if (feeling >= 7) return '😊';
    if (feeling >= 5) return '😐';
    if (feeling >= 3) return '😕';
    return '😫';
  }

  getLevelLabel(level: string | undefined): string {
    if (!level) return 'Non défini';
    const found = this.runningLevels.find(l => l.value === level);
    return found ? found.label : level;
  }

  // Coach methods
  loadCoachData() {
    this.coachLoading.set(true);

    // Load current coach
    this.athleteService.getCurrentCoach().subscribe({
      next: (coach) => {
        this.currentCoach.set(coach);
      },
      error: () => {
        // No coach - that's fine
      }
    });

    // Load pending invitations
    this.athleteService.getPendingInvitations().subscribe({
      next: (invitations) => {
        this.pendingInvitations.set(invitations);
        this.coachLoading.set(false);
      },
      error: () => {
        this.coachLoading.set(false);
      }
    });
  }

  acceptInvitation(invitationId: string) {
    this.coachLoading.set(true);
    this.athleteService.acceptInvitation(invitationId).subscribe({
      next: () => {
        this.showCoachMessage('Invitation acceptée !', 'success');
        this.loadCoachData();
      },
      error: (err) => {
        this.coachLoading.set(false);
        this.showCoachMessage(err.error?.error || 'Erreur lors de l\'acceptation', 'error');
      }
    });
  }

  rejectInvitation(invitationId: string) {
    this.coachLoading.set(true);
    this.athleteService.rejectInvitation(invitationId).subscribe({
      next: () => {
        this.showCoachMessage('Invitation refusée', 'success');
        this.loadCoachData();
      },
      error: (err) => {
        this.coachLoading.set(false);
        this.showCoachMessage(err.error?.error || 'Erreur lors du refus', 'error');
      }
    });
  }

  joinByCode() {
    if (!this.inviteCode.trim()) return;

    this.joiningByCode.set(true);
    this.athleteService.joinViaCode(this.inviteCode.trim()).subscribe({
      next: () => {
        this.joiningByCode.set(false);
        this.inviteCode = '';
        this.showCoachMessage('Demande envoyée au coach !', 'success');
        this.loadCoachData();
      },
      error: (err) => {
        this.joiningByCode.set(false);
        this.showCoachMessage(err.error?.error || 'Code invalide ou erreur', 'error');
      }
    });
  }

  leaveCoach() {
    if (!confirm('Êtes-vous sûr de vouloir quitter votre coach ?')) return;

    this.coachLoading.set(true);
    this.athleteService.leaveCoach().subscribe({
      next: () => {
        this.currentCoach.set(null);
        this.coachLoading.set(false);
        this.showCoachMessage('Vous avez quitté votre coach', 'success');
      },
      error: (err) => {
        this.coachLoading.set(false);
        this.showCoachMessage(err.error?.error || 'Erreur', 'error');
      }
    });
  }

  showCoachMessage(message: string, type: 'success' | 'error') {
    this.coachMessage.set(message);
    this.coachMessageType.set(type);
    setTimeout(() => this.coachMessage.set(null), 5000);
  }

  logout() {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
      this.authService.logout();
    }
  }

  selectMetric(metric: Metric) {
    this.selectedMetric.set(metric);
    this.selectedWeekIndex.set(null);
  }

  selectPeriod(period: ChartPeriod) {
    this.selectedPeriod.set(period);
    this.selectedWeekIndex.set(null);
  }

  selectWeek(index: number) {
    this.selectedWeekIndex.set(this.selectedWeekIndex() === index ? null : index);
  }

  private getWeekStart(date: Date, weekOffset = 0): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private computeWeeklyStats(): PeriodStat[] {
    const result: PeriodStat[] = [];
    const now = new Date();
    const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

    for (let i = 11; i >= 0; i--) {
      const periodStart = this.getWeekStart(now, -i);
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 6);
      periodEnd.setHours(23, 59, 59, 999);

      const weekRuns = this.runs().filter(run => {
        const d = new Date(run.date);
        return d >= periodStart && d <= periodEnd;
      });

      const prevMonth = result.length > 0 ? result[result.length - 1].periodStart.getMonth() : -1;
      const label = periodStart.getMonth() !== prevMonth ? monthLabels[periodStart.getMonth()] : '';

      result.push({
        label,
        isCurrent: i === 0,
        seances: weekRuns.length,
        distance: Math.round(weekRuns.reduce((sum, r) => sum + (r.distance || 0), 0) * 10) / 10,
        temps: Math.round(weekRuns.reduce((sum, r) => sum + (r.duration || 0), 0)),
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd)
      });
    }
    return result;
  }

  private computeMonthlyStats(): PeriodStat[] {
    const result: PeriodStat[] = [];
    const now = new Date();
    const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthRuns = this.runs().filter(run => {
        const rd = new Date(run.date);
        return rd >= periodStart && rd <= periodEnd;
      });

      result.push({
        label: monthLabels[d.getMonth()],
        isCurrent: i === 0,
        seances: monthRuns.length,
        distance: Math.round(monthRuns.reduce((sum, r) => sum + (r.distance || 0), 0) * 10) / 10,
        temps: Math.round(monthRuns.reduce((sum, r) => sum + (r.duration || 0), 0)),
        periodStart,
        periodEnd
      });
    }
    return result;
  }

  private computeYearlyStats(): PeriodStat[] {
    return this.computeYearMonthStats(new Date().getFullYear());
  }

  private computePrevYearStats(): PeriodStat[] {
    return this.computeYearMonthStats(new Date().getFullYear() - 1);
  }

  private computeYearMonthStats(year: number): PeriodStat[] {
    const runs = this.runs();
    const now = new Date();
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

    return Array.from({ length: 12 }, (_, m) => {
      const periodStart = new Date(year, m, 1);
      const periodEnd = new Date(year, m + 1, 0, 23, 59, 59, 999);
      const monthRuns = runs.filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === year && d.getMonth() === m;
      });
      return {
        label: monthNames[m],
        isCurrent: year === now.getFullYear() && m === now.getMonth(),
        seances: monthRuns.length,
        distance: Math.round(monthRuns.reduce((sum, r) => sum + (r.distance || 0), 0) * 10) / 10,
        temps: Math.round(monthRuns.reduce((sum, r) => sum + (r.duration || 0), 0)),
        periodStart,
        periodEnd
      };
    });
  }

  formatPeriodRange(periodStart: Date, periodEnd: Date): string {
    const period = this.selectedPeriod();
    const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
    if (period === 'annee') {
      const fullMonths = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      return `${fullMonths[periodStart.getMonth()]} ${periodStart.getFullYear()}`;
    }
    if (period === 'mois') {
      const fullMonths = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      return `${fullMonths[periodStart.getMonth()]} ${periodStart.getFullYear()}`;
    }
    const s = `${periodStart.getDate()} ${months[periodStart.getMonth()]}`;
    const e = `${periodEnd.getDate()} ${months[periodEnd.getMonth()]}`;
    return `${s} → ${e}`;
  }

  getMetricDisplay(pt: { seances: number; distance: number; temps: number }): string {
    const metric = this.selectedMetric();
    if (metric === 'seances') return `${pt.seances} séance${pt.seances > 1 ? 's' : ''}`;
    if (metric === 'distance') return `${pt.distance.toFixed(1)} km`;
    return this.formatDuration(pt.temps);
  }

  getPeriodTotalDisplay(): string {
    const t = this.periodTotals();
    const metric = this.selectedMetric();
    if (metric === 'seances') return `${t.seances} séance${t.seances > 1 ? 's' : ''}`;
    if (metric === 'distance') return `${t.distance.toFixed(1)} km`;
    return this.formatDuration(t.temps);
  }

  getComparisonTotalDisplay(): string {
    const t = this.comparisonTotals();
    if (!t) return '';
    const metric = this.selectedMetric();
    if (metric === 'seances') return `${t.seances} séance${t.seances > 1 ? 's' : ''}`;
    if (metric === 'distance') return `${t.distance.toFixed(1)} km`;
    return this.formatDuration(t.temps);
  }

  getComparisonDelta(): { value: string; positive: boolean } | null {
    const current = this.periodTotals();
    const prev = this.comparisonTotals();
    if (!prev) return null;
    const metric = this.selectedMetric();
    const cur = current[metric];
    const ref = prev[metric];
    if (ref === 0) return null;
    const pct = Math.round(((cur - ref) / ref) * 100);
    return { value: `${pct > 0 ? '+' : ''}${pct}%`, positive: pct >= 0 };
  }

  private computeNiceTicks(max: number, metric: Metric): { ticks: number[]; niceMax: number } {
    if (max === 0) return { ticks: [0], niceMax: 1 };
    let step: number;
    if (metric === 'seances') {
      step = Math.max(1, Math.ceil(max / 3));
    } else if (metric === 'distance') {
      const rough = max / 3;
      if (rough <= 2) step = 2;
      else if (rough <= 5) step = 5;
      else if (rough <= 10) step = 10;
      else if (rough <= 20) step = 20;
      else if (rough <= 50) step = 50;
      else step = 100;
    } else {
      const rough = max / 3;
      if (rough <= 15) step = 15;
      else if (rough <= 30) step = 30;
      else if (rough <= 45) step = 45;
      else if (rough <= 60) step = 60;
      else if (rough <= 90) step = 90;
      else step = 120;
    }
    const niceMax = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = 0; v <= niceMax; v += step) ticks.push(v);
    return { ticks, niceMax };
  }

  private formatTickLabel(value: number, metric: Metric): string {
    if (value === 0) return '0';
    if (metric === 'seances') return `${value}`;
    if (metric === 'distance') return `${value}`;
    const h = Math.floor(value / 60);
    const m = value % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h${m}`;
  }

  private smoothLinePath(points: { x: number; y: number }[]): string {
    if (points.length < 2) return '';
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
    }
    return d;
  }

  private formatMetricValue(value: number, metric: Metric): string {
    if (!value) return '';
    if (metric === 'distance') return `${value.toFixed(1)}`;
    if (metric === 'temps') return this.formatDuration(value);
    return `${value}`;
  }
}
