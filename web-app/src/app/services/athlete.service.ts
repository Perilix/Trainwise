import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Coach, CoachInvitation } from '../interfaces/coach.interfaces';

@Injectable({
  providedIn: 'root'
})
export class AthleteService {
  private readonly API_URL = `${environment.apiUrl}/api/athlete`;

  constructor(private http: HttpClient) {}

  // Invitations
  getPendingInvitations(): Observable<CoachInvitation[]> {
    return this.http.get<CoachInvitation[]>(`${this.API_URL}/invitations`);
  }

  acceptInvitation(invitationId: string): Observable<CoachInvitation> {
    return this.http.post<CoachInvitation>(`${this.API_URL}/invitations/${invitationId}/accept`, {});
  }

  rejectInvitation(invitationId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/invitations/${invitationId}/reject`, {});
  }

  // Rejoindre via code
  joinViaCode(code: string): Observable<{ message: string; relationship: any }> {
    return this.http.post<{ message: string; relationship: any }>(`${this.API_URL}/join/${code}`, {});
  }

  // Coach actuel
  getCurrentCoach(): Observable<Coach | null> {
    return this.http.get<Coach | null>(`${this.API_URL}/coach`);
  }

  leaveCoach(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/coach`);
  }
}
