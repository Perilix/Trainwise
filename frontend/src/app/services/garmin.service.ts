import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GarminStatus {
  connected: boolean;
  displayName: string | null;
  connectedAt: Date | null;
}

export interface GarminConnectResponse {
  message: string;
  displayName: string;
}

export interface GarminSyncResult {
  message: string;
  imported: Array<{
    id: string;
    garminId: number;
    name: string;
    date: Date;
    distance: number;
  }>;
  skipped: number[];
}

@Injectable({
  providedIn: 'root'
})
export class GarminService {
  private apiUrl = `${environment.apiUrl}/garmin`;

  constructor(private http: HttpClient) {}

  getStatus(): Observable<GarminStatus> {
    return this.http.get<GarminStatus>(`${this.apiUrl}/status`);
  }

  connect(email: string, password: string): Observable<GarminConnectResponse> {
    return this.http.post<GarminConnectResponse>(`${this.apiUrl}/connect`, {
      email,
      password
    });
  }

  syncActivities(limit?: number): Observable<GarminSyncResult> {
    const params: any = {};
    if (limit) params.limit = limit;

    return this.http.post<GarminSyncResult>(`${this.apiUrl}/sync`, null, { params });
  }

  getUserStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stats`);
  }

  disconnect(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/disconnect`);
  }
}
