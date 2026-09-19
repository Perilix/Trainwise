import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { BadgesService } from '../core/badges.service';
import { ThemeService } from '../core/theme.service';
import { IconComponent } from '../ui/icon.component';
import { LogoComponent } from '../ui/logo.component';

type NavItem = { label: string; icon: string; link: string; badge?: () => number };

@Component({
  selector: 'tw-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent, LogoComponent],
  template: `
    <aside>
      <div class="brand">
        <tw-logo [height]="38" />
        <a class="bell" routerLink="/notifications" aria-label="Notifications">
          <tw-icon name="bell" [size]="20" />
          @if (badges.unreadNotifications() > 0) {
            <span class="pin"></span>
          }
        </a>
      </div>

      <nav>
        @for (item of nav(); track item.link) {
          <a
            class="nav-item"
            [routerLink]="item.link"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: item.link === '/coach' || item.link === '/accueil' }"
          >
            <tw-icon [name]="item.icon" [size]="20" />
            <span class="grow">{{ item.label }}</span>
            @if (item.badge && item.badge()! > 0) {
              <span class="count">{{ item.badge!() }}</span>
            }
          </a>
        }
      </nav>

      <div class="spacer"></div>

      <button class="nav-item" type="button" (click)="theme.toggle()">
        <tw-icon [name]="theme.resolved() === 'dark' ? 'sun' : 'moon'" [size]="20" />
        <span class="grow">{{ theme.resolved() === 'dark' ? 'Thème clair' : 'Thème sombre' }}</span>
      </button>

      <a class="nav-item" [routerLink]="settingsLink()" routerLinkActive="active">
        <tw-icon name="settings" [size]="20" />
        <span class="grow">Paramètres</span>
      </a>

      <div class="sep"></div>

      <div class="me">
        <span class="avatar">{{ auth.initials() }}</span>
        <div class="grow stack">
          <span class="name truncate">{{ auth.fullName() }}</span>
          <span class="role">{{ auth.isCoach() ? 'Coach' : 'Athlète' }}</span>
        </div>
        <button type="button" class="out" (click)="auth.logout()" aria-label="Se déconnecter">
          <tw-icon name="logout" [size]="20" />
        </button>
      </div>
    </aside>
  `,
  styles: [
    `
      aside {
        width: var(--sidebar-w);
        flex-shrink: 0;
        background: var(--brand);
        padding: 28px 16px 20px;
        display: flex;
        flex-direction: column;
        position: sticky;
        top: 0;
        height: 100vh;
      }

      .brand {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 0 0 32px 12px;
      }

      .brand tw-logo {
        color: #fff;
        display: block;
      }

      .bell {
        position: relative;
        width: 40px;
        height: 40px;
        border-radius: var(--r-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.8);
      }

      .bell:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      .pin {
        position: absolute;
        top: 9px;
        right: 10px;
        width: 8px;
        height: 8px;
        border-radius: var(--r-pill);
        background: var(--danger);
        box-shadow: 0 0 0 2px var(--brand);
      }

      nav {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .nav-item {
        height: 44px;
        padding: 0 12px;
        border-radius: var(--r-sm);
        display: flex;
        align-items: center;
        gap: 12px;
        color: rgba(255, 255, 255, 0.64);
        font-size: 14px;
        font-weight: 500;
        width: 100%;
        text-align: left;
        cursor: pointer;
      }

      .nav-item:hover {
        background: rgba(255, 255, 255, 0.06);
        color: #fff;
      }

      .nav-item.active {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
        font-weight: 600;
      }

      .nav-item.active tw-icon {
        color: var(--highlight);
      }

      .count {
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: var(--r-pill);
        background: var(--accent);
        color: var(--on-accent);
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .spacer {
        flex: 1;
        min-height: 24px;
      }

      .sep {
        height: 1px;
        background: rgba(255, 255, 255, 0.12);
        margin: 14px 0;
      }

      .me {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 8px;
      }

      .avatar {
        width: 36px;
        height: 36px;
        border-radius: var(--r-pill);
        background: var(--highlight);
        color: #003554;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 600;
        flex-shrink: 0;
        letter-spacing: 0.02em;
      }

      .name {
        font-size: 14px;
        font-weight: 600;
        color: #ffffff;
      }

      .role {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }

      .out {
        color: rgba(255, 255, 255, 0.72);
        display: flex;
      }

      .out:hover {
        color: #fff;
      }
    `,
  ],
})
export class SidebarComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly badges = inject(BadgesService);

  private readonly athleteNav: NavItem[] = [
    { label: 'Accueil', icon: 'home', link: '/accueil' },
    { label: 'Planning', icon: 'calendar', link: '/planning' },
    { label: 'Sorties', icon: 'run', link: '/sorties' },
    { label: 'Coach', icon: 'chat', link: '/messages', badge: () => this.badges.unreadMessages() },
  ];

  private readonly coachNav: NavItem[] = [
    { label: 'Accueil', icon: 'home', link: '/coach' },
    { label: 'Bibliothèque', icon: 'folder', link: '/coach/bibliotheque' },
    { label: 'Messages', icon: 'chat', link: '/messages', badge: () => this.badges.unreadMessages() },
  ];

  readonly nav = computed(() => (this.auth.isCoach() ? this.coachNav : this.athleteNav));
  readonly settingsLink = computed(() => (this.auth.isCoach() ? '/coach/profil' : '/profil'));
}
