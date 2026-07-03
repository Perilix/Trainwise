import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PlannedMatchSummary } from '../interfaces/planned-match.interface';

export interface StravaStatus {
  connected: boolean;
  athleteId: number | null;
  connectedAt: Date | null;
}

export interface StravaAuthUrl {
  authUrl: string;
}

export interface StravaImportedRun {
  id: string;
  stravaId: number;
  name: string;
  date: Date;
  distance?: number;
  duration?: number;
  sessionType?: string;
  pendingPlannedMatch?: PlannedMatchSummary | null;
}

export interface StravaImportedStrength {
  id: string;
  stravaId: number;
  name: string;
  date: Date;
  duration?: number;
  sessionType?: string;
  pendingPlannedMatch?: PlannedMatchSummary | null;
}

export interface StravaSyncResult {
  message: string;
  imported: StravaImportedRun[];
  importedStrength: StravaImportedStrength[];
  skipped: number[];
}

// Activités auto-importées par le webhook, en attente de relecture (popup dashboard)
export interface StravaPendingReview {
  runs: {
    id: string;
    date: Date;
    distance?: number;
    duration?: number;
    sessionType?: string;
    pendingPlannedMatch?: PlannedMatchSummary | null;
  }[];
  strength: {
    id: string;
    date: Date;
    duration?: number;
    sessionType?: string;
    pendingPlannedMatch?: PlannedMatchSummary | null;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class StravaService {
  private apiUrl = `${environment.apiUrl}/api/strava`;

  constructor(private http: HttpClient) {}

  getStatus(): Observable<StravaStatus> {
    return this.http.get<StravaStatus>(`${this.apiUrl}/status`);
  }

  getAuthUrl(): Observable<StravaAuthUrl> {
    return this.http.get<StravaAuthUrl>(`${this.apiUrl}/auth-url`);
  }

  syncActivities(options?: { after?: string; before?: string; limit?: number }): Observable<StravaSyncResult> {
    const params: any = {};
    if (options?.after) params.after = options.after;
    if (options?.before) params.before = options.before;
    if (options?.limit) params.limit = options.limit;

    return this.http.post<StravaSyncResult>(`${this.apiUrl}/sync`, null, { params });
  }

  resyncActivities(): Observable<{ message: string; updated: number; errors: number }> {
    return this.http.post<{ message: string; updated: number; errors: number }>(`${this.apiUrl}/resync`, null);
  }

  disconnect(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/disconnect`);
  }

  getPendingReview(): Observable<StravaPendingReview> {
    return this.http.get<StravaPendingReview>(`${this.apiUrl}/pending-review`);
  }

  clearPendingReview(runIds: string[], strengthIds: string[]): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/pending-review/clear`, { runIds, strengthIds });
  }
}
