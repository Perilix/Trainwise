import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChatFabComponent } from './components/chat-fab/chat-fab.component';
import { BottomNavComponent } from './components/bottom-nav/bottom-nav.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ChatFabComponent, BottomNavComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  constructor(public authService: AuthService) {}
}
