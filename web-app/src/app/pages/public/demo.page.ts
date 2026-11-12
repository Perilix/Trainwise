import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { environment } from '../../../environments/environment';
import { PublicShellComponent } from './public-shell.component';

/** L'adresse de Julien : la démo est le lien des mails de prospection, la réponse doit lui arriver directement. */
const JULIEN_EMAIL = 'contact@trainwise-app.com';
/** La demande part dans la base de prospection, via le back-office. */
const DEMANDE_DEMO = `${environment.adminUrl}/public/demande-demo`;

const ATHLETES = ['1 à 5', '6 à 15', '16 à 40', 'Plus de 40'] as const;

/**
 * Démo : la vidéo de présentation, ce qu'apporte l'app, et un formulaire de demande de démo.
 * C'est le lien des mails envoyés aux coachs : la demande arrive dans la base de prospection,
 * sans dépendre du client mail du visiteur.
 */
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

          @if (envoye()) {
            <p class="done">Merci {{ prenom() }} ! Votre demande est bien arrivée : Julien vous recontacte très vite pour caler la démo.</p>
          } @else if (ouvert()) {
            <form class="form" (submit)="envoyer($event)">
              <h2>Demander une démo de 15 min</h2>
              <div class="two">
                <div class="field">
                  <label for="d-nom">Votre nom</label>
                  <input id="d-nom" class="input" autocomplete="name" [value]="nom()" (input)="nom.set(valeur($event))" />
                </div>
                <div class="field">
                  <label for="d-email">Votre email</label>
                  <input id="d-email" class="input" type="email" autocomplete="email" [value]="email()" (input)="email.set(valeur($event))" />
                </div>
              </div>
              <div class="two">
                <div class="field">
                  <label for="d-tel">Téléphone <span class="muted-3">(facultatif)</span></label>
                  <input id="d-tel" class="input" type="tel" autocomplete="tel" [value]="telephone()" (input)="telephone.set(valeur($event))" />
                </div>
                <div class="field">
                  <label for="d-ath">Athlètes suivis</label>
                  <select id="d-ath" class="input" [value]="athletes()" (change)="athletes.set(valeur($event))">
                    <option value="">Choisir…</option>
                    @for (option of tranches; track option) {
                      <option [value]="option">{{ option }}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="field">
                <label for="d-msg">Un mot sur votre façon de coacher <span class="muted-3">(facultatif)</span></label>
                <textarea id="d-msg" class="input" rows="3" placeholder="Disciplines, outil actuel, ce que vous aimeriez voir…"
                  [value]="message()" (input)="message.set(valeur($event))"></textarea>
              </div>
              <!-- Champ piège, invisible pour un humain. -->
              <input class="piege" tabindex="-1" autocomplete="off" aria-hidden="true" [value]="site()" (input)="site.set(valeur($event))" />
              @if (erreur()) {
                <p class="err">{{ erreur() }}</p>
              }
              <div class="actions">
                <button class="btn btn-primary" type="submit" [disabled]="!valide() || envoi()">{{ envoi() ? 'Envoi…' : 'Envoyer ma demande' }}</button>
                <button class="btn btn-ghost" type="button" (click)="ouvert.set(false)">Annuler</button>
              </div>
            </form>
          } @else {
            <div class="actions">
              <button class="btn btn-primary" type="button" (click)="ouvert.set(true)">Je veux une démo de 15 min</button>
              <a class="btn btn-ghost" routerLink="/inscription">Créer mon compte coach</a>
            </div>
          }
          <p class="caption muted">Ou écrivez nous directement : <a [href]="'mailto:' + contact">{{ contact }}</a></p>
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

      .form {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-top: 24px;
        padding: 22px;
        border: 1px solid var(--border);
        border-radius: var(--r-md, 12px);
      }

      .form h2 {
        margin: 0 0 4px !important;
      }

      .form .actions {
        margin: 4px 0 0;
      }

      .two {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .field label {
        font-size: 13px;
        font-weight: 500;
      }

      .piege {
        position: absolute;
        left: -9999px;
        width: 1px;
        height: 1px;
        opacity: 0;
      }

      .done {
        margin: 22px 0 10px;
        padding: 14px 16px;
        border-radius: var(--r-md, 12px);
        background: var(--success-soft);
        color: var(--success-ink) !important;
      }

      .err {
        color: var(--danger) !important;
        margin: 0;
      }

      @media (max-width: 640px) {
        .two {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class DemoPage implements OnInit {
  readonly contact = JULIEN_EMAIL;
  readonly tranches = ATHLETES;

  readonly ouvert = signal(false);
  readonly nom = signal('');
  readonly email = signal('');
  readonly telephone = signal('');
  readonly athletes = signal('');
  readonly message = signal('');
  readonly site = signal('');
  readonly envoi = signal(false);
  readonly envoye = signal(false);
  readonly erreur = signal('');

  readonly valide = computed(() => this.nom().trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim()));
  readonly prenom = computed(() => this.nom().trim().split(/\s+/)[0]);

  ngOnInit() {
    // Le back-office s'endort quand personne ne s'en sert : on le réveille pendant que la vidéo tourne.
    fetch(`${DEMANDE_DEMO}/ping`).catch(() => {});
  }

  valeur(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  async envoyer(event: Event) {
    event.preventDefault();
    if (!this.valide() || this.envoi()) return;
    this.envoi.set(true);
    this.erreur.set('');
    try {
      const reponse = await fetch(DEMANDE_DEMO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: this.nom(), email: this.email(), telephone: this.telephone(),
          athletes: this.athletes(), message: this.message(), site: this.site(),
        }),
      });
      const corps = await reponse.json().catch(() => ({}));
      if (!reponse.ok) throw new Error(corps.error || 'Envoi impossible');
      this.envoye.set(true);
    } catch (e) {
      this.erreur.set(`${e instanceof Error ? e.message : 'Envoi impossible'}. Vous pouvez aussi écrire à ${JULIEN_EMAIL}.`);
    } finally {
      this.envoi.set(false);
    }
  }
}
