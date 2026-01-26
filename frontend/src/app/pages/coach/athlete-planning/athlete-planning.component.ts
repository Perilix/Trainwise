import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CoachService } from '../../../services/coach.service';
import { AthleteDetail, CalendarData } from '../../../interfaces/coach.interfaces';
import { PlannedRun, SessionType } from '../../../services/planning.service';
import { Run } from '../../../services/run.service';
import { NavbarComponent } from '../../../components/navbar/navbar.component';

interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  runs: Run[];
  plannedRuns: PlannedRun[];
}

@Component({
  selector: 'app-athlete-planning',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent],
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

  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  newSession = {
    sessionType: 'endurance' as SessionType,
    targetDistance: null as number | null,
    targetDuration: null as number | null,
    targetPace: '',
    description: '',
    warmup: '',
    mainWorkout: '',
    cooldown: ''
  };

  sessionTypes: { value: SessionType; label: string }[] = [
    { value: 'endurance', label: 'Endurance' },
    { value: 'fractionne', label: 'Fractionné' },
    { value: 'tempo', label: 'Tempo' },
    { value: 'recuperation', label: 'Récupération' },
    { value: 'sortie_longue', label: 'Sortie longue' },
    { value: 'cotes', label: 'Côtes' },
    { value: 'fartlek', label: 'Fartlek' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private coachService: CoachService
  ) {}

  ngOnInit() {
    this.athleteId = this.route.snapshot.paramMap.get('id') || '';
    if (this.athleteId) {
      this.loadData();
    }
  }

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

      days.push({
        date,
        dayOfMonth: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: dateStr === todayStr,
        runs: dayRuns,
        plannedRuns: dayPlanned
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
    this.isAddingSession.set(false);
  }

  closeDetail() {
    this.selectedDay.set(null);
    this.isAddingSession.set(false);
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

  saveSession() {
    const day = this.selectedDay();
    if (!day) return;

    this.isSaving.set(true);

    const plannedRun: Partial<PlannedRun> = {
      date: day.date,
      sessionType: this.newSession.sessionType,
      targetDistance: this.newSession.targetDistance || undefined,
      targetDuration: this.newSession.targetDuration || undefined,
      targetPace: this.newSession.targetPace || undefined,
      description: this.newSession.description || undefined,
      warmup: this.newSession.warmup || undefined,
      mainWorkout: this.newSession.mainWorkout || undefined,
      cooldown: this.newSession.cooldown || undefined,
      status: 'planned'
    };

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

  deleteSession(plannedRun: PlannedRun) {
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
    const found = this.sessionTypes.find(t => t.value === type);
    return found ? found.label : type;
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

    if (day.runs.length > 0) {
      indicators.push({ type: 'completed', count: day.runs.length });
    }

    const planned = day.plannedRuns.filter(p => p.status === 'planned').length;
    const done = day.plannedRuns.filter(p => p.status === 'completed').length;
    const skipped = day.plannedRuns.filter(p => p.status === 'skipped').length;

    if (planned > 0) indicators.push({ type: 'planned', count: planned });
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
      completed += day.plannedRuns.filter(p => p.status === 'completed').length + day.runs.length;
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

  isCoachSession(plannedRun: PlannedRun): boolean {
    return plannedRun.generatedBy === 'coach';
  }
}
