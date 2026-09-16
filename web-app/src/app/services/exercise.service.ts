import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Exercise, MuscleGroup, Equipment, Difficulty } from '../interfaces/strength.interfaces';

export interface ExerciseFilters {
  muscle?: MuscleGroup;
  equipment?: Equipment;
  difficulty?: Difficulty;
  search?: string;
  limit?: number;
}

export interface LabelValue {
  value: string;
  label: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExerciseService {
  private readonly API_URL = `${environment.apiUrl}/api/exercises`;

  constructor(private http: HttpClient) {}

  // Lister les exercices avec filtres
  getExercises(filters?: ExerciseFilters): Observable<Exercise[]> {
    let params = new HttpParams();

    if (filters) {
      if (filters.muscle) params = params.set('muscle', filters.muscle);
      if (filters.equipment) params = params.set('equipment', filters.equipment);
      if (filters.difficulty) params = params.set('difficulty', filters.difficulty);
      if (filters.search) params = params.set('search', filters.search);
      if (filters.limit) params = params.set('limit', filters.limit.toString());
    }

    return this.http.get<Exercise[]>(this.API_URL, { params });
  }

  // Détail d'un exercice
  getExercise(id: string): Observable<Exercise> {
    return this.http.get<Exercise>(`${this.API_URL}/${id}`);
  }

  // Créer un exercice (coach only)
  createExercise(exercise: Partial<Exercise>): Observable<Exercise> {
    return this.http.post<Exercise>(this.API_URL, exercise);
  }

  // Modifier un exercice (coach only)
  updateExercise(id: string, data: Partial<Exercise>): Observable<Exercise> {
    return this.http.put<Exercise>(`${this.API_URL}/${id}`, data);
  }

  // Supprimer un exercice (coach only)
  deleteExercise(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/${id}`);
  }

  // Récupérer les groupes musculaires disponibles
  getMuscleGroups(): Observable<LabelValue[]> {
    return this.http.get<LabelValue[]>(`${this.API_URL}/muscle-groups`);
  }

  // Récupérer les équipements disponibles
  getEquipment(): Observable<LabelValue[]> {
    return this.http.get<LabelValue[]>(`${this.API_URL}/equipment`);
  }

  // Upload image d'exercice (coach only)
  uploadImage(file: File): Observable<{ url: string; publicId: string }> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<{ url: string; publicId: string }>(`${this.API_URL}/upload-image`, formData);
  }
}
