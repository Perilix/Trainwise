import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { Subscription } from 'rxjs';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-chat-fab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-fab.component.html',
  styleUrls: ['./chat-fab.component.scss']
})
export class ChatFabComponent implements OnDestroy {
  isOnChatPage = signal(false);
  private routerSub: Subscription;

  constructor(
    public chatService: ChatService,
    public authService: AuthService,
    private router: Router
  ) {
    // Vérifier l'URL initiale
    this.checkUrl(this.router.url);

    // Écouter les changements de route
    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(event => {
      this.checkUrl((event as NavigationEnd).urlAfterRedirects);
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  private checkUrl(url: string): void {
    this.isOnChatPage.set(url.startsWith('/chat'));
  }

  openChat(): void {
    this.router.navigate(['/chat']);
  }
}
