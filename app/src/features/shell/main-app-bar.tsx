import { useFocusEffect, useRouter } from 'expo-router';

import { AppBar } from '@/components/ui';
import { initialsOf } from '@/features/athlete/mappers';
import { useUnreadNotificationCount } from '@/features/athlete/queries';
import { isCoach, useSession } from '@/features/auth/session';
import { useSocketEvent } from '@/features/realtime/socket-provider';

// En-tête des onglets : initiales, pastille des notifications non lues, accès au profil (athlète ou coach).
export function MainAppBar() {
  const router = useRouter();
  const { user } = useSession();
  const { data: unread, refetch } = useUnreadNotificationCount();
  const coach = isCoach(user);

  useFocusEffect(refetch);
  useSocketEvent('notification:new', refetch);

  return (
    <AppBar
      initials={initialsOf(user?.firstName, user?.lastName)}
      unreadNotifications={(unread ?? 0) > 0}
      onNotifications={() => router.push(coach ? '/pro/notifications' : '/notifications')}
      onProfile={() => (coach ? router.navigate('/pro/profil') : router.push('/profil'))}
    />
  );
}
