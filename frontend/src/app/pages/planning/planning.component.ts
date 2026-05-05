import { Component, OnInit, inject, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlanningService, PlannedSession, CalendarData, SessionType, ActivityType, RunningSessionType } from '../../services/planning.service';
import { RunService, Run, RunBlock } from '../../services/run.service';
import { StrengthSession, StrengthSessionType, SESSION_TYPE_LABELS as STRENGTH_SESSION_LABELS } from '../../interfaces/strength.interfaces';
import { StrengthService } from '../../services/strength.service';
import { AthleteService } from '../../services/athlete.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { TourTooltipComponent, TourStep } from '../../components/tour-tooltip/tour-tooltip.component';
import { SubscriptionService } from '../../services/subscription.service';

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
  imports: [CommonModule, FormsModule, NavbarComponent, TourTooltipComponent],
  templateUrl: './planning.component.html',
  styleUrl: './planning.component.scss'
})
export class PlanningComponent implements OnInit {
  readonly planningTourSteps: TourStep[] = [
    {
      faIcon: 'fa-calendar-days',
      title: 'Vue calendrier',
      description: 'Navigue entre les mois pour voir toutes tes séances planifiées et réalisées.'
    },
    {
      faIcon: 'fa-wand-magic-sparkles',
      title: 'Plan IA en 1 clic',
      description: 'Appuie sur Générer pour créer un plan personnalisé basé sur ton niveau, tes objectifs et tes dispo.'
    },
    {
      faIcon: 'fa-circle-plus',
      title: 'Créer manuellement',
      description: 'Clique sur n\'importe quel jour du calendrier pour ajouter une séance de course ou de musculation.'
    },
    {
      faIcon: 'fa-chart-line',
      title: 'Suivi & ressenti',
      description: 'Après chaque séance, marque-la réalisée et note ton ressenti (1-10) pour affiner tes futurs plans.'
    }
  ];

  currentDate = new Date();
  currentMonth = signal(this.currentDate.getMonth() + 1);
  currentYear = signal(this.currentDate.getFullYear());

  calendarDays = signal<CalendarDay[]>([]);
  isLoading = signal(true);
  isGenerating = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  hasCoach = signal(false);

  selectedDay = signal<CalendarDay | null>(null);
  isAddingSession = signal(false);
  isSaving = signal(false);

  @ViewChild('dayPagesViewport') dayPagesViewport?: ElementRef<HTMLElement>;
  isDragging = signal(false);
  isResetting = signal(false);
  dragOffsetPx = signal(0);
  showSwipeHints = signal(false);
  private touchStartX = 0;
  private touchStartY = 0;
  private touchTrackingActive = false;
  private dragLocked = false;
  private wasSwipe = false;
  private viewportWidth = 0;
  private commitTimeout?: any;
  private swipeHintsTimeout?: any;

  previousDay = computed<CalendarDay | null>(() => {
    const day = this.selectedDay();
    if (!day) return null;
    const target = new Date(day.date);
    target.setDate(target.getDate() - 1);
    return this.findOrPlaceholder(target);
  });

  nextDay = computed<CalendarDay | null>(() => {
    const day = this.selectedDay();
    if (!day) return null;
    const target = new Date(day.date);
    target.setDate(target.getDate() + 1);
    return this.findOrPlaceholder(target);
  });

  private findOrPlaceholder(date: Date): CalendarDay {
    const key = this.dateKey(date);
    const found = this.calendarDays().find(d => this.dateKey(d.date) === key);
    if (found) return found;
    const todayKey = this.dateKey(new Date());
    return {
      date,
      dayOfMonth: date.getDate(),
      isCurrentMonth: false,
      isToday: key === todayKey,
      runs: [],
      plannedRuns: [],
      strengthSessions: []
    };
  }

  getVisiblePlannedRuns(day: CalendarDay): PlannedSession[] {
    return day.plannedRuns.filter(p => !(p as any).linkedRun && !(p as any).linkedStrengthSession);
  }

  // Preview modal
  showPreview = signal(false);
  previewSessions = signal<Partial<PlannedSession>[]>([]);
  isConfirming = signal(false);

  // Modal feeling
  feelingModal = signal<{ open: boolean; session: PlannedSession | null; value: number }>({
    open: false, session: null, value: 5
  });

  // Delete confirm
  sessionToDelete = signal<PlannedSession | null>(null);
  runToDelete = signal<Run | null>(null);
  strengthSessionToDelete = signal<StrengthSession | null>(null);

  // Generate options
  showGenerateOptions = signal(false);
  showOverwriteConfirm = signal(false);
  overwriteConflictCount = signal(0);
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

  private subscriptionService = inject(SubscriptionService);

