import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit {
  isMenuOpen = false;
  isMobileMenuOpen = false;

  constructor(
    public authService: AuthService,
    public chatService: ChatService
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

  logout() {
    this.chatService.disconnect();
    this.authService.logout();
  }
}
