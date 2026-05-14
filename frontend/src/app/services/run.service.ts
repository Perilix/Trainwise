import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PlannedMatchSummary } from '../interfaces/planned-match.interface';

export type RunBlockRole = 'warmup' | 'main' | 'cooldown';
export type RunBlockMode = 'distance' | 'duration';

export interface RunBlockPaceSource {
  mode?: 'absolute' | 'vmaPercent' | 'zone' | null;
  zone?: string | null;
  vmaPercent?: number | null;
  resolvedFromVma?: number | null;
  overridden?: boolean;
}

export interface RunBlock {
  _id?: string;
  role: RunBlockRole;
  mode: RunBlockMode;
  distance?: number | null;
  duration?: number | null;
  pace?: string | null;
  repetitions?: number;
  description?: string;
  recoveryMode?: RunBlockMode | null;
  recoveryDistance?: number | null;
  recoveryDuration?: number | null;
  recoveryPace?: string | null;
  recoveryDescription?: string;
  notes?: string;
  order?: number;
  paceSource?: RunBlockPaceSource;
  recoveryPaceSource?: RunBlockPaceSource;
}

export interface PlannedSnapshot {
  sessionType?: string | null;
  targetDistance?: number | null;
  targetDuration?: number | null;
  targetPace?: string | null;
  description?: string | null;
  runBlocks?: RunBlock[];
  coach?: string | null;
}

export interface Run {
  _id?: string;
  date: Date;
  distance?: number;
  duration?: number;
  averagePace?: string;
  averageHeartRate?: number;
  maxHeartRate?: number;
  averageCadence?: number;
  elevationGain?: number;
  sessionType?: string;
  feeling?: number;
  notes?: string;
  analysis?: string;
  analyzedAt?: Date;
  stravaActivityId?: number;
  polyline?: string;
  startLatLng?: number[];
  endLatLng?: number[];
  runBlocks?: RunBlock[];
  plannedSnapshot?: PlannedSnapshot;
  pendingPlannedMatch?: PlannedMatchSummary | string | null;
  matchDismissed?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RunService {
  private apiUrl = `${environment.apiUrl}/api/runs`;

  constructor(private http: HttpClient) {}

  createRun(run: Partial<Run>): Observable<Run> {
    return this.http.post<Run>(this.apiUrl, run);
  }

  getAllRuns(): Observable<Run[]> {
    return this.http.get<Run[]>(this.apiUrl);
  }

  getRunById(id: string): Observable<Run> {
    return this.http.get<Run>(`${this.apiUrl}/${id}`);
  }

  updateRun(id: string, data: Partial<Run>): Observable<Run> {
    return this.http.patch<Run>(`${this.apiUrl}/${id}`, data);
  }

  deleteRun(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  analyzeRun(id: string): Observable<Run> {
    return this.http.post<Run>(`${this.apiUrl}/${id}/analyze`, {});
  }

  // ── Mapping séance Strava ⇄ séance planifiée ──────────────────
  getMatchCandidates(runId: string): Observable<PlannedMatchSummary[]> {
    return this.http.get<PlannedMatchSummary[]>(`${this.apiUrl}/${runId}/match/candidates`);
  }

  confirmMatch(runId: string): Observable<Run> {
    return this.http.post<Run>(`${this.apiUrl}/${runId}/match/confirm`, {});
  }

  dismissMatch(runId: string): Observable<Run> {
    return this.http.post<Run>(`${this.apiUrl}/${runId}/match/dismiss`, {});
  }

  linkToPlanned(runId: string, plannedId: string): Observable<Run> {
    return this.http.post<Run>(`${this.apiUrl}/${runId}/match/link/${plannedId}`, {});
  }
}
