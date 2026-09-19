import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { load } from '../../core/load';
import { AthleteService } from '../../data/athlete.service';
import { IconComponent } from '../../ui/icon.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { StateViewComponent } from '../../ui/state-view.component';

type Connector = { id: string; name: string; purpose: string; icon: string };

// Strava est branché ; les autres arrivent. Ils restent affichés pour que l'athlète
// sache ce qu'on prépare, en gris pour qu'on ne les confonde pas avec un connecteur
// utilisable (même liste que l'application mobile).
const SOON: Connector[] = [
  { id: 'garmin', name: 'Garmin Connect', purpose: 'Forerunner, Fenix, Venu', icon: 'watch' },
  { id: 'polar', name: 'Polar Flow', purpose: 'Vantage, Pacer, Grit X', icon: 'watch' },
  { id: 'coros', name: 'COROS', purpose: 'Pace, Apex, Vertix', icon: 'watch' },
  { id: 'suunto', name: 'Suunto', purpose: 'Race, Vertical, 9', icon: 'watch' },
  { id: 'apple-sante', name: 'Apple Santé', purpose: "Séances de l'Apple Watch", icon: 'heart' },
];

/** Connecteurs : d'où viennent les séances importées automatiquement. */
@Component({
  selector: 'tw-athlete-connectors',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PageHeaderComponent, StateViewComponent],
  template: `
    <main class="page">
      <tw-page-header title="Connecteurs" />

      <p class="body muted intro">
        Relie tes applications et tes montres : tes séances arrivent alors toutes seules dans Trainwise, avec leurs allures, leur fréquence cardiaque et leur
        tracé.
      </p>

      @if (strava.loading()) {
        <tw-state kind="loading" />
      } @else if (strava.error()) {
        <tw-state kind="error" [message]="strava.error()">
          <button class="btn btn-ghost btn-sm" (click)="strava.reload()">Réessayer</button>
        </tw-state>
      } @else if (strava.data(); as status) {
        <div class="cols">
          <section class="group">
            <span class="overline">Disponible</span>
            <div class="card card-pad">
              <div class="row">
                <span class="tile strava"><tw-icon name="run" [size]="22" [strokeWidth]="2" /></span>
                <div class="stack grow">
                  <span class="h3">Strava</span>
                  <span class="small muted">Course, trail, vélo</span>
                </div>
                @if (status.connected) {
                  <span class="chip chip-done"><tw-icon name="check" [size]="13" [strokeWidth]="2" />Connecté</span>
                } @else {
                  <span class="chip">Non connecté</span>
                }
              </div>

              <div class="status">
                <span class="dot" [style.background]="status.connected ? 'var(--success)' : 'var(--text3)'"></span>
                <span class="small muted grow">
                  {{ status.connected ? importLabel(status.since) : "Tes sorties ne sont pas importées pour l'instant." }}
                </span>
              </div>

              @if (status.connected) {
                <button class="btn btn-ghost btn-block" type="button" [disabled]="busy()" (click)="disconnect()">
                  {{ busy() ? 'Déliaison…' : 'Délier Strava' }}
                </button>
              } @else {
                <button class="btn btn-primary btn-block" type="button" [disabled]="busy()" (click)="connect()">
                  {{ busy() ? 'Connexion…' : 'Connecter Strava' }}
                </button>
              }
            </div>
          </section>

          <section class="group">
            <span class="overline">Bientôt</span>
            <div class="card soon">
              @for (connector of soon; track connector.id) {
                <div class="soon-row">
                  <span class="tile"><tw-icon [name]="connector.icon" [size]="20" /></span>
                  <div class="stack grow">
                    <span class="h3">{{ connector.name }}</span>
                    <span class="small muted">{{ connector.purpose }}</span>
                  </div>
                  <span class="chip">Bientôt</span>
                </div>
              }
            </div>
            <p class="caption muted note">
              En attendant, les séances d'une montre Garmin, Polar, COROS ou Suunto arrivent déjà dans Trainwise si elles se synchronisent avec Strava.
            </p>
          </section>
        </div>
      }
    </main>
  `,
  styles: [
    `
      .page {
        flex: 1;
        min-width: 0;
        padding: 32px 40px 40px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .intro {
        margin: -8px 0 0;
        max-width: 720px;
      }

      .cols {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;
        align-items: start;
      }

      @media (max-width: 1100px) {
        .cols {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      .group {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .overline {
        font-size: 11px;
        line-height: 16px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text3);
      }

      .row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .tile {
        width: 44px;
        height: 44px;
        border-radius: var(--r-md);
        background: var(--subtle);
        color: var(--text3);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .tile.strava {
        background: var(--strava-soft);
        color: var(--strava-ink);
      }

      .status {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid var(--border);
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: var(--r-pill);
        flex-shrink: 0;
      }

      .card-pad .btn-block {
        margin-top: 14px;
      }

      .soon-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
      }

      .soon-row + .soon-row {
        border-top: 1px solid var(--border);
      }

      .note {
        margin: 2px 0 0;
      }
    `,
  ],
})
export class AthleteConnectorsPage {
  private readonly athlete = inject(AthleteService);

  readonly soon = SOON;
  readonly busy = signal(false);

  readonly strava = load(() => this.athlete.stravaStatus$());

  importLabel(since?: string) {
    return since ? `Import automatique actif · depuis le ${since}` : 'Import automatique actif';
  }

  connect() {
    if (this.busy()) return;
    this.busy.set(true);
    const returnTo = `${location.origin}/connecteurs`;
    this.athlete.stravaAuthUrl$(returnTo).subscribe({
      next: ({ authUrl }) => (location.href = authUrl),
      error: () => this.busy.set(false),
    });
  }

  disconnect() {
    if (this.busy()) return;
    this.busy.set(true);
    this.athlete.disconnectStrava().subscribe({
      next: () => {
        this.busy.set(false);
        this.strava.reload(true);
      },
      error: () => this.busy.set(false),
    });
  }
}
