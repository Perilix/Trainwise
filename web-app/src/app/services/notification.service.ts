import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';
import { environment } from '../../environments/environment';
import { Notification, NotificationsResponse } from '../interfaces/notification.interface';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly API_URL = `${environment.apiUrl}/api/notifications`;

  // Signals
  notifications = signal<Notification[]>([]);
  unreadCount = signal(0);

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private socketService: SocketService
  ) {
    if (this.authService.isAuthenticated()) {
      this.setupSocketListeners();
      this.loadUnreadCount();
    }
  }

  private setupSocketListeners(): void {
    // Écouter les nouvelles notifications
    this.socketService.on<Notification>('notification:new').subscribe(notification => {
      this.handleNewNotification(notification);
    });
  }

  // Pour la compatibilité avec la navbar
  disconnect(): void {
    // Géré par SocketService maintenant
  }

  private handleNewNotification(notification: Notification): void {
    // Ajouter en début de liste
    this.notifications.update(list => [notification, ...list]);
    // Incrémenter le compteur
    this.unreadCount.update(count => count + 1);
  }

  // API Calls
  loadUnreadCount(): void {
    this.http.get<{ count: number }>(`${this.API_URL}/unread-count`).subscribe({
      next: (response) => {
        this.unreadCount.set(response.count);
      },
      error: (err) => console.error('Erreur chargement unread count:', err)
    });
  }

  getNotifications(page: number = 1, limit: number = 20): Observable<NotificationsResponse> {
    return this.http.get<NotificationsResponse>(`${this.API_URL}`, {
      params: { page: page.toString(), limit: limit.toString() }
    }).pipe(
      tap(response => {
        if (page === 1) {
          this.notifications.set(response.notifications);
        } else {
          this.notifications.update(list => [...list, ...response.notifications]);
        }
      })
    );
  }

  markAsRead(notificationId: string): Observable<Notification> {
    return this.http.patch<Notification>(`${this.API_URL}/${notificationId}/read`, {}).pipe(
      tap(() => {
        // Mettre à jour la notification dans la liste
        this.notifications.update(list =>
          list.map(n => n._id === notificationId ? { ...n, read: true, readAt: new Date() } : n)
        );
        // Décrémenter le compteur
        this.unreadCount.update(count => Math.max(0, count - 1));
      })
    );
  }

  markAllAsRead(): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.API_URL}/read-all`, {}).pipe(
      tap(() => {
        // Marquer toutes comme lues
        this.notifications.update(list =>
          list.map(n => ({ ...n, read: true, readAt: new Date() }))
        );
        this.unreadCount.set(0);
      })
    );
  }

  deleteNotification(notificationId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/${notificationId}`).pipe(
      tap(() => {
        const notification = this.notifications().find(n => n._id === notificationId);
        // Retirer de la liste
        this.notifications.update(list => list.filter(n => n._id !== notificationId));
        // Décrémenter si non lue
        if (notification && !notification.read) {
          this.unreadCount.update(count => Math.max(0, count - 1));
        }
      })
    );
  }
}
