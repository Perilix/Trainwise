import { Component, OnInit, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CoachService } from '../../../services/coach.service';
import { AthleteDetail, CalendarData } from '../../../interfaces/coach.interfaces';
import { PlannedSession, SessionType, ActivityType, RunningSessionType } from '../../../services/planning.service';
import {
  StrengthSession,
  StrengthSessionType,
  SESSION_TYPE_LABELS as STRENGTH_SESSION_LABELS
} from '../../../interfaces/strength.interfaces';
import { Run, RunBlock } from '../../../services/run.service';
import { NavbarComponent } from '../../../components/navbar/navbar.component';

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
  selector: 'app-athlete-planning',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './athlete-planning.component.html',
  styleUrl: './athlete-planning.component.scss'
})
export class AthletePlanningComponent implements OnInit {
  athleteId = '';
  athlete = signal<AthleteDetail | null>(null);

  currentDate = new Date();
  currentMonth = signal(this.currentDate.getMonth() + 1);
  currentYear = signal(this.currentDate.getFullYear());

  calendarDays = signal<CalendarDay[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

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

  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  newSession = {
    activityType: 'running' as ActivityType,
    sessionType: 'endurance' as SessionType,
    targetDistance: null as number | null,
    targetDuration: null as number | null,
    targetPace: '',
    description: '',
    warmup: '',
    mainWorkout: '',
    cooldown: ''
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

  sessionToDuplicate = signal<PlannedSession | null>(null);
  selectedTargetDates = signal<Set<string>>(new Set<string>());
  isDuplicating = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private coachService: CoachService
  ) {}

  ngOnInit() {
    this.athleteId = this.route.snapshot.paramMap.get('id') || '';
    const openDay = this.route.snapshot.queryParamMap.get('openDay');
    if (openDay) {
      const [y, m] = openDay.split('-').map(Number);
      if (y && m) {
        this.currentMonth.set(m);
        this.currentYear.set(y);
      }
      this.pendingOpenDay = openDay;
    }
    if (this.athleteId) {
      this.loadData();
    }
  }

  private pendingOpenDay: string | null = null;

  loadData() {
    this.isLoading.set(true);
    this.error.set(null);

    // Charger l'athlète et le calendrier en parallèle
    Promise.all([
      this.coachService.getAthlete(this.athleteId).toPromise(),
      this.coachService.getAthleteCalendar(this.athleteId, this.currentMonth(), this.currentYear()).toPromise()
    ]).then(([athlete, calendar]) => {
      this.athlete.set(athlete || null);
      if (calendar) {
        this.buildCalendar(calendar);
      }
      this.isLoading.set(false);
      if (this.pendingOpenDay) {
        const target = this.pendingOpenDay;
        this.pendingOpenDay = null;
        const day = this.calendarDays().find(d => this.dateKey(d.date) === target);
        if (day) this.selectDay(day);
      }
    }).catch(err => {
      this.error.set('Erreur lors du chargement');
      this.isLoading.set(false);
      console.error(err);
    });
  }

  loadCalendar() {
    this.coachService.getAthleteCalendar(this.athleteId, this.currentMonth(), this.currentYear()).subscribe({
      next: (data) => {
        this.buildCalendar(data);
      },
      error: (err) => {
        this.error.set('Erreur lors du chargement du calendrier');
        console.error(err);
      }
    });
  }

  buildCalendar(data: CalendarData) {
    const year = this.currentYear();
    const month = this.currentMonth() - 1;

    const firstDay = new Date(year, month, 1);

    let startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - daysToSubtract);

    const days: CalendarDay[] = [];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      date.setHours(12, 0, 0, 0);

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
    if (this.sessionToDuplicate()) {
      this.toggleTargetDate(day);
      return;
    }
    const wasOpen = !!this.selectedDay();
    this.selectedDay.set(day);
    this.isAddingSession.set(false);
    if (!wasOpen) {
      this.flashSwipeHints();
    }
  }

