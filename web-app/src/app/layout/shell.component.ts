import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ApiService } from '../core/api.service';
import { BadgesService } from '../core/badges.service';
import { RefreshService } from '../core/refresh.service';
import { SocketService } from '../core/socket.service';
import { ToastHostComponent } from '../ui/toast-host.component';
import { MatchPromptComponent } from './match-prompt.component';
import { SidebarComponent } from './sidebar.component';

/** Cadre desktop : barre latérale fixe à gauche, contenu de l'écran à droite. */
@Component({
  selector: 'tw-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatchPromptComponent, RouterOutlet, SidebarComponent, ToastHostComponent],
  template: `
    <div class="shell">
      <tw-sidebar />
      <router-outlet />
    </div>
    <tw-match-prompt />
    <tw-toast-host />
  `,
  styles: [
    `
      .shell {
        min-height: 100vh;
        display: flex;
        background: var(--bg);
      }
    `,
  ],
})
export class ShellComponent {
  constructor() {
    const badges = inject(BadgesService);
    const api = inject(ApiService);
    const refresh = inject(RefreshService);
    const socket = inject(SocketService);

    badges.refresh();

    // Le serveur prévient dès qu'il se passe quelque chose : import Strava,
    // séance modifiée par le coach, message reçu. On vide le cache et on relance
    // les chargements de l'écran ouvert, plutôt que d'attendre un F5.
    socket.connect();
    socket.on('notification:new', () => {
      api.invalidate();
      badges.refresh();
      refresh.bump();
    });
  }
}
