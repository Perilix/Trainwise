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

export type PlannedSessionStatus = 'planned' | 'completed' | 'skipped';

export interface PlannedSession {
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
  status: PlannedSessionStatus;
  linkedRun?: Run;
  weekNumber?: number;
  generatedBy: 'ai' | 'manual' | 'coach';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CalendarData {
  runs: Run[];
  plannedRuns: PlannedSession[];
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
  sessions: PlannedSession[];
}

@Injectable({
  providedIn: 'root'
})
export class PlanningService {
  private apiUrl = `${environment.apiUrl}/api/planning`;

  constructor(private http: HttpClient) {}

  getPlannedSessions(params?: { startDate?: string; endDate?: string; status?: string }): Observable<PlannedSession[]> {
    return this.http.get<PlannedSession[]>(this.apiUrl, { params: params as any });
  }

  getPlannedSessionById(id: string): Observable<PlannedSession> {
    return this.http.get<PlannedSession>(`${this.apiUrl}/${id}`);
  }

  createPlannedSession(plannedRun: Partial<PlannedSession>): Observable<PlannedSession> {
    return this.http.post<PlannedSession>(this.apiUrl, plannedRun);
  }

  updatePlannedSession(id: string, updates: Partial<PlannedSession>): Observable<PlannedSession> {
    return this.http.patch<PlannedSession>(`${this.apiUrl}/${id}`, updates);
  }

  deletePlannedSession(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  updateStatus(id: string, status: PlannedSessionStatus, linkedRunId?: string): Observable<PlannedSession> {
    return this.http.patch<PlannedSession>(`${this.apiUrl}/${id}/status`, {
      status,
      linkedRunId
    });
  }

  generatePlan(
    weeks: number = 1,
    startDate?: string,
    dayConfig?: { dayIndex: number; running: boolean; strength: boolean }[]
  ): Observable<GeneratePlanResponse> {
    return this.http.post<GeneratePlanResponse>(`${this.apiUrl}/generate`, {
      weeks,
      startDate,
      dayConfig
    });
  }

  confirmPlan(sessions: Partial<PlannedSession>[]): Observable<GeneratePlanResponse> {
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
