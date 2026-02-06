import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PlanningService, PlannedSession, CalendarData, SessionType, ActivityType, RunningSessionType } from '../../services/planning.service';
import { RunService, Run } from '../../services/run.service';
import { StrengthSession, StrengthSessionType, SESSION_TYPE_LABELS as STRENGTH_SESSION_LABELS } from '../../interfaces/strength.interfaces';
import { NavbarComponent } from '../../components/navbar/navbar.component';

interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  runs: Run[];
  plannedRuns: PlannedSession[];
  strengthSessions: StrengthSession[];
}

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent],
  templateUrl: './planning.component.html',
  styleUrl: './planning.component.scss'
})
export class PlanningComponent implements OnInit {
  currentDate = new Date();
  currentMonth = signal(this.currentDate.getMonth() + 1);
  currentYear = signal(this.currentDate.getFullYear());

  calendarDays = signal<CalendarDay[]>([]);
  isLoading = signal(true);
  isGenerating = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  selectedDay = signal<CalendarDay | null>(null);
  isAddingSession = signal(false);
  isSaving = signal(false);

  // Preview modal
  showPreview = signal(false);
  previewSessions = signal<Partial<PlannedSession>[]>([]);
  isConfirming = signal(false);

  // Generate options
  showGenerateOptions = signal(false);
  generateStartDate = this.getNextMonday();

  // Day configuration for generation
  generateDays: { day: string; dayIndex: number; running: boolean; strength: boolean }[] = [
    { day: 'Lundi', dayIndex: 0, running: false, strength: false },
    { day: 'Mardi', dayIndex: 1, running: false, strength: false },
    { day: 'Mercredi', dayIndex: 2, running: true, strength: false },
    { day: 'Jeudi', dayIndex: 3, running: false, strength: true },
    { day: 'Vendredi', dayIndex: 4, running: true, strength: false },
    { day: 'Samedi', dayIndex: 5, running: false, strength: false },
    { day: 'Dimanche', dayIndex: 6, running: false, strength: false }
  ];

  newSession = {
    activityType: 'running' as ActivityType,
    sessionType: 'endurance' as SessionType,
    targetDistance: null as number | null,
    targetDuration: null as number | null,
    targetPace: '',
    description: ''
  };

  runningSessionTypes: { value: RunningSessionType; label: string }[] = [
    { value: 'endurance', label: 'Endurance' },
    { value: 'fractionne', label: 'Fractionné' },
    { value: 'tempo', label: 'Tempo' },
    { value: 'recuperation', label: 'Récupération' },
    { value: 'sortie_longue', label: 'Sortie longue' },
    { value: 'cotes', label: 'Côtes' },
    { value: 'fartlek', label: 'Fartlek' }
  ];

  strengthSessionTypes: { value: StrengthSessionType; label: string }[] = [
    { value: 'upper_body', label: 'Haut du corps' },
    { value: 'lower_body', label: 'Bas du corps' },
    { value: 'full_body', label: 'Corps complet' },
    { value: 'push', label: 'Push (Poussée)' },
    { value: 'pull', label: 'Pull (Tirage)' },
    { value: 'legs', label: 'Jambes' },
    { value: 'core', label: 'Abdos / Core' },
    { value: 'hiit', label: 'HIIT' }
  ];

  // Keep for backward compatibility
  sessionTypes = this.runningSessionTypes;

  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  constructor(
    private planningService: PlanningService,
    private runService: RunService,
    private router: Router
  ) {}

  openRunDetail(run: Run) {
    if (run._id) {
      this.router.navigate(['/run', run._id]);
    }
  }

  ngOnInit() {
    this.loadCalendar();
  }