  constructor(
    private planningService: PlanningService,
    private runService: RunService,
    private strengthService: StrengthService,
    private athleteService: AthleteService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  private pendingOpenDay: string | null = null;

  openRunDetail(run: Run) {
    if (run._id) {
      this.router.navigate(['/run', run._id]);
    }
  }

  openStrengthDetail(session: { _id?: string }) {
    if (session._id) {
      this.router.navigate(['/strength/log'], { queryParams: { sessionId: session._id } });
    }
  }

  openPlannedDetail(planned: PlannedSession) {
    if (planned.status === 'skipped' || !planned._id) return;

    // Si la planned a déjà été liée à un Run/StrengthSession réel, ouvrir le détail correspondant
    const linkedRun = (planned as any).linkedRun;
    if (linkedRun) {
      const id = typeof linkedRun === 'string' ? linkedRun : linkedRun._id;
      if (id) {
        this.router.navigate(['/run', id]);
        return;
      }
    }
    const linkedStrength = (planned as any).linkedStrengthSession;
    if (linkedStrength) {
      const id = typeof linkedStrength === 'string' ? linkedStrength : linkedStrength._id;
      if (id) {
        this.router.navigate(['/strength/log'], { queryParams: { sessionId: id } });
        return;
      }
    }

    // Planned ou completed standalone : envoyer sur la page de complétion
    if (planned.activityType === 'strength') {
      this.router.navigate(['/strength/log'], { queryParams: { plannedId: planned._id } });
    } else {
      this.router.navigate(['/run', planned._id], { queryParams: { planned: 1 } });
    }
  }

  ngOnInit() {
    const openDay = this.route.snapshot.queryParamMap.get('openDay');
    if (openDay) {
      const [y, m] = openDay.split('-').map(Number);
      if (y && m) {
        this.currentMonth.set(m);
        this.currentYear.set(y);
      }
      this.pendingOpenDay = openDay;
    }
    this.loadCalendar();
    this.athleteService.getCurrentCoach().subscribe({
      next: (coach) => this.hasCoach.set(!!coach),
      error: () => this.hasCoach.set(false)
    });
  }

  loadCalendar() {
    this.isLoading.set(true);
    this.error.set(null);

    this.planningService.getCalendarData(this.currentMonth(), this.currentYear()).subscribe({
      next: (data) => {
        this.buildCalendar(data);
        this.isLoading.set(false);
        if (this.pendingOpenDay) {
          const target = this.pendingOpenDay;
          this.pendingOpenDay = null;
          const day = this.calendarDays().find(d => this.dateKey(d.date) === target);
          if (day) this.selectDay(day);
        }
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
    this.isAddingSession.set(false);
    const wasOpen = !!this.selectedDay();
    this.selectedDay.set(day);
    // Affiche les chevrons hint uniquement à l'ouverture initiale,
    // pas quand on navigue de jour en jour via swipe.
    if (!wasOpen) {
      this.flashSwipeHints();
    }
  }

  closeDetail() {
    this.isAddingSession.set(false);
    this.selectedDay.set(null);
    if (this.swipeHintsTimeout) {
      clearTimeout(this.swipeHintsTimeout);
      this.swipeHintsTimeout = undefined;
    }
    this.showSwipeHints.set(false);
  }

  private flashSwipeHints() {
    if (this.swipeHintsTimeout) clearTimeout(this.swipeHintsTimeout);
    this.showSwipeHints.set(true);
    this.swipeHintsTimeout = setTimeout(() => this.showSwipeHints.set(false), 2500);
  }

  onOverlayTouchStart(event: TouchEvent) {
    if (this.isAddingSession()) return;
    if (this.commitTimeout) {
      clearTimeout(this.commitTimeout);
      this.commitTimeout = undefined;
    }
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchTrackingActive = true;
    this.dragLocked = false;
    this.wasSwipe = false;
    this.viewportWidth = this.dayPagesViewport?.nativeElement.offsetWidth ?? window.innerWidth;
  }

  onOverlayTouchMove(event: TouchEvent) {
    if (!this.touchTrackingActive) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;

    if (!this.dragLocked) {
      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        this.touchTrackingActive = false;
        return;
      }
      this.dragLocked = true;
      this.isDragging.set(true);
    }

    this.dragOffsetPx.set(deltaX);
  }

  onOverlayTouchEnd(event: TouchEvent) {
    if (!this.touchTrackingActive) return;
    this.touchTrackingActive = false;

    if (!this.dragLocked) return;

    this.wasSwipe = true;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const threshold = Math.max(60, this.viewportWidth * 0.25);

    if (Math.abs(deltaX) > threshold) {
      this.commitSlide(deltaX < 0 ? 1 : -1);
    } else {
      this.snapBack();
    }
  }

  onOverlayClick() {
    if (this.wasSwipe) {
      this.wasSwipe = false;
      return;
    }
    this.closeDetail();
  }

  private snapBack() {
    this.isDragging.set(false);
    this.dragOffsetPx.set(0);
  }

  private commitSlide(direction: 1 | -1) {
    this.isDragging.set(false);
    this.dragOffsetPx.set(direction === 1 ? -this.viewportWidth : this.viewportWidth);

    this.commitTimeout = setTimeout(() => {
      this.isResetting.set(true);
      this.dragOffsetPx.set(0);
      this.navigateDay(direction);
      this.scrollActiveDayToTop();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.isResetting.set(false));
      });
    }, 280);
  }

