import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { FriendService } from '../../services/friend.service';
import { CoachNavService } from '../../services/coach-nav.service';
import { Coach } from '../../interfaces/coach.interfaces';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss'
})
export class BottomNavComponent implements OnInit {
  constructor(
    public chatService: ChatService,
    public friendService: FriendService,
    private coachNav: CoachNavService
  ) {}

  ngOnInit() {
    this.coachNav.loadCurrentCoach();
  }

  isLoadingCoach() {
    return this.coachNav.isLoadingCoach();
  }

  currentCoach(): Coach | null {
    return this.coachNav.currentCoach();
  }

  navigateToCoach() {
    this.coachNav.navigateToCoach();
  }

  isCoachPageActive(): boolean {
    return this.coachNav.isCoachPageActive();
  }

  getCoachUnreadCount(): number {
    return this.coachNav.getCoachUnreadCount();
  }
}
