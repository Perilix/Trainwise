import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PublicShellComponent } from './public-shell.component';

/** L'adresse de Julien : la démo est le lien des mails de prospection, la réponse doit lui arriver directement. */
const JULIEN_EMAIL = 'julien@trainwise-app.com';

/** Démo : la vidéo de présentation, ce qu'apporte l'app, et comment nous joindre. Lien des mails aux coachs. */
@Component({
  selector: 'tw-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PublicShellComponent, RouterLink],
  template: `
    <tw-public-shell
      title="Trainwise en vidéo"
      lead="Plus de fichiers Excel ni de messages éparpillés : toute votre activité de coach au même endroit."
    >
      <div class="demo">
        <video class="film" controls playsinline preload="metadata" poster="/medias/affiche.jpg">
          <source src="/medias/trainwise.mp4" type="video/mp4" />
        </video>

        <div class="side">
          <h2>Ce que vous y gagnez</h2>
          <ul>
            <li><strong>Vos séances, écrites une fois.</strong> Chaque athlète les reçoit à ses allures, calculées depuis sa VMA.</li>
            <li><strong>Course, vélo, natation, muscu.</strong> Tout se programme au même endroit, dans une bibliothèque réutilisable.</li>
            <li><strong>Les sorties remontent de Strava.</strong> Vous voyez ce qui a été fait, kilomètre par kilomètre.</li>
            <li><strong>La forme de chaque athlète.</strong> Charge, fréquence cardiaque, ressenti : vous voyez venir la fatigue.</li>
            <li><strong>La messagerie avec la séance sous les yeux.</strong> Fini les échanges perdus à 23 h.</li>
          </ul>

          <div class="actions">
            <a class="btn btn-primary" [href]="'mailto:' + email + '?subject=D%C3%A9mo%20Trainwise'">Je veux une démo de 15 min</a>
            <a class="btn btn-ghost" routerLink="/inscription">Créer mon compte coach</a>
          </div>
          <p class="caption muted">Ou écrivez directement à Julien, le fondateur : <a [href]="'mailto:' + email">{{ email }}</a></p>
        </div>
      </div>
    </tw-public-shell>
  `,
  styles: [
    `
      /* La démo est filmée en 16:9 (desktop coach + iPhone athlète) : la vidéo prend toute la largeur. */
      .demo {
        display: grid;
        gap: 28px;
        margin-top: 24px;
      }

      .film {
        width: 100%;
        aspect-ratio: 16 / 9;
        border-radius: 16px;
        background: #f6f4f0;
        border: 1px solid var(--border);
      }

      .side h2 {
        margin-top: 0 !important;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 22px 0 10px;
      }

      /* Le shell souligne et colore les liens du contenu : les boutons gardent leurs couleurs. */
      .actions .btn {
        text-decoration: none !important;
      }

      .actions .btn-primary {
        color: var(--on-primary) !important;
      }

    `,
  ],
})
export class DemoPage {
  readonly email = JULIEN_EMAIL;
}
