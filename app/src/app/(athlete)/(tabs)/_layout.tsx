import { Tabs } from 'expo-router';
import { useEffect } from 'react';

import { TabBar, type TabItem } from '@/components/ui';
import { useChatUnreadCount } from '@/features/athlete/queries';
import { useSocketEvent } from '@/features/realtime/socket-provider';
import { onAppEvent } from '@/lib/app-events';

const ATHLETE_TABS: readonly TabItem[] = [
  { name: 'index', label: 'Accueil', icon: 'home' },
  { name: 'coach', label: 'Coach', icon: 'message' },
  { name: 'planning', label: 'Planning', icon: 'calendar' },
  { name: 'sorties', label: 'Sorties', icon: 'route' },
];

export default function AthleteTabsLayout() {
  const { data: unreadMessages, refetch } = useChatUnreadCount();

  // Pastille des messages : nouveau message reçu, ou conversation lue depuis l'onglet Coach.
  useSocketEvent('message:new', refetch);
  useEffect(() => onAppEvent('chat:read', refetch), [refetch]);

  const items = ATHLETE_TABS.map((item) => (item.name === 'coach' ? { ...item, badge: unreadMessages || undefined } : item));

  return (
    <Tabs tabBar={(props) => <TabBar {...props} items={items} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="coach" />
      <Tabs.Screen name="planning" />
      <Tabs.Screen name="sorties" />
    </Tabs>
  );
}
