import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import type { ApiUser, AuthResponse } from './api-types';
import { ApiService } from './api.service';

const TOKEN_KEY = 'trainwise.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  private readonly _user = signal<ApiUser | null>(null);
  private readonly _ready = signal(false);

  readonly user = this._user.asReadonly();
  /** Vrai une fois la session restaurée (ou constatée absente) : évite de rediriger trop tôt. */
  readonly ready = this._ready.asReadonly();
  readonly isCoach = computed(() => this._user()?.role === 'coach');
  readonly initials = computed(() => {
    const user = this._user();
    if (!user) return '';
    return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
  });
  readonly fullName = computed(() => {
    const user = this._user();
    return user ? `${user.firstName} ${user.lastName}`.trim() : '';
  });

  get token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  /** Restaure la session au démarrage de l'app. */
  restore(): Promise<void> {
    if (!this.token) {
      this._ready.set(true);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.api.get<ApiUser | { user: ApiUser }>('/api/auth/me').subscribe({
        next: (payload) => {
          this._user.set('user' in payload ? payload.user : payload);
          this._ready.set(true);
          resolve();
        },
        error: () => {
          this.clearToken();
          this._ready.set(true);
          resolve();
        },
      });
    });
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/api/auth/login', { email, password }).pipe(tap((res) => this.accept(res)));
  }

  /** Connexion ou inscription avec Google : le jeton vient de Google Identity Services. */
  googleSignIn(idToken: string) {
    return this.api.post<AuthResponse>('/api/auth/google', { idToken }).pipe(tap((res) => this.accept(res)));
  }

  register(body: { email: string; password: string; firstName: string; lastName: string; role: 'athlete' | 'coach' }) {
    return this.api.post<AuthResponse>('/api/auth/register', body).pipe(tap((res) => this.accept(res)));
  }

  forgotPassword(email: string) {
    return this.api.post<{ message?: string }>('/api/auth/forgot-password', { email });
  }

  updateProfile(patch: Partial<ApiUser>) {
    return this.api.patch<ApiUser | { user: ApiUser }>('/api/auth/profile', patch).pipe(
      tap((payload) => {
        const user = payload && 'user' in payload ? payload.user : (payload as ApiUser);
        if (user) this._user.set(user);
        this.api.invalidate();
      }),
    );
  }

  /** Changement d'adresse : le mot de passe actuel confirme que c'est bien le titulaire. */
  changeEmail(email: string, password: string) {
    return this.api.patch<{ email: string }>('/api/auth/email', { email, password }).pipe(
      tap(({ email: saved }) => {
        const user = this._user();
        if (user) this._user.set({ ...user, email: saved ?? email });
      }),
    );
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.api.patch('/api/auth/password', { currentPassword, newPassword });
  }

  /** Suppression définitive du compte (exigée par les stores). */
  deleteAccount() {
    return this.api.delete('/api/auth/account');
  }

  logout() {
    this.clearToken();
    this._user.set(null);
    this.api.invalidate();
    void this.router.navigate(['/connexion']);
  }

  /** Session invalidée côté serveur : on repart proprement sur l'écran de connexion. */
  onUnauthorized() {
    if (!this.token) return;
    this.clearToken();
    this._user.set(null);
    void this.router.navigate(['/connexion']);
  }

  private accept(res: AuthResponse) {
    try {
      localStorage.setItem(TOKEN_KEY, res.token);
    } catch {
      /* navigation privée : la session ne survivra pas au rechargement */
    }
    this._user.set(res.user);
    this.api.invalidate();
  }

  private clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* rien à nettoyer */
    }
  }
}
