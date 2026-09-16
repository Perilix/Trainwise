import { Pressable, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

import { BRAND } from './brand-svg';
import { GlassSurface } from './glass-surface';
import { Icon } from './icon';
import { Text } from './text';

type Props = {
  initials: string;
  unreadNotifications?: boolean;
  onNotifications?: () => void;
  onProfile?: () => void;
};

const BUTTON = 44;

// En-tête des écrans racine : avatar en verre à gauche, logo centré, cloche en verre à droite.
// Pas de bandeau : le fond de la page remonte jusqu'à la barre d'état (cf. docs/design-system.md § 6.1).
export function AppBar({ initials, unreadNotifications, onNotifications, onProfile }: Props) {
  const { scheme, colors } = useTheme();
  return (
    <View style={styles.bar}>
      <GlassButton accessibilityLabel="Mon profil" onPress={onProfile}>
        <Text style={[styles.initials, { color: colors.ink }]}>{initials}</Text>
      </GlassButton>

      <SvgXml xml={scheme === 'dark' ? BRAND.logoDark : BRAND.logoLight} width={88} height={41} accessibilityLabel="Trainwise" />

      <GlassButton accessibilityLabel="Notifications" onPress={onNotifications}>
        <Icon name="bell" size={22} color={colors.ink} strokeWidth={1.9} />
        {unreadNotifications ? <View style={[styles.badge, { backgroundColor: colors.danger }]} /> : null}
      </GlassButton>
    </View>
  );
}

function GlassButton({ children, accessibilityLabel, onPress }: { children: React.ReactNode; accessibilityLabel: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <GlassSurface intensity="strong" radius={radius.pill} style={styles.button}>
        {children}
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: { width: BUTTON, height: BUTTON, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20 },
  badge: { position: 'absolute', top: 11, right: 12, width: 9, height: 9, borderRadius: 5 },
  pressed: { transform: [{ scale: 0.96 }] },
});