  closeDetail() {
    this.selectedDay.set(null);
    this.isAddingSession.set(false);
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
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.isResetting.set(false));
      });
    }, 280);
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

    this.coachService.getAthleteCalendar(this.athleteId, targetMonth, targetYear).subscribe({
      next: (data) => {
        this.buildCalendar(data);
        const refreshed = this.calendarDays().find(d => this.dateKey(d.date) === newDateStr);
        if (refreshed) {
          this.selectedDay.set(refreshed);
        }
      },
      error: (err) => {
        this.error.set('Erreur lors du chargement du calendrier');
        console.error(err);
      }
    });
  }

  goBack() {
    this.router.navigate(['/coach/athletes', this.athleteId]);
  }

  goToToday() {
    const today = new Date();
    this.currentMonth.set(today.getMonth() + 1);
    this.currentYear.set(today.getFullYear());
    this.loadCalendar();
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
      description: '',
      warmup: '',
      mainWorkout: '',
      cooldown: ''
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
      targetDuration: this.newSession.targetDuration || undefined,
      description: this.newSession.description || undefined,
      status: 'planned'
    };

    if (this.newSession.activityType === 'running') {
      plannedRun.targetDistance = this.newSession.targetDistance || undefined;
      plannedRun.targetPace = this.newSession.targetPace || undefined;
      plannedRun.warmup = this.newSession.warmup || undefined;
      plannedRun.mainWorkout = this.newSession.mainWorkout || undefined;
      plannedRun.cooldown = this.newSession.cooldown || undefined;
    }

    this.coachService.createAthleteSession(this.athleteId, plannedRun).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isAddingSession.set(false);
        this.resetNewSession();
        this.successMessage.set('Séance créée avec succès');
        this.loadCalendar();
        this.refreshSelectedDay();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.error.set('Erreur lors de la création de la séance');
        console.error(err);
      }
    });
  }

  deleteSession(plannedRun: PlannedSession) {
    if (!plannedRun._id) return;
    if (!confirm('Supprimer cette séance ?')) return;

    this.coachService.deleteAthleteSession(this.athleteId, plannedRun._id).subscribe({
      next: () => {
        this.successMessage.set('Séance supprimée');
        this.loadCalendar();
        this.refreshSelectedDay();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err) => {
        this.error.set('Erreur lors de la suppression');
        console.error(err);
      }
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
    if (STRENGTH_SESSION_LABELS[type as StrengthSessionType]) {
      return STRENGTH_SESSION_LABELS[type as StrengthSessionType];
    }
    const found = this.runningSessionTypes.find(t => t.value === type);
    return found ? found.label : type;
  }

  getActivityIcon(activityType?: ActivityType): string {
    return activityType === 'strength' ? '💪' : '🏃';
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }

  getDayIndicators(day: CalendarDay): { type: string; count: number }[] {
    const indicators: { type: string; count: number }[] = [];

    const completedTotal = day.runs.length + day.strengthSessions.length;
    if (completedTotal > 0) {
      indicators.push({ type: 'completed', count: completedTotal });
    }

    const allPlanned = day.plannedRuns.filter(p => p.status === 'planned');
    const plannedIA = allPlanned.filter(p => p.generatedBy === 'ai').length;
    const plannedCoach = allPlanned.filter(p => p.generatedBy === 'coach').length;
    const done = day.plannedRuns.filter(p => p.status === 'completed').length;
    const skipped = day.plannedRuns.filter(p => p.status === 'skipped').length;

    if (plannedIA > 0) indicators.push({ type: 'planned-ia', count: plannedIA });
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

    days.filter(day => day.isCurrentMonth).forEach(day => {
      planned += day.plannedRuns.filter(p => p.status === 'planned').length;
      completed += day.plannedRuns.filter(p => p.status === 'completed').length + day.runs.length + day.strengthSessions.length;
      day.runs.forEach(run => {
        if (run.distance) {
          totalKm += run.distance;
        }
      });
    });

    return { planned, completed, totalKm: Math.round(totalKm * 10) / 10 };
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }

  isTrainingDay(date: Date): boolean {
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const days = this.athlete()?.availableDays;
    if (!days || days.length === 0) return false;
    return days.includes(dayNames[date.getDay()]);
  }

  shouldWarnNonTrainingDay(date: Date): boolean {
    const days = this.athlete()?.availableDays;
    if (!days || days.length === 0) return false;
    return !this.isTrainingDay(date);
  }

  isCoachSession(plannedRun: PlannedSession): boolean {
    return plannedRun.generatedBy === 'coach';
  }

  canDuplicateSession(plannedRun: PlannedSession): boolean {
    return plannedRun.status === 'planned';
  }

  startDuplication(plannedRun: PlannedSession) {
    this.sessionToDuplicate.set(plannedRun);
    this.selectedTargetDates.set(new Set<string>());
    this.selectedDay.set(null);
    this.isAddingSession.set(false);
  }

  cancelDuplication() {
    this.sessionToDuplicate.set(null);
    this.selectedTargetDates.set(new Set<string>());
  }

  toggleTargetDate(day: CalendarDay) {
    const key = this.dateKey(day.date);
    const current = new Set(this.selectedTargetDates());
    if (current.has(key)) {
      current.delete(key);
    } else {
      current.add(key);
    }
    this.selectedTargetDates.set(current);
  }

  isDateSelected(day: CalendarDay): boolean {
    return this.selectedTargetDates().has(this.dateKey(day.date));
  }

  isSourceDay(day: CalendarDay): boolean {
    const session = this.sessionToDuplicate();
    if (!session) return false;
    return this.dateKey(new Date(session.date)) === this.dateKey(day.date);
  }

  getTargetDatesCount(): number {
    return this.selectedTargetDates().size;
  }

  confirmDuplicate() {
    const session = this.sessionToDuplicate();
    const dateKeys = Array.from(this.selectedTargetDates());
    if (!session || !session._id || dateKeys.length === 0) return;

    this.isDuplicating.set(true);
    const planId = session._id;
    const calls = dateKeys.map(key => {
      const [y, m, d] = key.split('-').map(Number);
      const target = new Date(y, m - 1, d, 12, 0, 0, 0);
      return this.coachService.duplicateAthleteSession(this.athleteId, planId, target);
    });

    forkJoin(calls).subscribe({
      next: () => {
        this.isDuplicating.set(false);
        const count = dateKeys.length;
        this.cancelDuplication();
        this.successMessage.set(`${count} séance${count > 1 ? 's' : ''} dupliquée${count > 1 ? 's' : ''}`);
        this.loadCalendar();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err) => {
        this.isDuplicating.set(false);
        this.error.set('Erreur lors de la duplication');
        console.error(err);
      }
    });
  }

  getDuplicateSessionLabel(): string {
    const session = this.sessionToDuplicate();
    if (!session) return '';
    return `${this.getActivityIcon(session.activityType)} ${this.getSessionTypeLabel(session.sessionType)}`;
  }

  private dateKey(date: Date): string {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  goToMuscuDetail(plannedRun: PlannedSession) {
    this.router.navigate(['/coach/athletes', this.athleteId, 'muscu-detail', plannedRun._id]);
  }

  goToRunningDetail(plannedRun: PlannedSession) {
    this.router.navigate(['/coach/athletes', this.athleteId, 'running-detail', plannedRun._id]);
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

  getPlannedExerciseCount(planned: PlannedSession): number {
    return planned.strengthPlan?.exercises?.length ?? 0;
  }

  getPlannedTotalDistance(planned: PlannedSession): number {
    const blocks = planned.runBlocks || [];
    if (blocks.length === 0) return 0;
    const total = blocks.reduce((acc, b) => acc + this.blockDistanceKm(b as RunBlock), 0);
    return Math.round(total * 100) / 100;
  }

  goToDetailNewSession() {
    const day = this.selectedDay();
    if (!day) return;
    const isRunning = this.newSession.activityType === 'running';
    const detailRoute = isRunning ? 'running-detail' : 'muscu-detail';
    this.router.navigate(
      ['/coach/athletes', this.athleteId, detailRoute, 'new'],
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

  goToStrengthSessionDetail(strength: StrengthSession) {
    if (!strength._id) return;
    this.router.navigate(
      ['/coach/athletes', this.athleteId, 'muscu-detail', strength._id],
      { queryParams: { type: 'strength' } }
    );
  }

  goToRunDetail(run: any) {
    if (run._id) {
      this.router.navigate(['/coach/athletes', this.athleteId, 'run', run._id]);
    }
  }
}
