import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { NotificationService } from '../../services/notification.service';
import { Notification } from '../../interfaces/notification.interface';
import { NavbarComponent } from '../../components/navbar/navbar.component';

/** Onglet de tri du centre de notifications. */
type Bucket = 'all' | 'unread' | 'session' | 'message' | 'subscription' | 'alert';

/** Un jour de notifications, pour les intertitres de la liste. */
interface NotificationDay {
  label: string;
  items: Notification[];
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent implements OnInit {
  isDesktop = signal(typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  isLoading = signal(true);
  bucket = signal<Bucket>('all');

  /** Chaque onglet et les types de notification qu'il regroupe. */
  readonly BUCKETS: { key: Bucket; label: string; icon: string; types?: Notification['type'][] }[] = [
    { key: 'all', label: 'Toutes', icon: 'fa-regular fa-bell' },
    { key: 'unread', label: 'Non lues', icon: 'fa-solid fa-check' },
    { key: 'session', label: 'Séances', icon: 'fa-regular fa-calendar', types: ['session'] },
    { key: 'message', label: 'Messages', icon: 'fa-regular fa-message', types: ['message'] },
    { key: 'subscription', label: 'Abonnements', icon: 'fa-solid fa-user-group', types: ['subscription_request', 'subscription', 'invitation', 'invitation_response'] },
    { key: 'alert', label: 'Alertes forme', icon: 'fa-solid fa-triangle-exclamation', types: ['athlete_alert', 'reengagement'] },
  ];

  constructor(public notificationService: NotificationService, private router: Router) {}

  ngOnInit() {
    if (typeof window !== 'undefined') {
      window.matchMedia('(min-width: 1024px)').addEventListener('change', event => this.isDesktop.set(event.matches));
    }
    this.notificationService.getNotifications(1, 50).subscribe({
      next: () => this.isLoading.set(false),
      error: () => this.isLoading.set(false)
    });
  }

  countFor(bucket: Bucket): number {
    return this.matching(bucket).length;
  }

  private matching(bucket: Bucket): Notification[] {
    const all = this.notificationService.notifications();
    if (bucket === 'all') return all;
    if (bucket === 'unread') return all.filter(n => !n.read);
    const types = this.BUCKETS.find(b => b.key === bucket)?.types ?? [];
    return all.filter(n => types.includes(n.type));
  }

  /** Les notifications de l'onglet courant, groupées par jour. */
  days = computed<NotificationDay[]>(() => {
    const items = this.matching(this.bucket());
    const groups = new Map<string, Notification[]>();
    for (const item of items) {
      const label = this.dayLabel(item.createdAt);
      const bucket = groups.get(label);
      if (bucket) bucket.push(item);
      else groups.set(label, [item]);
    }
    return [...groups.entries()].map(([label, items]) => ({ label, items }));
  });

  private dayLabel(date: Date | string): string {
    const day = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (day.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (day.toDateString() === yesterday.toDateString()) return 'Hier';
    return day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  time(date: Date | string): string {
    return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  initials(notification: Notification): string {
    const sender = notification.sender;
    if (!sender) return '';
    return `${sender.firstName[0] ?? ''}${sender.lastName[0] ?? ''}`.toUpperCase();
  }

  /** Pastille de type posée sur l'avatar. */
  badgeIcon(type: Notification['type']): string {
    switch (type) {
      case 'session': return 'fa-regular fa-calendar';
      case 'message': return 'fa-regular fa-message';
      case 'athlete_alert':
      case 'reengagement': return 'fa-solid fa-triangle-exclamation';
      case 'subscription_request':
      case 'subscription':
      case 'invitation':
      case 'invitation_response': return 'fa-solid fa-user-group';
      case 'competition': return 'fa-solid fa-flag-checkered';
      case 'achievement': return 'fa-solid fa-trophy';
      default: return 'fa-solid fa-check';
    }
  }

  /** Intitulé du bouton d'action, selon ce que la notification propose. */
  actionLabel(notification: Notification): string {
    switch (notification.type) {
      case 'message': return 'Répondre';
      case 'session': return 'Voir la séance';
      case 'athlete_alert':
      case 'reengagement': return "Voir l'athlète";
      case 'subscription_request': return 'Voir la demande';
      default: return 'Ouvrir';
    }
  }

  open(notification: Notification) {
    if (!notification.read) {
      this.notificationService.markAsRead(notification._id).subscribe({ error: () => {} });
    }
    if (notification.actionUrl) {
      this.router.navigateByUrl(notification.actionUrl);
    }
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead().subscribe({ error: () => {} });
  }

  remove(notification: Notification, event: Event) {
    event.stopPropagation();
    this.notificationService.deleteNotification(notification._id).subscribe({ error: () => {} });
  }
}
