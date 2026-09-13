import { Injectable } from '@angular/core';

/**
 * Les notifications push sont gérées par l'app mobile (Expo, dossier app/).
 * La web app ne s'y abonne pas : ces méthodes restent pour ne pas casser les appels existants.
 */
@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  async initializePushNotifications(): Promise<void> {}

  async clearBadge(): Promise<void> {}

  async removePushToken(): Promise<void> {}

  async unregister(): Promise<void> {}
}
