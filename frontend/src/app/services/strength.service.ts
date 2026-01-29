import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StrengthSession, StrengthStats, StrengthSessionType } from '../interfaces/strength.interfaces';

export interface StrengthSessionFilters {
  startDate?: string;
  endDate?: string;
  sessionType?: StrengthSessionType;
  limit?: number;
  page?: number;
}

export interface StrengthSessionsResponse {
  sessions: StrengthSession[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface LabelValue {
  value: string;
  label: string;
}

@Injectable({
  providedIn: 'root'
})
export class StrengthService {
  private readonly API_URL = `${environment.apiUrl}/api/strength`;

  constructor(private http: HttpClient) {}

  // Créer une séance de muscu
  createSession(session: Partial<StrengthSession>): Observable<StrengthSession> {
    return this.http.post<StrengthSession>(`${this.API_URL}/sessions`, session);
  }

  // Lister ses séances
  getSessions(filters?: StrengthSessionFilters): Observable<StrengthSessionsResponse> {
    let params = new HttpParams();

    if (filters) {
      if (filters.startDate) params = params.set('startDate', filters.startDate);
      if (filters.endDate) params = params.set('endDate', filters.endDate);
      if (filters.sessionType) params = params.set('sessionType', filters.sessionType);
      if (filters.limit) params = params.set('limit', filters.limit.toString());
      if (filters.page) params = params.set('page', filters.page.toString());
    }

    return this.http.get<StrengthSessionsResponse>(`${this.API_URL}/sessions`, { params });
  }

  // Détail d'une séance
  getSession(id: string): Observable<StrengthSession> {
    return this.http.get<StrengthSession>(`${this.API_URL}/sessions/${id}`);
  }

  // Modifier une séance
  updateSession(id: string, data: Partial<StrengthSession>): Observable<StrengthSession> {
    return this.http.put<StrengthSession>(`${this.API_URL}/sessions/${id}`, data);
  }

  // Supprimer une séance
  deleteSession(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/sessions/${id}`);
  }

  // Stats de musculation
  getStats(period: 'week' | 'month' | 'year' = 'week'): Observable<StrengthStats> {
    return this.http.get<StrengthStats>(`${this.API_URL}/stats`, {
      params: { period }
    });
  }

  // Types de séances disponibles
  getSessionTypes(): Observable<LabelValue[]> {
    return this.http.get<LabelValue[]>(`${this.API_URL}/session-types`);
  }
}
