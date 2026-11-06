import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { AuthLayoutComponent } from './auth-layout.component';

/**
 * Arrivée depuis le back-office (« Se connecter en tant que ») : le jeton est dans le fragment
 * (#token=…), jamais envoyé au serveur ni gardé dans l'historique.
 */
@Component({
  selector: 'tw-impersonate',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthLayoutComponent, RouterLink],
  template: `
    <tw-auth-layout>
      <div class="titles">
        @if (error()) {
          <h1>Connexion impossible</h1>
          <p class="body muted">{{ error() }}</p>
          <a routerLink="/connexion">Aller à la connexion</a>
        } @else {
          <h1>Connexion…</h1>
          <p class="body muted">Ouverture du compte.</p>
        }
      </div>
    </tw-auth-layout>
  `,
})
export class ImpersonatePage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly error = signal('');

  async ngOnInit() {
    const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
    history.replaceState(null, '', window.location.pathname);
    if (!token) {
      this.error.set('Le lien ne contient pas de jeton. Relance la connexion depuis le back-office.');
      return;
    }
    if (!(await this.auth.impersonate(token))) {
      this.error.set('Le jeton est invalide ou expiré (1 h). Relance la connexion depuis le back-office.');
      return;
    }
    void this.router.navigate([this.auth.isCoach() ? '/coach' : '/accueil'], { replaceUrl: true });
  }
}
