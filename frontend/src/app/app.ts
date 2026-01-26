import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChatFabComponent } from './components/chat-fab/chat-fab.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ChatFabComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
