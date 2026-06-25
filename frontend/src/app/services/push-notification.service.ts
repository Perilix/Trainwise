import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { ToastController } from '@ionic/angular/standalone';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private readonly apiUrl = environment.apiUrl;
  private toastController = inject(ToastController);
  private router = inject(Router);

  constructor(private http: HttpClient) {}

  async initializePushNotifications(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        return;
      }

      this.addListeners();
      await PushNotifications.register();

      // Effacer un éventuel badge resté collé sur l'icône de l'app
      await this.clearBadge();

      // Lire le token FCM caché par Swift via Capacitor Preferences
      const { value: fcmToken } = await Preferences.get({ key: 'fcmToken' });
      if (fcmToken) {
        await this.sendTokenToBackend(fcmToken);
      }

    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  /**
   * Efface le badge (le "1") sur l'icône de l'app et retire les notifications
   * déjà délivrées du centre de notifications iOS.
   */
  async clearBadge(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    try {
      await PushNotifications.removeAllDeliveredNotifications();
    } catch (error) {
      console.error('Error clearing badge:', error);
    }
  }

  private addListeners(): void {
    PushNotifications.addListener('registration', async (token: Token) => {
      await this.sendTokenToBackend(token.value);
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push registration error:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', async (notification: PushNotificationSchema) => {
      const toast = await this.toastController.create({
        header: notification.title,
        message: notification.body,
        duration: 4000,
        position: 'top',
        color: 'dark',
        buttons: [
          {
            text: 'Voir',
            handler: () => {
              const url = notification.data?.actionUrl;
              if (url) this.router.navigateByUrl(url);
            }
          }
        ]
      });
      await toast.present();
    });

    PushNotifications.addListener('pushNotificationActionPerformed', async (notification: ActionPerformed) => {
      await this.clearBadge();
      const url = notification.notification.data?.actionUrl;
      if (url) this.router.navigateByUrl(url);
    });
  }

  private async sendTokenToBackend(token: string): Promise<void> {
    try {
      await this.http.post(`${this.apiUrl}/api/users/push-token`, {
        pushToken: token,
        platform: Capacitor.getPlatform()
      }).toPromise();
    } catch (error) {
      console.error('Error sending push token to backend:', error);
    }
  }

  async removePushToken(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    try {
      await this.http.delete(`${this.apiUrl}/api/users/push-token`).toPromise();
    } catch (error) {
      console.error('Error removing push token:', error);
    }
  }

  async unregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    await PushNotifications.removeAllListeners();
    await this.removePushToken();
  }
}
