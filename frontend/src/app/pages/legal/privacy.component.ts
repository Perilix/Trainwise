import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Politique de confidentialité — page publique (exigée par l'App Store et Google Play).
 * URL : https://trainwise-app.com/privacy
 */
@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="legal-page">
      <header class="legal-header">
        <a routerLink="/" class="legal-brand">Trainwise</a>
      </header>

      <main class="legal-content">
        <h1>Politique de confidentialité</h1>
        <p class="legal-updated">Dernière mise à jour : 16 juillet 2026</p>

        <p>
          Trainwise (« nous ») exploite l'application mobile et le site Trainwise, une plateforme
          de coaching sportif. La protection de tes données personnelles est une priorité.
          Cette politique explique quelles données nous collectons, pourquoi, et quels sont tes droits,
          conformément au Règlement Général sur la Protection des Données (RGPD).
        </p>

        <h2>1. Responsable du traitement</h2>
        <p>
          Trainwise — contact : <a href="mailto:contact&#64;trainwise-app.com">contact&#64;trainwise-app.com</a>
        </p>

        <h2>2. Données que nous collectons</h2>
        <ul>
          <li><strong>Données de compte</strong> : prénom, nom, adresse e-mail, mot de passe (chiffré), photo de profil (optionnelle).</li>
          <li><strong>Profil sportif</strong> : niveau, fréquence d'entraînement, VMA, fréquence cardiaque maximale, taille, poids, blessures déclarées, objectifs de compétition. Ces données relèvent des données de santé au sens du RGPD : elles ne sont collectées qu'avec ton consentement explicite (renseignement volontaire du profil) et servent exclusivement à personnaliser ton entraînement.</li>
          <li><strong>Données d'activité</strong> : séances de course et de musculation (distance, durée, allures, fréquence cardiaque, ressenti, notes), séances planifiées, analyses générées.</li>
          <li><strong>Données Strava</strong> (uniquement si tu connectes ton compte) : activités importées, tracés GPS, laps. La connexion est optionnelle et révocable à tout moment dans les réglages.</li>
          <li><strong>Messages</strong> : contenus échangés dans le chat (avec ton coach ou tes amis), y compris images et documents partagés.</li>
          <li><strong>Données techniques</strong> : jeton de notification push, plateforme (iOS/Android), horodatages de connexion.</li>
          <li><strong>Achats</strong> : les paiements in-app sont traités par Apple ou Google — nous ne voyons ni ne stockons aucune donnée bancaire. Nous conservons uniquement l'état de ton abonnement et ton solde de TrainCoins.</li>
        </ul>

        <h2>3. Pourquoi nous utilisons tes données</h2>
        <ul>
          <li>Fournir le service : génération de plans d'entraînement, analyses de séances, suivi de progression (exécution du contrat).</li>
          <li>Permettre la relation avec ton coach si tu y souscris : ton coach accède à ton profil sportif, tes séances et ton état de forme (exécution du contrat).</li>
          <li>Envoyer des notifications liées au service (séances, messages, rappels) — désactivables dans les réglages.</li>
          <li>Améliorer le service et assurer sa sécurité (intérêt légitime).</li>
        </ul>

        <h2>4. Intelligence artificielle</h2>
        <p>
          Les plans d'entraînement et analyses de séances sont générés par un modèle d'intelligence
          artificielle (Anthropic Claude). Pour cela, les données pertinentes de ton profil sportif et
          de tes séances sont transmises à l'API d'Anthropic, qui ne les utilise pas pour entraîner
          ses modèles. Aucune décision produisant des effets juridiques n'est prise de manière automatisée.
        </p>

        <h2>5. Avec qui nous partageons tes données</h2>
        <p>Nous ne vendons jamais tes données. Elles sont traitées par nos sous-traitants techniques, uniquement pour les besoins du service :</p>
        <ul>
          <li><strong>Render</strong> (hébergement des serveurs) et <strong>MongoDB</strong> (base de données)</li>
          <li><strong>Anthropic</strong> (génération IA des plans et analyses)</li>
          <li><strong>RevenueCat</strong> (gestion des abonnements et achats)</li>
          <li><strong>Google Firebase</strong> (notifications push)</li>
          <li><strong>Cloudinary</strong> (stockage des images)</li>
          <li><strong>Strava</strong> (uniquement si tu connectes ton compte, à ta demande)</li>
        </ul>
        <p>Si tu es accompagné par un coach via Trainwise, celui-ci accède aux données nécessaires à ton suivi (profil sportif, séances, ressentis, état de forme).</p>

        <h2>6. Durées de conservation</h2>
        <ul>
          <li>Données de compte et d'activité : tant que ton compte est actif.</li>
          <li>En cas de suppression de compte : suppression définitive de l'ensemble de tes données dans un délai de 30 jours.</li>
        </ul>

        <h2>7. Tes droits</h2>
        <p>
          Conformément au RGPD, tu disposes des droits d'accès, de rectification, d'effacement, de
          portabilité, de limitation et d'opposition sur tes données, ainsi que du droit de retirer
          ton consentement à tout moment.
        </p>
        <ul>
          <li><strong>Supprimer ton compte</strong> : directement dans l'app (Réglages → Supprimer mon compte) — suppression immédiate et définitive.</li>
          <li><strong>Exercer tes autres droits</strong> : écris-nous à <a href="mailto:contact&#64;trainwise-app.com">contact&#64;trainwise-app.com</a> — réponse sous 30 jours.</li>
          <li>Tu peux également introduire une réclamation auprès de la CNIL (cnil.fr).</li>
        </ul>

        <h2>8. Sécurité</h2>
        <p>
          Les échanges sont chiffrés (HTTPS), les mots de passe sont hachés (bcrypt), et les accès aux
          données sont limités au strict nécessaire.
        </p>

        <h2>9. Mineurs</h2>
        <p>
          Trainwise n'est pas destiné aux enfants de moins de 15 ans. Si tu penses qu'un mineur nous a
          fourni des données sans autorisation, contacte-nous pour leur suppression.
        </p>

        <h2>10. Évolutions</h2>
        <p>
          Cette politique peut évoluer. En cas de changement significatif, nous t'en informerons dans
          l'app. La version en vigueur est toujours disponible à cette adresse.
        </p>
      </main>

      <footer class="legal-footer">
        <a routerLink="/support">Support</a> · <a routerLink="/privacy">Confidentialité</a> · © 2026 Trainwise
      </footer>
    </div>
  `,
  styles: [`
    .legal-page {
      min-height: 100vh;
      background: #F6F4F0;
      font-family: 'Poppins', sans-serif;
      color: #222;
      display: flex;
      flex-direction: column;
    }
    .legal-header {
      background: #0D3652;
      padding: calc(env(safe-area-inset-top, 0px) + 18px) 24px 18px;
    }
    .legal-brand {
      color: #44A0D6;
      font-weight: 800;
      font-size: 1.2rem;
      text-decoration: none;
      letter-spacing: 0.3px;
    }
    .legal-content {
      max-width: 720px;
      margin: 0 auto;
      padding: 32px 20px 48px;
      flex: 1;

      h1 { font-size: 1.6rem; color: #0D3652; margin: 0 0 4px; }
      h2 { font-size: 1.05rem; color: #0D3652; margin: 28px 0 8px; }
      p, li { font-size: 0.9rem; line-height: 1.65; color: #333; }
      ul { padding-left: 20px; }
      li { margin-bottom: 6px; }
      a { color: #0582ca; }
    }
    .legal-updated { color: #888; font-size: 0.8rem; margin-bottom: 24px; }
    .legal-footer {
      text-align: center;
      padding: 20px;
      font-size: 0.78rem;
      color: #888;
      border-top: 1px solid #e5e2da;
      a { color: #0582ca; text-decoration: none; }
    }
  `]
})
export class PrivacyComponent {}
