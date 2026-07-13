import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { BottomNavComponent } from './components/bottom-nav/bottom-nav.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { CoachBottomNavComponent } from './components/coach-bottom-nav/coach-bottom-nav.component';
import { CoachInvitationModalComponent } from './components/coach-invitation-modal/coach-invitation-modal.component';
import { OnboardingComponent } from './components/onboarding/onboarding.component';
import { PaywallComponent } from './components/paywall/paywall.component';
import { AuthService } from './services/auth.service';
import { CoachInvitationModalService } from './services/coach-invitation-modal.service';
import { OnboardingService } from './services/onboarding.service';
import { SubscriptionService } from './services/subscription.service';
import { AthleteService } from './services/athlete.service';
import { PushNotificationService } from './services/push-notification.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SidebarComponent, BottomNavComponent, CoachBottomNavComponent, CoachInvitationModalComponent, OnboardingComponent, PaywallComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  authService = inject(AuthService);
  invitationModalService = inject(CoachInvitationModalService);
  onboardingService = inject(OnboardingService);
  subscriptionService = inject(SubscriptionService);
  private athleteService = inject(AthleteService);
  private router = inject(Router);
  private pushNotificationService = inject(PushNotificationService);

  isKeyboardOpen = signal(false);

  private currentUrl = toSignal(this.router.events.pipe(
    map(() => this.router.url)
  ), { initialValue: this.router.url });

  // /chat = liste des conversations (avec bottom-nav)
  // /chat/:id = détail d'une conversation (sans bottom-nav, fond beige)
  isOnChatList = computed(() => this.currentUrl() === '/chat' || this.currentUrl().startsWith('/chat?'));
  isOnChatDetail = computed(() => this.currentUrl().startsWith('/chat/'));
  isOnBetaFeedback = computed(() => this.currentUrl().startsWith('/beta/feedback'));

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
    this.setupKeyboardAdjustment();
    this.setupBadgeClearing();

    // Initialiser les services natifs quand l'utilisateur se connecte
    let revenueCatInitialized = false;
    effect(() => {
      const user = this.authService.currentUser();
      if (user && !revenueCatInitialized) {
        revenueCatInitialized = true;
        this.pushNotificationService.initializePushNotifications().catch(() => {});
        this.subscriptionService.initRevenueCat(user.id);
        if (!Capacitor.isNativePlatform()) {
          // Sur web, pas de RevenueCat : rafraîchir l'état d'abonnement/coins depuis le backend
          this.subscriptionService.refreshStatus();
        }
      }
      if (!user) {
        revenueCatInitialized = false;
      }
    });
  }

  // Effacer le badge de l'icône à l'ouverture et à chaque retour au premier plan
  private setupBadgeClearing() {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    this.pushNotificationService.clearBadge();
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        this.pushNotificationService.clearBadge();
      }
    });
  }

  private setupKeyboardAdjustment() {
    if (Capacitor.isNativePlatform()) {
      Keyboard.addListener('keyboardWillShow', (info) => {
        document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
        this.isKeyboardOpen.set(true);
        setTimeout(() => {
          const el = document.activeElement as HTMLElement;
          if (el && el !== document.body) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);
      });
      Keyboard.addListener('keyboardWillHide', () => {
        document.documentElement.style.setProperty('--keyboard-height', '0px');
        this.isKeyboardOpen.set(false);
      });
    } else {
      // Fallback navigateur
      if (!window.visualViewport) return;
      window.visualViewport.addEventListener('resize', () => {
        const vp = window.visualViewport!;
        const kbHeight = Math.max(0, window.innerHeight - vp.height - vp.offsetTop);
        document.documentElement.style.setProperty('--keyboard-height', `${kbHeight}px`);
        this.isKeyboardOpen.set(kbHeight > 80);
      });
    }
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

  // Appelé quand l'onboarding est terminé ou passé
  // Le signal showOnboarding se met à jour automatiquement via authService.currentUser()
  onOnboardingDone() {}
}
