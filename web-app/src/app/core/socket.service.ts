import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { io, type Socket } from 'socket.io-client';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Connexion temps réel à l'API : messages, « écrit… » et accusés de lecture.
 * L'API considère l'utilisateur hors ligne dès qu'aucun socket n'est connecté.
 */
@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;

  readonly connected = signal(false);

  /** Ouvre la connexion si elle ne l'est pas déjà. */
  connect(): Socket | null {
    const token = this.auth.token;
    if (!token) return null;
    if (this.socket) return this.socket;

    // En dev, le proxy Angular relaie /socket.io vers l'API : l'origine courante suffit.
    this.socket = io(environment.apiUrl || location.origin, { auth: { token }, transports: ['websocket'] });
    this.socket.on('connect', () => this.connected.set(true));
    this.socket.on('disconnect', () => this.connected.set(false));
    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }

  emit(event: string, payload: unknown) {
    this.connect()?.emit(event, payload);
  }

  /** Écoute un événement tant que le composant appelant est vivant. */
  on<T>(event: string, handler: (payload: T) => void) {
    const socket = this.connect();
    if (!socket) return;
    socket.on(event, handler as (...args: unknown[]) => void);
    inject(DestroyRef).onDestroy(() => socket.off(event, handler as (...args: unknown[]) => void));
  }
}
