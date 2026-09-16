import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { BottomNavComponent } from './components/bottom-nav/bottom-nav.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { CoachBottomNavComponent } from './components/coach-bottom-nav/coach-bottom-nav.component';
import { CoachInvitationModalComponent } from './components/coach-invitation-modal/coach-invitation-modal.component';
import { OnboardingComponent } from './components/onboarding/onboarding.component';
import { PaywallComponent } from './components/paywall/paywall.component';
import { PlanGenerationIndicatorComponent } from './components/plan-generation-indicator/plan-generation-indicator.component';
import { PlanGenerationService } from './services/plan-generation.service';
import { AuthService } from './services/auth.service';
import { CoachInvitationModalService } from './services/coach-invitation-modal.service';
import { OnboardingService } from './services/onboarding.service';
import { SubscriptionService } from './services/subscription.service';
import { AthleteService } from './services/athlete.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SidebarComponent, BottomNavComponent, CoachBottomNavComponent, CoachInvitationModalComponent, OnboardingComponent, PaywallComponent, PlanGenerationIndicatorComponent],
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
  private planGenerationService = inject(PlanGenerationService);

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

    // À la connexion : reprendre une génération de plan en cours et relire abonnement/coins depuis l'API
    let sessionInitialized = false;
    effect(() => {
      const user = this.authService.currentUser();
      if (user && !sessionInitialized) {
        sessionInitialized = true;
        this.planGenerationService.resume();
        this.subscriptionService.refreshStatus();
      }
      if (!user) {
        sessionInitialized = false;
      }
    });
  }

  // Clavier virtuel des navigateurs mobiles : exposer sa hauteur aux styles
  private setupKeyboardAdjustment() {
    if (!window.visualViewport) return;
    window.visualViewport.addEventListener('resize', () => {
      const vp = window.visualViewport!;
      const kbHeight = Math.max(0, window.innerHeight - vp.height - vp.offsetTop);
      document.documentElement.style.setProperty('--keyboard-height', `${kbHeight}px`);
      this.isKeyboardOpen.set(kbHeight > 80);
    });
  }

  private initSafeAreas() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:0;width:0;height:env(safe-area-inset-bottom);pointer-events:none;visibility:hidden;';
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      const safeBottom = el.getBoundingClientRect().height;
      document.body.removeChild(el);

      document.documentElement.style.setProperty('--safe-bottom', `${safeBottom}px`);
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
