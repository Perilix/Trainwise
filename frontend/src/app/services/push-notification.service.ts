import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
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

  /**
   * Initialise les notifications push
   * À appeler au démarrage de l'app (après login)
   */
  async initializePushNotifications(): Promise<void> {
    // Vérifier si on est sur une plateforme native
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications are not available on web');
      return;
    }

    try {
      // Demander la permission
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('Push notification permission not granted');
        return;
      }

      // S'enregistrer pour recevoir les notifications
      await PushNotifications.register();

      // Écouter les événements
      this.addListeners();

    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  /**
   * Ajoute les listeners pour les événements de notifications
   */
  private addListeners(): void {
    // Appelé quand l'enregistrement réussit et qu'on reçoit le token
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('Push registration success, token:', token.value);
      await this.sendTokenToBackend(token.value);
    });

    // Appelé en cas d'erreur d'enregistrement
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error on registration:', error);
    });

    // Appelé quand une notification est reçue (app en premier plan)
    PushNotifications.addListener('pushNotificationReceived', async (notification: PushNotificationSchema) => {
      console.log('Push notification received:', notification);
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

    // Appelé quand l'utilisateur clique sur une notification (app en arrière-plan)
    PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      console.log('Push notification action performed:', notification);
      const url = notification.notification.data?.actionUrl;
      if (url) this.router.navigateByUrl(url);
    });
  }

  /**
   * Envoie le token au backend pour le stocker
   */
  private async sendTokenToBackend(token: string): Promise<void> {
    try {
      await this.http.post(`${this.apiUrl}/api/users/push-token`, {
        pushToken: token,
        platform: Capacitor.getPlatform()
      }).toPromise();
      console.log('Push token sent to backend');
    } catch (error) {
      console.error('Error sending push token to backend:', error);
    }
  }

  /**
   * Supprime le token lors de la déconnexion
   */
  async removePushToken(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await this.http.delete(`${this.apiUrl}/api/users/push-token`).toPromise();
      console.log('Push token removed from backend');
    } catch (error) {
      console.error('Error removing push token:', error);
    }
  }

  /**
   * Désactive les notifications push
   */
  async unregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    await PushNotifications.removeAllListeners();
    await this.removePushToken();
  }
}