  private scrollActiveDayToTop() {
    const viewport = this.dayPagesViewport?.nativeElement;
    if (!viewport) return;
    const body = viewport.querySelector('.day-modal-slot.active .day-page-body') as HTMLElement | null;
    if (body) body.scrollTop = 0;
  }

  private navigateDay(offset: number) {
    const current = this.selectedDay();
    if (!current) return;

    const newDate = new Date(current.date);
    newDate.setDate(newDate.getDate() + offset);
    newDate.setHours(12, 0, 0, 0);
    const newDateStr = this.dateKey(newDate);

    const found = this.calendarDays().find(d => this.dateKey(d.date) === newDateStr);
    if (found) {
      this.selectedDay.set(found);
      return;
    }

    this.selectedDay.set(this.findOrPlaceholder(newDate));

    const targetMonth = newDate.getMonth() + 1;
    const targetYear = newDate.getFullYear();
    this.currentMonth.set(targetMonth);
    this.currentYear.set(targetYear);

    this.isLoading.set(true);
    this.error.set(null);
    this.planningService.getCalendarData(targetMonth, targetYear).subscribe({
      next: (data) => {
        this.buildCalendar(data);
        this.isLoading.set(false);
        const refreshed = this.calendarDays().find(d => this.dateKey(d.date) === newDateStr);
        if (refreshed) {
          this.selectedDay.set(refreshed);
        }
      },
      error: (err) => {
        this.error.set('Erreur lors du chargement du calendrier');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }

  private dateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

  private getSelectedDates(): string[] {
    const start = new Date(this.generateStartDate + 'T12:00:00');
    return this.generateDays
      .filter(d => d.running || d.strength)
      .map(d => {
        const date = new Date(start);
        date.setDate(start.getDate() + d.dayIndex);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      });
  }

  private countConflicts(dates: string[]): number {
    return this.calendarDays().filter(day => {
      const dayStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`;
      return dates.includes(dayStr) && day.plannedRuns.some(p => p.status === 'planned');
    }).length;
  }

  generatePlan(weeks: number = 1, forceOverwrite: boolean = false) {
    const dayConfig = this.generateDays
      .filter(d => d.running || d.strength)
      .map(d => ({
        dayIndex: d.dayIndex,
        running: d.running,
        strength: d.strength
      }));

    if (!forceOverwrite) {
      const conflicts = this.countConflicts(this.getSelectedDates());
      if (conflicts > 0) {
        this.overwriteConflictCount.set(conflicts);
        this.showOverwriteConfirm.set(true);
        this.showGenerateOptions.set(false);
        return;
      }
    }

    this.isGenerating.set(true);
    this.error.set(null);
    this.successMessage.set(null);
    this.showGenerateOptions.set(false);
    this.showOverwriteConfirm.set(false);

    this.planningService.generatePlan(weeks, this.generateStartDate, dayConfig, forceOverwrite).subscribe({
      next: (response) => {
        this.isGenerating.set(false);
        this.previewSessions.set(response.sessions);
        this.showPreview.set(true);
      },
      error: (err) => {
        this.isGenerating.set(false);
        if (err.status === 402) {
          this.subscriptionService.openPaywall('generate');
        } else {
          this.error.set(err.error?.error || 'Erreur lors de la génération');
        }
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
    this.feelingModal.set({ open: true, session: plannedRun, value: plannedRun.feeling ?? 5 });
  }

  confirmFeelingAndComplete(feeling?: number) {
    const session = this.feelingModal().session;
    if (!session?._id) return;
    this.feelingModal.set({ open: false, session: null, value: 5 });

    this.planningService.updateStatus(session._id, 'completed', undefined, feeling).subscribe({
      next: () => {
        // Met à jour la modale du jour en place sans la fermer
        const day = this.selectedDay();
        if (day) {
          const updatedPlannedRuns = day.plannedRuns.map(p =>
            p._id === session._id ? { ...p, status: 'completed' as const, feeling } : p
          );
          this.selectedDay.set({ ...day, plannedRuns: updatedPlannedRuns });
        }
        this.loadCalendar();
      },
      error: (err) => console.error(err)
    });
  }

  closeFeelingModal() {
    this.feelingModal.set({ open: false, session: null, value: 5 });
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
    this.sessionToDelete.set(plannedRun);
  }

  confirmDeletePlannedSession() {
    const session = this.sessionToDelete();
    if (!session?._id) return;
    this.sessionToDelete.set(null);

    this.planningService.deletePlannedSession(session._id).subscribe({
      next: () => {
        this.loadCalendar();
        this.refreshSelectedDay();
      },
      error: (err) => console.error(err)
    });
  }

  deleteRun(run: Run) {
    this.runToDelete.set(run);
  }

  confirmDeleteRun() {
    const run = this.runToDelete();
    if (!run?._id) return;
    this.runToDelete.set(null);

    this.runService.deleteRun(run._id).subscribe({
      next: () => {
        this.loadCalendar();
        this.refreshSelectedDay();
      },
      error: (err) => console.error(err)
    });
  }

  deleteStrengthSession(session: StrengthSession) {
    this.strengthSessionToDelete.set(session);
  }

  confirmDeleteStrengthSession() {
    const session = this.strengthSessionToDelete();
    if (!session?._id) return;
    this.strengthSessionToDelete.set(null);

    this.strengthService.deleteSession(session._id).subscribe({
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

  goToDetailNewSession() {
    const day = this.selectedDay();
    if (!day) return;
    const isRunning = this.newSession.activityType === 'running';
    const detailRoute = isRunning ? 'running-detail' : 'muscu-detail';
    this.router.navigate(
      ['/planning', detailRoute, 'new'],
      {
        state: {
          draftSession: {
            date: day.date.toISOString(),
            sessionType: this.newSession.sessionType,
            description: this.newSession.description,
            activityType: this.newSession.activityType
          }
        }
      }
    );
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

    const completedCount = day.runs.length + (day.strengthSessions?.length ?? 0);
    if (completedCount > 0) {
      indicators.push({ type: 'completed', count: completedCount });
    }

    const allPlanned = day.plannedRuns.filter(p => p.status === 'planned');
    const plannedIA = allPlanned.filter(p => p.generatedBy === 'ai').length;
    const plannedAthlete = allPlanned.filter(p => p.generatedBy === 'manual').length;
    const plannedCoach = allPlanned.filter(p => p.generatedBy === 'coach').length;
    // Ne pas compter les planned déjà liées à un Run/StrengthSession : elles sont déjà comptées via completedCount
    const done = day.plannedRuns.filter(p =>
      p.status === 'completed' && !(p as any).linkedRun && !(p as any).linkedStrengthSession
    ).length;
    const skipped = day.plannedRuns.filter(p => p.status === 'skipped').length;

    if (plannedIA > 0) indicators.push({ type: 'planned-ia', count: plannedIA });
    if (plannedAthlete > 0) indicators.push({ type: 'planned-athlete', count: plannedAthlete });
    if (plannedCoach > 0) indicators.push({ type: 'planned-coach', count: plannedCoach });
    if (done > 0) indicators.push({ type: 'done', count: done });
    if (skipped > 0) indicators.push({ type: 'skipped', count: skipped });

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
      // Complétées = séances planifiées complétées + courses analysées + séances muscu
      completed += day.plannedRuns.filter(p => p.status === 'completed').length
        + day.runs.length
        + (day.strengthSessions?.length ?? 0);
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

  private paceToMinPerKm(pace?: string | null): number | null {
    if (!pace) return null;
    const m = /^(\d+):(\d{1,2})$/.exec(pace.trim());
    if (!m) return null;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    if (isNaN(min) || isNaN(sec) || sec >= 60) return null;
    return min + sec / 60;
  }

  private blockDistanceKm(block: RunBlock): number {
    const reps = Math.max(1, block.repetitions || 1);
    let main = 0;
    if (block.mode === 'distance') {
      main = (block.distance || 0) * reps;
    } else if (block.mode === 'duration' && block.pace) {
      const pace = this.paceToMinPerKm(block.pace);
      if (pace && pace > 0) main = ((block.duration || 0) / pace) * reps;
    }
    let recovery = 0;
    if (block.role === 'main' && block.recoveryMode) {
      if (block.recoveryMode === 'distance') {
        recovery = (block.recoveryDistance || 0) * reps;
      } else if (block.recoveryMode === 'duration' && block.recoveryPace) {
        const rp = this.paceToMinPerKm(block.recoveryPace);
        if (rp && rp > 0) recovery = ((block.recoveryDuration || 0) / rp) * reps;
      }
    }
    return main + recovery;
  }

  getRunDistance(run: Run): number {
    if (run.distance && run.distance > 0) return Math.round(run.distance * 100) / 100;
    const blocks = run.runBlocks;
    if (!blocks?.length) return 0;
    const total = blocks.reduce((acc, b) => acc + this.blockDistanceKm(b), 0);
    return Math.round(total * 100) / 100;
  }
}
