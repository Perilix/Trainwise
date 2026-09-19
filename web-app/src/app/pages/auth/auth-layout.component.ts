import { ChangeDetectionStrategy, Component } from '@angular/core';

import { IconComponent } from '../../ui/icon.component';
import { GlyphComponent, LogoComponent } from '../../ui/logo.component';

/** Écran de connexion en deux colonnes : présentation à gauche (navy), formulaire à droite. */
@Component({
  selector: 'tw-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GlyphComponent, IconComponent, LogoComponent],
  template: `
    <div class="split">
      <section class="pitch">
        <span class="glyph"><tw-glyph /></span>
        <tw-logo class="logo" [height]="52" />
        <div class="grow-space"></div>
        <h2>Bienvenue sur Trainwise</h2>
        <ul>
          <li>
            <span class="tile"><tw-icon name="calendar" [size]="20" /></span>
            Ton planning construit avec ton coach
          </li>
          <li>
            <span class="tile"><tw-icon name="chat" [size]="20" /></span>
            Des échanges autour de chaque séance
          </li>
          <li>
            <span class="tile"><tw-icon name="trending-up" [size]="20" /></span>
            Suivi de ta progression en temps réel
          </li>
        </ul>
        <div class="grow-space"></div>
      </section>

      <section class="form-side">
        <span class="glyph-back"><tw-glyph /></span>
        <div class="form-box">
          <tw-logo class="logo-form" [height]="40" />
          <ng-content />
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .split {
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        background: var(--bg);
      }

      .pitch {
        position: relative;
        overflow: hidden;
        background: var(--brand);
        padding: 56px 64px;
        display: flex;
        flex-direction: column;
        color: #fff;
      }

      .glyph {
        position: absolute;
        right: -140px;
        bottom: -160px;
        width: 620px;
        height: 620px;
        display: block;
        color: #fff;
        opacity: 0.08;
        pointer-events: none;
      }

      .logo {
        position: relative;
        align-self: flex-start;
        color: var(--on-brand, #fff);
      }

      /* Le monogramme en filigrane : la colonne du formulaire n'est plus une page blanche,
         et il reste lisible en clair comme en sombre. */
      .glyph-back {
        position: absolute;
        left: -170px;
        bottom: -190px;
        width: 560px;
        height: 560px;
        display: block;
        color: var(--brand);
        opacity: 0.05;
        pointer-events: none;
      }

      .logo-form {
        color: var(--brand);
        margin-bottom: 28px;
      }

      .grow-space {
        flex: 1;
      }

      h2 {
        position: relative;
        font-size: 36px;
        line-height: 46px;
        font-weight: 600;
        letter-spacing: -0.02em;
        max-width: 480px;
      }

      ul {
        position: relative;
        list-style: none;
        margin: 28px 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      li {
        display: flex;
        align-items: center;
        gap: 14px;
        font-size: 16px;
        color: rgba(255, 255, 255, 0.86);
      }

      .tile {
        width: 40px;
        height: 40px;
        border-radius: var(--r-md);
        background: rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: #fff;
      }

      .form-side {
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 56px;
      }

      .form-box {
        width: 400px;
        max-width: 100%;
        display: flex;
        flex-direction: column;
      }

      @media (max-width: 960px) {
        .split {
          grid-template-columns: minmax(0, 1fr);
        }

        .pitch {
          display: none;
        }
      }
    `,
  ],
})
export class AuthLayoutComponent {}
