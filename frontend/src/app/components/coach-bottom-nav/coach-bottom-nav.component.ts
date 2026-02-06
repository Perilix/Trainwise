import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-coach-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './coach-bottom-nav.component.html',
  styleUrl: './coach-bottom-nav.component.scss'
})
export class CoachBottomNavComponent {
  constructor(public chatService: ChatService) {}
}
