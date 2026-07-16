import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Page support — publique (Support URL exigée par l'App Store).
 * URL : https://trainwise-app.com/support
 */
@Component({
  selector: 'app-support',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="legal-page">
      <header class="legal-header">
        <a routerLink="/" class="legal-brand">Trainwise</a>
      </header>

      <main class="legal-content">
        <h1>Support</h1>
        <p>
          Une question, un bug, une suggestion ? On te répond vite — en général sous 24&nbsp;heures ouvrées.
        </p>

        <a class="support-cta" href="mailto:contact&#64;trainwise-app.com?subject=Support%20Trainwise">
          ✉️ Écrire au support
        </a>
        <p class="support-mail">contact&#64;trainwise-app.com</p>

        <h2>Questions fréquentes</h2>

        <h3>Comment générer mon plan d'entraînement ?</h3>
        <p>Ouvre l'onglet Planning → « Générer » → choisis tes jours d'entraînement (course et/ou renfo) → l'IA construit ton programme en une à deux minutes. Tu valides ensuite les séances proposées avant qu'elles rejoignent ton calendrier.</p>

        <h3>Que sont les TrainCoins ?</h3>
        <p>Des crédits qui te permettent d'utiliser les fonctionnalités IA sans abonnement : 1 coin = 1 analyse de séance, 5 coins = 1 plan généré. Des coins sont offerts à l'inscription, et l'abonnement Pro rend l'IA illimitée.</p>

        <h3>Comment connecter Strava ?</h3>
        <p>Réglages → Connexions → Strava. Tes sorties s'importeront automatiquement et se rattacheront à tes séances planifiées.</p>

        <h3>Comment gérer mon abonnement ?</h3>
        <p>Ton abonnement Pro est géré par l'App Store (iOS) ou Google Play (Android) : Réglages de ton téléphone → ton compte → Abonnements. Tu peux le résilier à tout moment ; il reste actif jusqu'à la fin de la période en cours.</p>

        <h3>Comment supprimer mon compte ?</h3>
        <p>Dans l'app : Réglages → Supprimer mon compte. La suppression est immédiate et définitive (voir notre <a routerLink="/privacy">politique de confidentialité</a>).</p>

        <h3>Je suis coach, comment inviter mes athlètes ?</h3>
        <p>Depuis ton espace coach : génère ton code d'invitation ou recherche directement tes athlètes par nom. Une fois l'invitation acceptée, tu les suis depuis ton dashboard.</p>
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

      h1 { font-size: 1.6rem; color: #0D3652; margin: 0 0 12px; }
      h2 { font-size: 1.15rem; color: #0D3652; margin: 32px 0 8px; }
      h3 { font-size: 0.95rem; color: #0D3652; margin: 20px 0 4px; }
      p { font-size: 0.9rem; line-height: 1.65; color: #333; }
      a { color: #0582ca; }
    }
    .support-cta {
      display: inline-block;
      background: #0D3652;
      color: #fff !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.95rem;
      padding: 12px 24px;
      border-radius: 12px;
      margin-top: 8px;
    }
    .support-mail { color: #888; font-size: 0.82rem; margin-top: 8px; }
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
export class SupportComponent {}
