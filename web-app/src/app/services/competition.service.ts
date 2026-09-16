import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export type CompetitionDiscipline =
  | '5km'
  | '10km'
  | 'semi_marathon'
  | 'marathon'
  | 'trail'
  | 'ultra'
  | 'hyrox'
  | 'crossfit'
  | 'obstacle_race'
  | 'cross_country'
  | 'piste'
  | 'autre';

export type CompetitionPriority = 'A' | 'B' | 'C';
export type CompetitionStatus = 'upcoming' | 'completed' | 'cancelled';

export interface CompetitionResult {
  finishTime?: string | null;
  position?: number | null;
  notes?: string;
  linkedRun?: string | null;
}

export interface Competition {
  _id?: string;
  user?: string;
  name: string;
  date: string; // ISO date
  discipline: CompetitionDiscipline;
  distance?: number | null;
  elevationGain?: number | null;
  targetTime?: string | null;
  priority: CompetitionPriority;
  location?: string;
  notes?: string;
  status: CompetitionStatus;
  result?: CompetitionResult;
  createdAt?: string;
  updatedAt?: string;
}

export type CompetitionInput = Omit<Competition, '_id' | 'user' | 'createdAt' | 'updatedAt'>;

export const DISCIPLINE_LABELS: Record<CompetitionDiscipline, string> = {
  '5km': '5 km',
  '10km': '10 km',
  semi_marathon: 'Semi-marathon',
  marathon: 'Marathon',
  trail: 'Trail',
  ultra: 'Ultra',
  hyrox: 'Hyrox',
  crossfit: 'CrossFit',
  obstacle_race: 'Course à obstacles',
  cross_country: 'Cross',
  piste: 'Piste',
  autre: 'Autre'
};

@Injectable({ providedIn: 'root' })
export class CompetitionService {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/api/competitions`;

  // Cache local pour les compétitions de l'utilisateur courant
  competitions = signal<Competition[]>([]);

  list(status?: CompetitionStatus): Observable<Competition[]> {
    const url = status ? `${this.API_URL}?status=${status}` : this.API_URL;
    return this.http.get<Competition[]>(url).pipe(
      tap(competitions => this.competitions.set(competitions))
    );
  }

  getById(id: string): Observable<Competition> {
    return this.http.get<Competition>(`${this.API_URL}/${id}`);
  }

  create(data: CompetitionInput): Observable<Competition> {
    return this.http.post<Competition>(this.API_URL, data).pipe(
      tap(c => this.competitions.update(list => [...list, c].sort((a, b) => a.date.localeCompare(b.date))))
    );
  }

  update(id: string, data: Partial<CompetitionInput>): Observable<Competition> {
    return this.http.patch<Competition>(`${this.API_URL}/${id}`, data).pipe(
      tap(updated => this.competitions.update(list => list.map(c => c._id === id ? updated : c)))
    );
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/${id}`).pipe(
      tap(() => this.competitions.update(list => list.filter(c => c._id !== id)))
    );
  }

  // Compétitions d'un athlète (pour le coach)
  listForAthlete(athleteId: string, status?: CompetitionStatus): Observable<Competition[]> {
    const base = `${environment.apiUrl}/api/coach/athletes/${athleteId}/competitions`;
    const url = status ? `${base}?status=${status}` : base;
    return this.http.get<Competition[]>(url);
  }
}
