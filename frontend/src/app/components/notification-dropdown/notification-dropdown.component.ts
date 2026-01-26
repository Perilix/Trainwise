import { Component, OnInit, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { Notification } from '../../interfaces/notification.interface';

@Component({
  selector: 'app-notification-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-dropdown.component.html',
  styleUrls: ['./notification-dropdown.component.scss']
})
export class NotificationDropdownComponent implements OnInit {
  isOpen = signal(false);
  isLoading = signal(false);

  constructor(
    public notificationService: NotificationService,
    private router: Router,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    // Charger les notifications au démarrage
    this.loadNotifications();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  toggleDropdown(): void {
    this.isOpen.update(open => !open);
    if (this.isOpen()) {
      this.loadNotifications();
    }
  }

  loadNotifications(): void {
    this.isLoading.set(true);
    this.notificationService.getNotifications(1, 10).subscribe({
      next: () => {
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  onNotificationClick(notification: Notification): void {
    // Marquer comme lue
    if (!notification.read) {
      this.notificationService.markAsRead(notification._id).subscribe();
    }

    // Naviguer si actionUrl existe
    if (notification.actionUrl) {
      this.router.navigateByUrl(notification.actionUrl);
    }

    this.isOpen.set(false);
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe();
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const notifDate = new Date(date);
    const diffMs = now.getTime() - notifDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return notifDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'invitation':
        return 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75';
      case 'invitation_response':
        return 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3';
      case 'session':
        return 'M8 2v4M16 2v4M3 10h18M21 8v13H3V8M12 14h.01';
      default:
        return 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0';
    }
  }
}
