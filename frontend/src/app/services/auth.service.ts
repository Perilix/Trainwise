import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { PushNotificationService } from './push-notification.service';


export type DayOfWeek = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche';
export type PreferredTime = 'matin' | 'midi' | 'soir' | 'flexible';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profilePicture?: string;
  role: 'user' | 'admin' | 'coach';
  coachInviteCode?: string;
  runningLevel?: 'debutant' | 'intermediaire' | 'confirme' | 'expert';
  goal?: 'remise_en_forme' | '5km' | '10km' | 'semi_marathon' | 'marathon' | 'trail' | 'ultra' | 'autre';
  goalDetails?: string;
  weeklyFrequency?: number;
  injuries?: string;
  availableDays?: DayOfWeek[];
  preferredTime?: PreferredTime;
  age?: number;
  gender?: 'homme' | 'femme' | 'autre';
  disciplines?: string[];
  experience?: number;
  diplomas?: string[];
  bio?: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  runningLevel?: string;
  goal?: string;
  goalDetails?: string;
  weeklyFrequency?: number;
  injuries?: string;
  availableDays?: string[];
  preferredTime?: string;
  age?: number;
  gender?: string;
  disciplines?: string[];
  experience?: number | null;
  diplomas?: string[];
  bio?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/api/auth`;
  private readonly TOKEN_KEY = 'runiq_token';
  private readonly USER_KEY = 'runiq_user';

  currentUser = signal<User | null>(null);
  private pushNotificationService = inject(PushNotificationService);

  constructor(private http: HttpClient, private router: Router) {
    this.loadStoredUser();
  }

  private loadStoredUser(): void {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const userJson = localStorage.getItem(this.USER_KEY);
    if (token && userJson) {
      this.currentUser.set(JSON.parse(userJson));
    }
  }

  register(data: RegisterData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/register`, data)
      .pipe(tap(response => this.handleAuth(response)));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, { email, password })
      .pipe(tap(response => this.handleAuth(response)));
  }

  private handleAuth(response: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
    this.currentUser.set(response.user);

    // Initialiser les notifications push après le login
    this.pushNotificationService.initializePushNotifications().catch(err => {
      console.error('Failed to initialize push notifications:', err);
    });
  }

  async logout(): Promise<void> {
    // Supprimer les notifications push
    await this.pushNotificationService.unregister().catch(err => {
      console.error('Failed to unregister push notifications:', err);
    });

    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getUser(): User | null {
    return this.currentUser();
  }

  isCoach(): boolean {
    return this.currentUser()?.role === 'coach';
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === 'admin';
  }

  updateProfile(data: UpdateProfileData): Observable<User> {
    return this.http.patch<User>(`${this.API_URL}/profile`, data)
      .pipe(tap(user => {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.currentUser.set(user);
      }));
  }

  uploadAvatar(file: File): Observable<User> {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.http.post<User>(`${this.API_URL}/avatar`, formData)
      .pipe(tap(user => {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.currentUser.set(user);
      }));
  }

  deleteAvatar(): Observable<User> {
    return this.http.delete<User>(`${this.API_URL}/avatar`)
      .pipe(tap(user => {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.currentUser.set(user);
      }));
  }
}
