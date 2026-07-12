import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { FriendService } from '../../services/friend.service';
import { SocketService } from '../../services/socket.service';
import { CoachNavService } from '../../services/coach-nav.service';
import { NotificationDropdownComponent } from '../notification-dropdown/notification-dropdown.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, NotificationDropdownComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit {
  constructor(
    public authService: AuthService,
    public chatService: ChatService,
    public friendService: FriendService,
    public coachNav: CoachNavService,
    private socketService: SocketService
  ) {}

  ngOnInit() {
    this.coachNav.loadCurrentCoach();
  }

  getUserInitial(): string {
    const user = this.authService.currentUser();
    return user?.firstName?.charAt(0).toUpperCase() || '?';
  }

  logout() {
    this.socketService.disconnect();
    this.authService.logout();
  }
}
