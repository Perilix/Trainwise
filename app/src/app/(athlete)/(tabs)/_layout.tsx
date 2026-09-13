import { Tabs } from 'expo-router';

import { TabBar, type TabItem } from '@/components/ui';

const ATHLETE_TABS: readonly TabItem[] = [
  { name: 'index', label: 'Accueil', icon: 'home' },
  { name: 'coach', label: 'Coach', icon: 'message', badge: 1 },
  { name: 'planning', label: 'Planning', icon: 'calendar' },
  { name: 'sorties', label: 'Sorties', icon: 'route' },
];

export default function AthleteTabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} items={ATHLETE_TABS} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="coach" />
      <Tabs.Screen name="planning" />
      <Tabs.Screen name="sorties" />
    </Tabs>
  );
}
