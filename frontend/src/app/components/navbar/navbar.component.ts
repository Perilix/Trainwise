import { Component, OnInit, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationDropdownComponent } from '../notification-dropdown/notification-dropdown.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, NotificationDropdownComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit {
  @ViewChildren(NotificationDropdownComponent) notificationDropdowns!: QueryList<NotificationDropdownComponent>;

  isMenuOpen = false;
  isMobileMenuOpen = false;

  constructor(
    public authService: AuthService,
    public chatService: ChatService,
    public notificationService: NotificationService
  ) {}

  ngOnInit() {
    // Load unread count on init
    if (this.authService.isAuthenticated()) {
      this.chatService.getUnreadCount().subscribe();
    }
  }

  getUserInitial(): string {
    const user = this.authService.currentUser();
    return user?.firstName?.charAt(0).toUpperCase() || '?';
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
  }

  openMobileNotifications() {
    this.closeMobileMenu();
    // Petit délai pour laisser le menu se fermer
    setTimeout(() => {
      // Prendre la deuxième instance (mobile)
      const dropdowns = this.notificationDropdowns.toArray();
      const mobileDropdown = dropdowns[1] || dropdowns[0];
      if (mobileDropdown) {
        mobileDropdown.isOpen.set(true);
        mobileDropdown.loadNotifications();
      }
    }, 150);
  }

  logout() {
    this.chatService.disconnect();
    this.notificationService.disconnect();
    this.authService.logout();
  }
}
