import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CONTACT_EMAIL, PublicShellComponent } from './public-shell.component';

/** Support : les questions qui reviennent, et comment nous joindre. */
@Component({
  selector: 'tw-support',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PublicShellComponent, RouterLink],
  template: `
    <tw-public-shell
      title="Support et questions fréquentes"
      lead="Une question, un problème ? La réponse est peut-être ici. Sinon, écrivez-nous : on répond sous deux jours ouvrés."
    >
      <h2>Rejoindre un coach</h2>

      <h3>Comment rejoindre mon coach ?</h3>
      <p>
        Demandez-lui son code d'invitation, puis ouvrez <strong>Profil → Rejoindre un coach</strong> et saisissez-le. Votre coach peut aussi vous inviter
        depuis votre adresse email : vous recevrez alors une invitation à accepter.
      </p>

      <h3>Puis-je avoir plusieurs coachs ?</h3>
      <p>Non. Pour en changer, quittez d'abord le vôtre depuis votre profil, puis rejoignez le nouveau.</p>

      <h2>Strava</h2>

      <h3>Mes sorties n'arrivent pas toutes seules</h3>
      <p>
        Vérifiez d'abord que Strava est connecté dans <strong>Profil → Connecteurs</strong>. Une activité mise en privé sur Strava ne nous est pas
        transmise. Vous pouvez aussi lancer une synchronisation manuelle depuis ce même écran : elle rattrape les sorties des dernières semaines.
      </p>

      <h3>Le déroulé de ma séance ne correspond pas à ce que j'ai couru</h3>
      <p>
        Nous reconstruisons votre séance depuis les tours enregistrés par votre montre. Si elle tourne en tour automatique au kilomètre, le découpage est
        approximatif. Vous pouvez corriger le déroulé à la main depuis la sortie, et c'est votre version qui fait foi.
      </p>

      <h3>Si je supprime une sortie dans Trainwise, disparaît-elle de Strava ?</h3>
      <p>Non. L'inverse est vrai : une activité supprimée sur Strava disparaît aussi de Trainwise.</p>

      <h2>Séances et planning</h2>

      <h3>À quoi correspond la difficulté annoncée par mon coach ?</h3>
      <p>
        C'est ce que la séance devrait vous coûter, sur une échelle de 1 (très facile) à 10 (épuisante). Elle est indicative : votre propre ressenti, que
        vous notez après la séance, reste ce qui compte.
      </p>

      <h3>Pourquoi mes allures diffèrent de celles d'un autre athlète du groupe ?</h3>
      <p>C'est voulu. Une même séance est distribuée à chacun à son allure, calculée depuis sa VMA.</p>

      <h2>Compte et confidentialité</h2>

      <h3>Comment supprimer mon compte ?</h3>
      <p>
        Depuis l'application : <strong>Profil → Mon compte → Supprimer mon compte</strong>. La suppression est définitive et emporte vos entraînements,
        vos messages et votre lien avec votre coach. Aucune démarche à faire auprès de nous.
      </p>

      <h3>Qui voit mes données d'entraînement ?</h3>
      <p>
        Vous et votre coach, personne d'autre. Nous ne les vendons pas et ne les cédons à aucun tiers publicitaire. Le détail figure dans la
        <a routerLink="/confidentialite">politique de confidentialité</a>.
      </p>

      <h2>Nous écrire</h2>
      <p>
        Pour tout le reste — un bug, une idée, une demande liée à vos données — écrivez à <a [href]="'mailto:' + contact">{{ contact }}</a>. Précisez votre
        modèle de téléphone et ce que vous faisiez au moment du problème : ça nous fait gagner un aller-retour.
      </p>
    </tw-public-shell>
  `,
})
export class SupportPage {
  readonly contact = CONTACT_EMAIL;
}
