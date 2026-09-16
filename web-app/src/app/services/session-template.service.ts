import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  SessionTemplate,
  Sport,
  PaceZone,
  AssignmentPreviewResponse,
  AssignmentEntry
} from '../interfaces/session-template.interfaces';

export interface TemplateFilters {
  sport?: Sport;
  scope?: 'mine' | 'public' | 'all';
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class SessionTemplateService {
  private readonly API_URL = `${environment.apiUrl}/api/coach/session-templates`;

  constructor(private http: HttpClient) {}

  list(filters?: TemplateFilters): Observable<SessionTemplate[]> {
    let params = new HttpParams();
    if (filters?.sport) params = params.set('sport', filters.sport);
    if (filters?.scope) params = params.set('scope', filters.scope);
    if (filters?.search) params = params.set('search', filters.search);
    return this.http.get<SessionTemplate[]>(this.API_URL, { params });
  }

  get(id: string): Observable<SessionTemplate> {
    return this.http.get<SessionTemplate>(`${this.API_URL}/${id}`);
  }

  create(data: Partial<SessionTemplate>): Observable<SessionTemplate> {
    return this.http.post<SessionTemplate>(this.API_URL, data);
  }

  update(id: string, data: Partial<SessionTemplate>): Observable<SessionTemplate> {
    return this.http.patch<SessionTemplate>(`${this.API_URL}/${id}`, data);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/${id}`);
  }

  getPaceZones(): Observable<PaceZone[]> {
    return this.http.get<PaceZone[]>(`${this.API_URL}/zones`);
  }

  preview(templateId: string, athleteIds: string[]): Observable<AssignmentPreviewResponse> {
    return this.http.post<AssignmentPreviewResponse>(
      `${this.API_URL}/${templateId}/preview`,
      { athleteIds }
    );
  }

  assign(templateId: string, assignments: AssignmentEntry[]): Observable<{ created: number; plannedRuns: any[] }> {
    return this.http.post<{ created: number; plannedRuns: any[] }>(
      `${this.API_URL}/${templateId}/assign`,
      { assignments }
    );
  }

  createFromPlanning(plannedRunId: string, name: string, description?: string): Observable<SessionTemplate> {
    return this.http.post<SessionTemplate>(
      `${this.API_URL}/from-planning/${plannedRunId}`,
      { name, description }
    );
  }
}
