import { Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { ChatFabComponent } from './components/chat-fab/chat-fab.component';
import { BottomNavComponent } from './components/bottom-nav/bottom-nav.component';
import { CoachBottomNavComponent } from './components/coach-bottom-nav/coach-bottom-nav.component';
import { CoachInvitationModalComponent } from './components/coach-invitation-modal/coach-invitation-modal.component';
import { AuthService } from './services/auth.service';
import { CoachInvitationModalService } from './services/coach-invitation-modal.service';
import { AthleteService } from './services/athlete.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ChatFabComponent, BottomNavComponent, CoachBottomNavComponent, CoachInvitationModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  authService = inject(AuthService);
  invitationModalService = inject(CoachInvitationModalService);
  private athleteService = inject(AthleteService);
  private router = inject(Router);

  private currentUrl = toSignal(this.router.events.pipe(
    map(() => this.router.url)
  ), { initialValue: this.router.url });

  // /chat = liste des conversations (avec bottom-nav)
  // /chat/:id = détail d'une conversation (sans bottom-nav, fond beige)
  isOnChatList = computed(() => this.currentUrl() === '/chat' || this.currentUrl().startsWith('/chat?'));
  isOnChatDetail = computed(() => this.currentUrl().startsWith('/chat/'));

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      const scrollEl = document.querySelector('.page-scroll');
      if (scrollEl) {
        scrollEl.scrollTo({ top: 0, behavior: 'instant' });
      }
    });

    this.initSafeAreas();
  }

  private initSafeAreas() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:0;width:0;height:env(safe-area-inset-bottom);pointer-events:none;visibility:hidden;';
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      const safeBottom = el.getBoundingClientRect().height;
      document.body.removeChild(el);

      let bottom = safeBottom;
      // env() retourne 0 sur certains WKWebView iOS — fallback 34px (iPhone X+)
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios' && safeBottom === 0) {
        bottom = 34;
      }
      document.documentElement.style.setProperty('--safe-bottom', `${bottom}px`);
    });
  }

  onAcceptInvitation() {
    const invitation = this.invitationModalService.invitation();
    if (invitation) {
      this.athleteService.acceptInvitation(invitation._id).subscribe({
        next: () => {
          this.invitationModalService.notifyAccepted(invitation._id);
          this.invitationModalService.close();
          // Recharger la page actuelle si on est sur le dashboard, sinon naviguer vers le dashboard
          if (this.router.url === '/dashboard') {
            window.location.reload();
          } else {
            this.router.navigate(['/dashboard']);
          }
        },
        error: (err) => {
          console.error('Error accepting invitation:', err);
        }
      });
    }
  }

  onRejectInvitation() {
    const invitation = this.invitationModalService.invitation();
    if (invitation) {
      this.athleteService.rejectInvitation(invitation._id).subscribe({
        next: () => {
          this.invitationModalService.notifyRejected(invitation._id);
          this.invitationModalService.close();
        },
        error: (err) => {
          console.error('Error rejecting invitation:', err);
        }
      });
    }
  }

  onCloseInvitationModal() {
    this.invitationModalService.close();
  }
}
