import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

import { GlassSurface } from './glass-surface';
import { Icon, type IconName } from './icon';
import { Text } from './text';

type TabBarRenderProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export type TabItem = { name: string; label: string; icon: IconName; badge?: number };

type Props = TabBarRenderProps & { items: readonly TabItem[] };

// Hauteur occupée par la barre flottante : sert de padding bas aux écrans (cf. Screen).
export const TAB_BAR_HEIGHT = 66;
export const TAB_BAR_MARGIN = 16;

// Barre flottante en verre posée sur le fond de la page ; onglet actif en pastille `subtle`, jamais en bleu.
export function TabBar({ state, navigation, items }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <GlassSurface
      radius={radius.pill}
      interactive={false}
      style={[styles.bar, { bottom: Math.max(insets.bottom, 16), left: TAB_BAR_MARGIN, right: TAB_BAR_MARGIN }]}>
      {state.routes.map((route, index) => {
        const item = items.find((candidate) => candidate.name === route.name);
        if (!item) return null;
        const focused = state.index === index;
        const tint = focused ? colors.ink : colors.text3;

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
            <View style={[styles.pill, focused && { backgroundColor: colors.subtle }]}>
              <View>
                <Icon name={item.icon} size={24} color={tint} strokeWidth={focused ? 2.2 : 2} />
                {item.badge ? (
                  <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                    <Text style={styles.badgeLabel}>{item.badge > 99 ? '99+' : item.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontSize: 11, lineHeight: 14, color: tint, fontFamily: focused ? fontFamily.bold : fontFamily.medium }}>{item.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', height: TAB_BAR_HEIGHT, flexDirection: 'row', padding: 7 },
  item: { flex: 1 },
  pill: { flex: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', gap: 3 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -11,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: { color: '#FFFFFF', fontSize: 10, lineHeight: 12, fontFamily: fontFamily.semibold },
});
