import { useFocusEffect, useRouter } from 'expo-router';

import { AppBar } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { useSocketEvent } from '@/features/realtime/socket-provider';

import { initialsOf } from './mappers';
import { useUnreadNotificationCount } from './queries';

// En-tête des onglets athlète : initiales de l'utilisateur et pastille des notifications non lues.
export function AthleteAppBar() {
  const router = useRouter();
  const { user } = useSession();
  const { data: unread, refetch } = useUnreadNotificationCount();

  useFocusEffect(refetch);
  useSocketEvent('notification:new', refetch);

  return (
    <AppBar
      initials={initialsOf(user?.firstName, user?.lastName)}
      unreadNotifications={(unread ?? 0) > 0}
      onNotifications={() => router.push('/notifications')}
      onProfile={() => router.push('/profil')}
    />
  );
}
