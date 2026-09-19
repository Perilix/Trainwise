import { Injectable, signal } from '@angular/core';

/**
 * Battement de rafraîchissement global. Chaque écran s'y abonne via `load()` :
 * quand le serveur signale du nouveau (import Strava, séance modifiée par le
 * coach, message reçu), les données à l'écran se rechargent sans que
 * l'utilisateur ait à recharger la page.
 */
@Injectable({ providedIn: 'root' })
export class RefreshService {
  private readonly _tick = signal(0);

  readonly tick = this._tick.asReadonly();

  bump() {
    this._tick.update((value) => value + 1);
  }
}
