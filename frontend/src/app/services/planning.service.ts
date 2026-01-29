import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Run } from './run.service';
import { environment } from '../../environments/environment';
import { StrengthSession, StrengthPlan, StrengthSessionType } from '../interfaces/strength.interfaces';

// Types d'activité
export type ActivityType = 'running' | 'strength';

// Types de séance running
export type RunningSessionType = 'endurance' | 'fractionne' | 'tempo' | 'recuperation' | 'sortie_longue' | 'cotes' | 'fartlek';

// Type de séance (running + strength combinés)
export type SessionType = RunningSessionType | StrengthSessionType;

export type PlannedRunStatus = 'planned' | 'completed' | 'skipped';

export interface PlannedRun {
  _id?: string;
  user: string;
  date: Date;
  activityType: ActivityType;
  sessionType: SessionType;
  // Champs running
  targetDistance?: number;
  targetDuration?: number;
  targetPace?: string;
  description?: string;
  warmup?: string;
  mainWorkout?: string;
  cooldown?: string;
  // Champs strength
  strengthPlan?: StrengthPlan;
  // Common
  status: PlannedRunStatus;
  linkedRun?: Run;
  weekNumber?: number;
  generatedBy: 'ai' | 'manual' | 'coach';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CalendarData {
  runs: Run[];
  plannedRuns: PlannedRun[];
  strengthSessions: StrengthSession[];
  month: number;
  year: number;
}

// Labels pour l'affichage des types de séance running
export const RUNNING_SESSION_LABELS: Record<RunningSessionType, string> = {
  endurance: 'Endurance',
  fractionne: 'Fractionné',
  tempo: 'Tempo',
  recuperation: 'Récupération',
  sortie_longue: 'Sortie longue',
  cotes: 'Côtes',
  fartlek: 'Fartlek'
};

export interface GeneratePlanResponse {
  message: string;
  sessions: PlannedRun[];
}

@Injectable({
  providedIn: 'root'
})
export class PlanningService {
  private apiUrl = `${environment.apiUrl}/api/planning`;

  constructor(private http: HttpClient) {}

  getPlannedRuns(params?: { startDate?: string; endDate?: string; status?: string }): Observable<PlannedRun[]> {
    return this.http.get<PlannedRun[]>(this.apiUrl, { params: params as any });
  }

  getPlannedRunById(id: string): Observable<PlannedRun> {
    return this.http.get<PlannedRun>(`${this.apiUrl}/${id}`);
  }

  createPlannedRun(plannedRun: Partial<PlannedRun>): Observable<PlannedRun> {
    return this.http.post<PlannedRun>(this.apiUrl, plannedRun);
  }

  updatePlannedRun(id: string, updates: Partial<PlannedRun>): Observable<PlannedRun> {
    return this.http.patch<PlannedRun>(`${this.apiUrl}/${id}`, updates);
  }

  deletePlannedRun(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  updateStatus(id: string, status: PlannedRunStatus, linkedRunId?: string): Observable<PlannedRun> {
    return this.http.patch<PlannedRun>(`${this.apiUrl}/${id}/status`, {
      status,
      linkedRunId
    });
  }

  generatePlan(weeks: number = 1, startDate?: string): Observable<GeneratePlanResponse> {
    return this.http.post<GeneratePlanResponse>(`${this.apiUrl}/generate`, { weeks, startDate });
  }

  confirmPlan(sessions: Partial<PlannedRun>[]): Observable<GeneratePlanResponse> {
    return this.http.post<GeneratePlanResponse>(`${this.apiUrl}/confirm`, { sessions });
  }

  getCalendarData(month: number, year: number): Observable<CalendarData> {
    return this.http.get<CalendarData>(`${this.apiUrl}/calendar`, {
      params: { month: month.toString(), year: year.toString() }
    });
  }

  getSessionTypeLabel(type: SessionType): string {
    const labels: Record<SessionType, string> = {
      // Running
      endurance: 'Endurance',
      fractionne: 'Fractionné',
      tempo: 'Tempo',
      recuperation: 'Récupération',
      sortie_longue: 'Sortie longue',
      cotes: 'Côtes',
      fartlek: 'Fartlek',
      // Strength
      upper_body: 'Haut du corps',
      lower_body: 'Bas du corps',
      full_body: 'Corps complet',
      push: 'Push (Poussée)',
      pull: 'Pull (Tirage)',
      legs: 'Jambes',
      core: 'Abdos / Core',
      hiit: 'HIIT',
      other: 'Autre'
    };
    return labels[type] || type;
  }
}
