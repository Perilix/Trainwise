import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { CoachService } from '../../services/coach.service';
import { AthleteDetail } from '../../interfaces/coach.interfaces';
import { PlannedSession } from '../../services/planning.service';
import { RunBlock } from '../../services/run.service';
import { WorkoutProfileComponent } from '../workout-profile/workout-profile.component';

/** Un jour de la semaine affichée, avec ce qui y est planifié. */
export interface RailDay {
  label: string;
  number: number;
  isToday: boolean;
  sessions: PlannedSession[];
}

/**
 * Contexte de l'athlète à côté d'une conversation (desktop) : son état de
 * forme, ses repères, et la semaine qu'on lui a planifiée — de quoi répondre
 * sans quitter le fil.
 */
@Component({
  selector: 'app-coach-athlete-rail',
  standalone: true,
  imports: [CommonModule, WorkoutProfileComponent],
  templateUrl: './coach-athlete-rail.component.html',
  styleUrl: './coach-athlete-rail.component.scss'
})
export class CoachAthleteRailComponent {
  athlete = signal<AthleteDetail | null>(null);
  days = signal<RailDay[]>([]);
  isLoading = signal(false);
  /** L'athlète n'est pas suivi par ce coach : le rail se tait. */
  unavailable = signal(false);

  private loadedId: string | null = null;

  @Input() set athleteId(id: string | null) {
    if (!id || id === this.loadedId) return;
    this.loadedId = id;
    this.load(id);
  }

  constructor(private coachService: CoachService, private router: Router) {}

  private load(id: string) {
    this.isLoading.set(true);
    this.unavailable.set(false);
    this.athlete.set(null);
    this.days.set([]);

    this.coachService.getAthlete(id).subscribe({
      next: athlete => {
        this.athlete.set(athlete);
        this.isLoading.set(false);
      },
      // 403/404 : l'interlocuteur n'est pas un athlète de ce coach.
      error: () => {
        this.unavailable.set(true);
        this.isLoading.set(false);
      }
    });

    const { monday, sunday } = this.weekBounds();
    this.coachService.getAthletePlanning(id, { startDate: this.iso(monday), endDate: this.iso(sunday) }).subscribe({
      next: sessions => this.days.set(this.spreadOverWeek(sessions ?? [], monday)),
      error: () => this.days.set(this.spreadOverWeek([], monday))
    });
  }

  /** Lundi et dimanche de la semaine en cours. */
  private weekBounds(): { monday: Date; sunday: Date } {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    // getDay() : 0 = dimanche, qu'on rattache à la semaine qui s'achève.
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { monday, sunday };
  }

  private iso(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private spreadOverWeek(sessions: PlannedSession[], monday: Date): RailDay[] {
    const today = new Date().toDateString();
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday);
      day.setDate(day.getDate() + index);
      return {
        label: day.toLocaleDateString('fr-FR', { weekday: 'short' }),
        number: day.getDate(),
        isToday: day.toDateString() === today,
        sessions: sessions.filter(session => new Date(session.date).toDateString() === day.toDateString())
      };
    });
  }

  weekRange(): string {
    const { monday, sunday } = this.weekBounds();
    const day = (date: Date) => date.getDate();
    const month = sunday.toLocaleDateString('fr-FR', { month: 'short' });
    return monday.getMonth() === sunday.getMonth()
      ? `${day(monday)} – ${day(sunday)} ${month}`
      : `${day(monday)} ${monday.toLocaleDateString('fr-FR', { month: 'short' })} – ${day(sunday)} ${month}`;
  }

  statusLabel(): string {
    const status = this.athlete()?.status;
    if (status === 'green') return 'En forme';
    if (status === 'orange') return 'Vigilance';
    return 'Alerte';
  }

  /** « J-21 » avant la prochaine course, ou null si elle est passée. */
  daysToRace(): number | null {
    const date = this.athlete()?.nextCompetition?.date;
    if (!date) return null;
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((target.getTime() - today.getTime()) / 86400000);
    return days >= 0 ? days : null;
  }

  sessionTitle(session: PlannedSession): string {
    if (session.title) return session.title;
    return session.activityType === 'strength' ? 'Musculation' : 'Séance';
  }

  /** Ligne de repères sous le titre : ce qui est renseigné, rien d'autre. */
  sessionMeta(session: PlannedSession): string {
    const parts: string[] = [];
    if (session.targetDuration) parts.push(`${session.targetDuration} min`);
    if (session.targetDistance) parts.push(`${this.fr(session.targetDistance)} km`);
    if (session.targetPace) parts.push(`${session.targetPace} /km`);
    const exercises = session.strengthPlan?.exercises?.length;
    if (exercises) parts.push(`${exercises} exercice${exercises > 1 ? 's' : ''}`);
    return parts.join(' · ');
  }

  blocksOf(session: PlannedSession): RunBlock[] {
    return (session.runBlocks as RunBlock[] | undefined) ?? [];
  }

  private fr(value: number): string {
    return value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  }

  openPlanning() {
    if (this.loadedId) this.router.navigate(['/coach/athletes', this.loadedId, 'planning']);
  }

  openSheet() {
    if (this.loadedId) this.router.navigate(['/coach/athletes', this.loadedId]);
  }
}
