import { Pressable, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useTheme } from '@/theme/theme-provider';

import { Avatar } from './avatar';
import { BRAND } from './brand-svg';
import { IconButton } from './icon-button';

type Props = {
  initials: string;
  unreadNotifications?: boolean;
  onNotifications?: () => void;
  onProfile?: () => void;
};

// En-tête des écrans principaux : logo, cloche, avatar (plus de bandeau navy).
export function AppBar({ initials, unreadNotifications, onNotifications, onProfile }: Props) {
  const { scheme } = useTheme();
  return (
    <View style={styles.bar}>
      <SvgXml xml={scheme === 'dark' ? BRAND.logoDark : BRAND.logoLight} width={68} height={32} accessibilityLabel="Trainwise" />
      <View style={styles.actions}>
        <IconButton icon="bell" accessibilityLabel="Notifications" badge={unreadNotifications} onPress={onNotifications} />
        <Pressable accessibilityRole="button" accessibilityLabel="Mon profil" onPress={onProfile} hitSlop={5}>
          <Avatar initials={initials} size={34} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 64, paddingLeft: 20, paddingRight: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
