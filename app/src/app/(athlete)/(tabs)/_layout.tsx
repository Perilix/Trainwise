import { Tabs, useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

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

const HideTabBarContext = createContext<(hidden: boolean) => void>(() => {});

/**
 * Masque la barre d'onglets tant que l'écran a le focus (fil de discussion plein écran).
 * Lié au focus et non au montage : un écran d'onglet reste monté quand on le quitte.
 */
export function useHideTabBar(hidden: boolean) {
  const setHidden = useContext(HideTabBarContext);
  useFocusEffect(
    useCallback(() => {
      setHidden(hidden);
      return () => setHidden(false);
    }, [hidden, setHidden]),
  );
}

export default function AthleteTabsLayout() {
  const { data: unreadMessages, refetch } = useChatUnreadCount();
  const [hidden, setHiddenState] = useState(false);
  const setHidden = useCallback((value: boolean) => setHiddenState(value), []);

  // Pastille des messages : nouveau message reçu, ou conversation lue depuis l'onglet Coach.
  useSocketEvent('message:new', refetch);
  useEffect(() => onAppEvent('chat:read', refetch), [refetch]);

  const items = ATHLETE_TABS.map((item) => (item.name === 'coach' ? { ...item, badge: unreadMessages || undefined } : item));

  return (
    <HideTabBarContext.Provider value={setHidden}>
      <Tabs tabBar={(props) => (hidden ? null : <TabBar {...props} items={items} />)} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="coach" />
        <Tabs.Screen name="planning" />
        <Tabs.Screen name="sorties" />
      </Tabs>
    </HideTabBarContext.Provider>
  );
}
