import { Tabs } from 'expo-router';
import { useEffect } from 'react';

import { TabBar, type TabItem } from '@/components/ui';
import { useAllChatUnreadCount } from '@/features/athlete/queries';
import { useSocketEvent } from '@/features/realtime/socket-provider';
import { onAppEvent } from '@/lib/app-events';

const COACH_TABS: readonly TabItem[] = [
  { name: 'index', label: 'Accueil', icon: 'home' },
  { name: 'bibliotheque', label: 'Bibliothèque', icon: 'folder' },
  { name: 'messages', label: 'Messages', icon: 'message' },
  { name: 'profil', label: 'Profil', icon: 'user' },
];

export default function CoachTabsLayout() {
  const { data: unreadMessages, refetch } = useAllChatUnreadCount();

  useSocketEvent('message:new', refetch);
  useEffect(() => onAppEvent('chat:read', refetch), [refetch]);

  const items = COACH_TABS.map((item) => (item.name === 'messages' ? { ...item, badge: unreadMessages || undefined } : item));

  return (
    <Tabs tabBar={(props) => <TabBar {...props} items={items} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="bibliotheque" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profil" />
    </Tabs>
  );
}
