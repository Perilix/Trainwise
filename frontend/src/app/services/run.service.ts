import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

  deleteRun(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  analyzeRun(id: string): Observable<Run> {
    return this.http.post<Run>(`${this.apiUrl}/${id}/analyze`, {});
  }
}
