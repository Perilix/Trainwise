import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from './api.service';
import { AuthService } from './auth.service';

/** Compteurs affichés dans la barre latérale : notifications et messages. */
@Injectable({ providedIn: 'root' })
export class BadgesService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly unreadNotifications = signal(0);
  readonly unreadMessages = signal(0);

  refresh() {
    if (!this.auth.user()) return;
    this.api
      .getOr<{ count?: number } | number>('/api/notifications/unread-count', 0)
      .subscribe((value) => this.unreadNotifications.set(countOf(value)));
    this.api.getOr<{ count?: number } | number>('/api/chat/unread', 0).subscribe((value) => this.unreadMessages.set(countOf(value)));
  }

  markNotificationsRead() {
    this.unreadNotifications.set(0);
  }
}

function countOf(value: { count?: number } | number | null): number {
  if (typeof value === 'number') return value;
  return value?.count ?? 0;
}
