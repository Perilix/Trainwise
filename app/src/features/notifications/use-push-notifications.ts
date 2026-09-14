import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api';

import { routeForActionUrl } from './action-routes';
import { getExpoPushToken, PUSH_SUPPORTED } from './push';

/** Enregistre l'appareil auprès de l'API une fois connecté et ouvre l'écran lié à une notification touchée. */
export function usePushNotifications() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status !== 'signedIn') return;
    let cancelled = false;
    getExpoPushToken()
      .then((pushToken) => {
        if (cancelled || !pushToken) return;
        return api('/api/users/push-token', { method: 'POST', body: { pushToken, platform: Platform.OS } });
      })
      .catch((error: unknown) => console.warn('[push] Enregistrement impossible', error));
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (!PUSH_SUPPORTED) return;
    const open = (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const actionUrl = response.notification.request.content.data?.actionUrl;
      const route = routeForActionUrl(typeof actionUrl === 'string' ? actionUrl : undefined);
      if (route) router.push(route);
    };
    // App lancée depuis une notification, puis notifications touchées pendant l'utilisation.
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [router]);
}
