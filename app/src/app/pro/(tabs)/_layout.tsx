import { Tabs } from 'expo-router';
import { useEffect } from 'react';

import { TabBar, type TabItem } from '@/components/ui';
import { useAllChatUnreadCount } from '@/features/athlete/queries';
import { useSocketEvent } from '@/features/realtime/socket-provider';
import { onAppEvent } from '@/lib/app-events';
import { useIsDesktop } from '@/lib/use-layout';

const COACH_TABS: readonly TabItem[] = [
  { name: 'index', label: 'Accueil', icon: 'home' },
  { name: 'bibliotheque', label: 'Bibliothèque', icon: 'folder' },
  { name: 'stats', label: 'Stats', icon: 'chart' },
  { name: 'messages', label: 'Messages', icon: 'message' },
];

export default function CoachTabsLayout() {
  const desktop = useIsDesktop();
  const { data: unreadMessages, refetch } = useAllChatUnreadCount();

  useSocketEvent('message:new', refetch);
  useEffect(() => onAppEvent('chat:read', refetch), [refetch]);

  const items = COACH_TABS.map((item) => (item.name === 'messages' ? { ...item, badge: unreadMessages || undefined } : item));

  return (
    <Tabs tabBar={(props) => (desktop ? null : <TabBar {...props} items={items} />)} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="bibliotheque" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="messages" />
    </Tabs>
  );
}
