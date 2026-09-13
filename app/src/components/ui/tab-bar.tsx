import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';
import { fontFamily } from '@/theme/typography';

import { Icon, type IconName } from './icon';
import { Text } from './text';

type TabBarRenderProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export type TabItem = { name: string; label: string; icon: IconName; badge?: number };

type Props = TabBarRenderProps & { items: readonly TabItem[] };

// Barre d'onglets claire avec libellés, passée à `tabBar` du composant Tabs d'expo-router.
export function TabBar({ state, navigation, items }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const item = items.find((candidate) => candidate.name === route.name);
        if (!item) return null;
        const focused = state.index === index;
        const tint = focused ? colors.primary : colors.text3;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.badge ? `${item.label}, ${item.badge} non lu` : item.label}
            onPress={onPress}
            style={styles.item}>
            <View>
              <Icon name={item.icon} size={24} color={tint} strokeWidth={focused ? 2 : 1.75} />
              {item.badge ? (
                <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.surface }]}>
                  <Text style={styles.badgeLabel}>{item.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontSize: 11, lineHeight: 14, color: tint, fontFamily: focused ? fontFamily.semibold : fontFamily.medium }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 6, paddingHorizontal: 8 },
  item: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', gap: 4 },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: { color: '#FFFFFF', fontSize: 10, lineHeight: 12, fontFamily: fontFamily.semibold },
});