  loadCalendar() {
    this.isLoading.set(true);
    this.error.set(null);

    this.planningService.getCalendarData(this.currentMonth(), this.currentYear()).subscribe({
      next: (data) => {
        this.buildCalendar(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Erreur lors du chargement du calendrier');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }

  buildCalendar(data: CalendarData) {
    const year = this.currentYear();
    const month = this.currentMonth() - 1;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Trouver le premier lundi à afficher
    let startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - daysToSubtract);

    // Construire 6 semaines
    const days: CalendarDay[] = [];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      date.setHours(12, 0, 0, 0); // Midi pour éviter les problèmes de timezone

      // Utiliser la date locale pour la comparaison
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      const dayRuns = data.runs.filter(r => {
        const d = new Date(r.date);
        const runDateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        return runDateStr === dateStr;
      });

      const dayPlanned = data.plannedRuns.filter(p => {
        const d = new Date(p.date);
        const plannedDateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        return plannedDateStr === dateStr;
      });

      const dayStrength = (data.strengthSessions || []).filter(s => {
        const d = new Date(s.date);
        const strengthDateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        return strengthDateStr === dateStr;
      });

      days.push({
        date,
        dayOfMonth: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: dateStr === todayStr,
        runs: dayRuns,
        plannedRuns: dayPlanned,
        strengthSessions: dayStrength
      });
    }

    this.calendarDays.set(days);
  }

  previousMonth() {
    if (this.currentMonth() === 1) {
      this.currentMonth.set(12);
      this.currentYear.set(this.currentYear() - 1);
    } else {
      this.currentMonth.set(this.currentMonth() - 1);
    }
    this.loadCalendar();
  }

  nextMonth() {
    if (this.currentMonth() === 12) {
      this.currentMonth.set(1);
      this.currentYear.set(this.currentYear() + 1);
    } else {
      this.currentMonth.set(this.currentMonth() + 1);
    }
    this.loadCalendar();
  }

  getMonthName(): string {
    const date = new Date(this.currentYear(), this.currentMonth() - 1, 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  selectDay(day: CalendarDay) {
    this.selectedDay.set(day);
  }

  closeDetail() {
    this.selectedDay.set(null);
  }

  getNextMonday(): string {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
  }

  openGenerateOptions() {
    this.showGenerateOptions.set(true);
  }

  closeGenerateOptions() {
    this.showGenerateOptions.set(false);
  }

  toggleDayRunning(dayIndex: number) {
    this.generateDays[dayIndex].running = !this.generateDays[dayIndex].running;
  }

  toggleDayStrength(dayIndex: number) {
    this.generateDays[dayIndex].strength = !this.generateDays[dayIndex].strength;
  }

  hasAnyDaySelected(): boolean {
    return this.generateDays.some(d => d.running || d.strength);
  }

  generatePlan(weeks: number = 1) {
    this.isGenerating.set(true);
    this.error.set(null);
    this.successMessage.set(null);
    this.showGenerateOptions.set(false);

    // Build day config for API
    const dayConfig = this.generateDays
      .filter(d => d.running || d.strength)
      .map(d => ({
        dayIndex: d.dayIndex,
        running: d.running,
        strength: d.strength
      }));

    this.planningService.generatePlan(weeks, this.generateStartDate, dayConfig).subscribe({
      next: (response) => {
        this.isGenerating.set(false);
        this.previewSessions.set(response.sessions);
        this.showPreview.set(true);
      },
      error: (err) => {
        this.isGenerating.set(false);
        this.error.set(err.error?.error || 'Erreur lors de la génération');
        console.error(err);
      }
    });
  }

  confirmPlan() {
    this.isConfirming.set(true);

    this.planningService.confirmPlan(this.previewSessions()).subscribe({
      next: (response) => {
        this.isConfirming.set(false);
        this.showPreview.set(false);
        this.previewSessions.set([]);
        this.successMessage.set(response.message);
        this.loadCalendar();
        setTimeout(() => this.successMessage.set(null), 5000);
      },
      error: (err) => {
        this.isConfirming.set(false);
        this.error.set(err.error?.error || 'Erreur lors de la confirmation');
        console.error(err);
      }
    });
  }

  cancelPreview() {
    this.showPreview.set(false);
    this.previewSessions.set([]);
  }

  formatPreviewDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  }

  markAsCompleted(plannedRun: PlannedSession) {
    if (!plannedRun._id) return;

    this.planningService.updateStatus(plannedRun._id, 'completed').subscribe({
      next: () => {
        this.loadCalendar();
      },
      error: (err) => console.error(err)
    });
  }

  markAsSkipped(plannedRun: PlannedSession) {
    if (!plannedRun._id) return;

    this.planningService.updateStatus(plannedRun._id, 'skipped').subscribe({
      next: () => {
        this.loadCalendar();
      },
      error: (err) => console.error(err)
    });
  }

  deletePlannedSession(plannedRun: PlannedSession) {
    if (!plannedRun._id) return;

    this.planningService.deletePlannedSession(plannedRun._id).subscribe({
      next: () => {
        this.loadCalendar();
        this.refreshSelectedDay();
      },
      error: (err) => console.error(err)
    });
  }

  deleteRun(run: Run) {
    if (!run._id) return;

    this.runService.deleteRun(run._id).subscribe({
      next: () => {
        this.loadCalendar();
        this.refreshSelectedDay();
      },
      error: (err) => console.error(err)
    });
  }

  refreshSelectedDay() {
    const day = this.selectedDay();
    if (!day) return;

    setTimeout(() => {
      const updatedDays = this.calendarDays();
      const refreshedDay = updatedDays.find(d =>
        d.date.toISOString().split('T')[0] === day.date.toISOString().split('T')[0]
      );
      if (refreshedDay) {
        this.selectedDay.set(refreshedDay);
      } else {
        this.closeDetail();
      }
    }, 300);
  }

  getSessionTypeLabel(type: string): string {
    // Check if it's a strength session type
    if (STRENGTH_SESSION_LABELS[type as StrengthSessionType]) {
      return STRENGTH_SESSION_LABELS[type as StrengthSessionType];
    }
    return this.planningService.getSessionTypeLabel(type as any);
  }

  getActivityIcon(activityType?: ActivityType): string {
    return activityType === 'strength' ? '💪' : '🏃';
  }

  navigateToStrengthLog(plannedSession?: PlannedSession) {
    if (plannedSession?._id) {
      this.router.navigate(['/strength/log'], {
        queryParams: { plannedId: plannedSession._id }
      });
    } else {
      this.router.navigate(['/strength/log']);
    }
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }

  openAddSession() {
    this.isAddingSession.set(true);
    this.resetNewSession();
  }

  cancelAddSession() {
    this.isAddingSession.set(false);
    this.resetNewSession();
  }

  resetNewSession() {
    this.newSession = {
      activityType: 'running',
      sessionType: 'endurance',
      targetDistance: null,
      targetDuration: null,
      targetPace: '',
      description: ''
    };
  }

  onActivityTypeChange(type: ActivityType) {
    this.newSession.activityType = type;
    if (type === 'running') {
      this.newSession.sessionType = 'endurance';
    } else {
      this.newSession.sessionType = 'full_body';
    }
  }

  saveSession() {
    const day = this.selectedDay();
    if (!day) return;

    this.isSaving.set(true);

    const plannedRun: Partial<PlannedSession> = {
      date: day.date,
      activityType: this.newSession.activityType,
      sessionType: this.newSession.sessionType,
      targetDistance: this.newSession.activityType === 'running' ? (this.newSession.targetDistance || undefined) : undefined,
      targetDuration: this.newSession.targetDuration || undefined,
      targetPace: this.newSession.activityType === 'running' ? (this.newSession.targetPace || undefined) : undefined,
      description: this.newSession.description || undefined,
      generatedBy: 'manual',
      status: 'planned'
    };

    this.planningService.createPlannedSession(plannedRun).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isAddingSession.set(false);
        this.resetNewSession();
        this.loadCalendar();
        // Refresh the selected day data
        setTimeout(() => {
          const updatedDays = this.calendarDays();
          const refreshedDay = updatedDays.find(d =>
            d.date.toISOString().split('T')[0] === day.date.toISOString().split('T')[0]
          );
          if (refreshedDay) {
            this.selectedDay.set(refreshedDay);
          }
        }, 300);
      },
      error: (err) => {
        this.isSaving.set(false);
        console.error(err);
        this.error.set('Erreur lors de la création de la séance');
      }
    });
  }

  getDayIndicators(day: CalendarDay): { type: string; count: number }[] {
    const indicators: { type: string; count: number }[] = [];

    if (day.runs.length > 0) {
      indicators.push({ type: 'completed', count: day.runs.length });
    }

    // Strength sessions logged
    if (day.strengthSessions && day.strengthSessions.length > 0) {
      indicators.push({ type: 'strength', count: day.strengthSessions.length });
    }

    // Running planned sessions
    const runningPlanned = day.plannedRuns.filter(p => p.status === 'planned' && (!p.activityType || p.activityType === 'running'));
    const runningDone = day.plannedRuns.filter(p => p.status === 'completed' && (!p.activityType || p.activityType === 'running'));

    // Strength planned sessions
    const strengthPlanned = day.plannedRuns.filter(p => p.status === 'planned' && p.activityType === 'strength');
    const strengthDone = day.plannedRuns.filter(p => p.status === 'completed' && p.activityType === 'strength');

    const planned = runningPlanned.length;
    const done = runningDone.length;
    const skipped = day.plannedRuns.filter(p => p.status === 'skipped').length;

    if (planned > 0) indicators.push({ type: 'planned', count: planned });
    if (done > 0) indicators.push({ type: 'done', count: done });
    if (skipped > 0) indicators.push({ type: 'skipped', count: skipped });
    if (strengthPlanned.length > 0) indicators.push({ type: 'strength-planned', count: strengthPlanned.length });
    if (strengthDone.length > 0) indicators.push({ type: 'strength-done', count: strengthDone.length });

    return indicators;
  }

  getMonthStats(): { planned: number; completed: number; totalKm: number } {
    const days = this.calendarDays();
    let planned = 0;
    let completed = 0;
    let totalKm = 0;

    // Ne compter que les jours du mois affiché
    days.filter(day => day.isCurrentMonth).forEach(day => {
      planned += day.plannedRuns.filter(p => p.status === 'planned').length;
      // Complétées = séances planifiées complétées + courses analysées
      completed += day.plannedRuns.filter(p => p.status === 'completed').length + day.runs.length;
      // Total km des courses analysées
      day.runs.forEach(run => {
        if (run.distance) {
          totalKm += run.distance;
        }
      });
    });

    return { planned, completed, totalKm: Math.round(totalKm * 10) / 10 };
  }

  goToToday() {
    const today = new Date();
    this.currentMonth.set(today.getMonth() + 1);
    this.currentYear.set(today.getFullYear());
    this.loadCalendar();
  }

  getRunTitle(notes: string): string {
    if (!notes) return '';
    const lines = notes.split('\n');
    return lines[0] || '';
  }

  getRunDescription(notes: string): string {
    if (!notes) return '';
    const lines = notes.split('\n');
    // Skip title and empty line, return the rest
    return lines.slice(2).join('\n').trim();
  }
}
