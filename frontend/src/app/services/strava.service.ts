import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StravaStatus {
  connected: boolean;
  athleteId: number | null;
  connectedAt: Date | null;
}

export interface StravaAuthUrl {
  authUrl: string;
}

export interface StravaSyncResult {
  message: string;
  imported: Array<{
    id: string;
    stravaId: number;
    name: string;
    date: Date;
    distance: number;
  }>;
  skipped: number[];
}

@Injectable({
  providedIn: 'root'
})
export class StravaService {
  private apiUrl = 'http://localhost:3000/api/strava';

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
}
