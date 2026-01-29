import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, APP_INITIALIZER, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { SocketService } from './services/socket.service';
import { NotificationService } from './services/notification.service';
import { ChatService } from './services/chat.service';
import { FriendService } from './services/friend.service';
import { provideIonicAngular } from '@ionic/angular/standalone';

// Initialise les services au démarrage pour que les sockets soient prêts
function initializeApp() {
  return () => {
    // Les services sont injectés et initialisés
    const socketService = inject(SocketService);
    const notificationService = inject(NotificationService);
    const chatService = inject(ChatService);
    const friendService = inject(FriendService);

    return Promise.resolve();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      multi: true
    }, provideIonicAngular({
      mode: 'ios',
      _forceStatusbarPadding: false
    })
  ]
};
