import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LogoComponent } from '../../ui/logo.component';

/** L'adresse à laquelle on nous écrit, partout la même. */
export const CONTACT_EMAIL = 'contact@trainwise-app.com';

/**
 * La coquille des pages publiques — à propos, support, confidentialité.
 *
 * Elles se lisent sans compte : c'est par elles qu'Apple, Google et un
 * visiteur curieux entrent. D'où un en-tête sobre, une colonne de lecture
 * étroite, et les trois pages qui se renvoient l'une à l'autre.
 */
@Component({
  selector: 'tw-public-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LogoComponent, RouterLink],
  template: `
    <div class="page">
      <header class="bar">
        <a routerLink="/"><tw-logo [height]="30" /></a>
        <nav class="nav">
          <a routerLink="/a-propos">À propos</a>
          <a routerLink="/support">Support</a>
          <a routerLink="/confidentialite">Confidentialité</a>
          <a routerLink="/contact">Contact</a>
        </nav>
      </header>

      <main class="sheet">
        <h1 class="display">{{ title() }}</h1>
        @if (lead()) {
          <p class="lead">{{ lead() }}</p>
        }
        <ng-content />
      </main>

      <footer class="foot">
        <span class="caption muted">Trainwise — l'entraînement de course à pied, du coach à l'athlète.</span>
        <a class="caption" routerLink="/contact">Nous contacter</a>
      </footer>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        background: var(--bg);
        min-height: 100vh;
      }

      .page {
        max-width: 760px;
        margin: 0 auto;
        padding: 0 24px 64px;
      }

      .bar {
        display: flex;
        align-items: center;
        gap: 24px;
        padding: 24px 0;
        flex-wrap: wrap;
      }

      .nav {
        display: flex;
        gap: 18px;
        margin-left: auto;
      }

      .nav a {
        font-size: 14px;
        color: var(--text2);
      }

      .nav a:hover {
        color: var(--ink);
      }

      .sheet {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--r-lg, 16px);
        padding: 32px;
      }

      .lead {
        color: var(--text2);
        font-size: 17px;
        line-height: 26px;
        margin: 10px 0 0;
      }

      .foot {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        justify-content: space-between;
        padding-top: 24px;
      }

      /* Le contenu des pages : titres, paragraphes et listes, sans classes. */
      .sheet ::ng-deep h2 {
        font-size: 19px;
        line-height: 26px;
        font-weight: 600;
        margin: 32px 0 8px;
      }

      .sheet ::ng-deep h3 {
        font-size: 15px;
        font-weight: 600;
        margin: 22px 0 4px;
      }

      .sheet ::ng-deep p,
      .sheet ::ng-deep li {
        color: var(--text2);
        line-height: 25px;
      }

      .sheet ::ng-deep ul {
        padding-left: 20px;
        margin: 8px 0;
      }

      .sheet ::ng-deep li {
        margin: 4px 0;
      }

      .sheet ::ng-deep a {
        color: var(--accent-ink);
        text-decoration: underline;
      }

      @media (max-width: 640px) {
        .sheet {
          padding: 22px 18px;
        }
      }
    `,
  ],
})
export class PublicShellComponent {
  readonly title = input.required<string>();
  readonly lead = input<string>('');
  readonly contact = CONTACT_EMAIL;
}
