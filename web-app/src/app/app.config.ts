import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, APP_INITIALIZER, inject, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { SocketService } from './services/socket.service';
import { NotificationService } from './services/notification.service';
import { ChatService } from './services/chat.service';
import { FriendService } from './services/friend.service';

// L'app est francophone : les pipes date et number suivent, au lieu de rester
// sur l'anglais par défaut d'Angular (« 04 Oct », « 1208 »).
registerLocaleData(localeFr);

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
    { provide: LOCALE_ID, useValue: 'fr' },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      multi: true
    }
  ]
};
