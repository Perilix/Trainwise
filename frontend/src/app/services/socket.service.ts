import { Injectable, signal, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Subject, ReplaySubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;

  isConnected = signal(false);

  // Subjects pour les événements - utilise ReplaySubject pour ne pas perdre les événements
  private eventSubjects = new Map<string, Subject<any>>();

  // Liste des événements à écouter
  private readonly EVENTS = [
    'notification:new',
    'message:new',
    'conversation:new',
    'conversation:updated',
    'typing:start',
    'typing:stop',
    'message:read',
    'friend:request',
    'friend:response'
  ];

  constructor(private authService: AuthService) {
    // Pré-créer les subjects pour tous les événements
    this.EVENTS.forEach(event => {
      this.eventSubjects.set(event, new Subject<any>());
    });

    if (this.authService.isAuthenticated()) {
      this.connect();
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  connect(): void {
    const token = this.authService.getToken();
    if (!token || this.socket?.connected) return;

    this.socket = io(environment.socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      this.isConnected.set(true);
    });

    this.socket.on('disconnect', () => {
      this.isConnected.set(false);
    });

    this.socket.on('error', (error: { message: string }) => {
      console.error('[SocketService] Error:', error.message);
    });

    // Configurer les listeners pour chaque événement
    this.EVENTS.forEach(event => {
      this.socket!.on(event, (data: any) => {
        const subject = this.eventSubjects.get(event);
        if (subject) {
          subject.next(data);
        }
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected.set(false);
    }
  }

  // S'abonner à un événement
  on<T = any>(event: string): Subject<T> {
    if (!this.eventSubjects.has(event)) {
      this.eventSubjects.set(event, new Subject<T>());
      // Si le socket est déjà connecté, ajouter le listener
      if (this.socket) {
        this.socket.on(event, (data: any) => {
          this.eventSubjects.get(event)?.next(data);
        });
      }
    }
    return this.eventSubjects.get(event) as Subject<T>;
  }

  // Émettre un événement
  emit(event: string, data?: any): void {
    this.socket?.emit(event, data);
  }

  // Rejoindre une room
  joinRoom(room: string): void {
    this.socket?.emit('conversation:join', { conversationId: room });
  }

  // Quitter une room
  leaveRoom(room: string): void {
    this.socket?.emit('conversation:leave', { conversationId: room });
  }

  // Obtenir le socket (pour des cas spéciaux)
  getSocket(): Socket | null {
    return this.socket;
  }
}
