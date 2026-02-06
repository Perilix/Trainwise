import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Athlete,
  AthleteDetail,
  CoachStats,
  UserSearchResult,
  PendingInvitation,
  CalendarData
} from '../interfaces/coach.interfaces';
import { PlannedSession } from './planning.service';

@Injectable({
  providedIn: 'root'
})
export class CoachService {
  private readonly API_URL = `${environment.apiUrl}/api/coach`;

  constructor(private http: HttpClient) {}

  // Statistiques dashboard
  getStats(): Observable<CoachStats> {
    return this.http.get<CoachStats>(`${this.API_URL}/stats`);
  }

  // Gestion des athlètes
  getAthletes(): Observable<Athlete[]> {
    return this.http.get<Athlete[]>(`${this.API_URL}/athletes`);
  }

  getAthlete(athleteId: string): Observable<AthleteDetail> {
    return this.http.get<AthleteDetail>(`${this.API_URL}/athletes/${athleteId}`);
  }

  removeAthlete(athleteId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/athletes/${athleteId}`);
  }

  // Calendrier et planning des athlètes
  getAthleteCalendar(athleteId: string, month: number, year: number): Observable<CalendarData> {
    return this.http.get<CalendarData>(
      `${this.API_URL}/athletes/${athleteId}/calendar`,
      { params: { month: month.toString(), year: year.toString() } }
    );
  }

  getAthletePlanning(athleteId: string, params?: { startDate?: string; endDate?: string; status?: string }): Observable<PlannedSession[]> {
    return this.http.get<PlannedSession[]>(
      `${this.API_URL}/athletes/${athleteId}/planning`,
      { params: params as any }
    );
  }

  createAthleteSession(athleteId: string, session: Partial<PlannedSession>): Observable<PlannedSession> {
    return this.http.post<PlannedSession>(
      `${this.API_URL}/athletes/${athleteId}/planning`,
      session
    );
  }

  updateAthleteSession(athleteId: string, planId: string, updates: Partial<PlannedSession>): Observable<PlannedSession> {
    return this.http.patch<PlannedSession>(
      `${this.API_URL}/athletes/${athleteId}/planning/${planId}`,
      updates
    );
  }

  deleteAthleteSession(athleteId: string, planId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.API_URL}/athletes/${athleteId}/planning/${planId}`
    );
  }

  // Invitations
  getInviteCode(): Observable<{ code: string | null }> {
    return this.http.get<{ code: string | null }>(`${this.API_URL}/invite/code`);
  }

  generateInviteCode(): Observable<{ code: string }> {
    return this.http.post<{ code: string }>(`${this.API_URL}/invite/code`, {});
  }

  sendDirectInvite(athleteId: string, packageType: string): Observable<PendingInvitation> {
    return this.http.post<PendingInvitation>(`${this.API_URL}/invite/direct`, { athleteId, packageType });
  }

  getPendingInvitations(): Observable<PendingInvitation[]> {
    return this.http.get<PendingInvitation[]>(`${this.API_URL}/invitations/pending`);
  }

  // Recherche d'utilisateurs
  searchUsers(query: string): Observable<UserSearchResult[]> {
    return this.http.get<UserSearchResult[]>(`${this.API_URL}/users/search`, { params: { query } });
  }
}
