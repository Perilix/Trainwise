import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CONTACT_EMAIL, PublicShellComponent } from './public-shell.component';

/** À propos : ce qu'est Trainwise, pour qui, et qui le fait. */
@Component({
  selector: 'tw-about',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PublicShellComponent, RouterLink],
  template: `
    <tw-public-shell
      title="À propos de Trainwise"
      lead="Trainwise relie un coach de course à pied et ses athlètes : le coach construit les séances, l'athlète les court, et chacun voit ce que l'autre voit."
    >
      <h2>Ce que fait l'application</h2>
      <p>
        Un coach y compose ses séances bloc par bloc — échauffement, fractions, récupérations, retour au calme — et les assigne à ses athlètes. Les allures
        ne sont pas figées : chaque athlète reçoit la séance à la sienne, calculée depuis sa VMA.
      </p>
      <p>
        L'athlète retrouve son planning, court, et son activité remonte toute seule depuis Strava. Le déroulé réellement parcouru est reconstruit puis
        comparé à ce qui était prévu, phase par phase. Il note son ressenti, le coach lui répond.
      </p>

      <h2>Pour qui</h2>
      <ul>
        <li><strong>Les coachs</strong> qui suivent des athlètes à distance et veulent autre chose qu'un tableur et des messages.</li>
        <li><strong>Les coureurs</strong> suivis par un coach, qui veulent savoir quoi faire aujourd'hui et pourquoi.</li>
      </ul>

      <h2>Vos données</h2>
      <p>
        Vos entraînements vous appartiennent. Nous ne les vendons pas et ne les partageons avec personne d'autre que votre coach. Le détail est dans notre
        <a routerLink="/confidentialite">politique de confidentialité</a>, et votre compte se supprime depuis l'application, sans nous écrire.
      </p>

      <h2>Qui est derrière</h2>
      <p>
        Trainwise est développé en France par une petite équipe de coureurs. Une question, une idée, un reproche : écrivez-nous à
        <a [href]="'mailto:' + contact">{{ contact }}</a>, on lit tout.
      </p>
      <p>Les questions courantes sont rassemblées sur la page <a routerLink="/support">support</a>.</p>
    </tw-public-shell>
  `,
})
export class AboutPage {
  readonly contact = CONTACT_EMAIL;
}
