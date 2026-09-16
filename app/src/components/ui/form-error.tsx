import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

import { Icon } from './icon';
import { Text } from './text';

type Props = {
  message: string | null;
  style?: StyleProp<ViewStyle>;
};

// Message d'erreur d'un formulaire, annoncé aux lecteurs d'écran.
export function FormError({ message, style }: Props) {
  const { colors } = useTheme();
  if (!message) return null;

  return (
    <View accessibilityRole="alert" style={[styles.box, { backgroundColor: colors.dangerSoft }, style]}>
      <Icon name="warning" size={18} color={colors.danger} />
      <Text variant="small" color="danger" style={styles.text}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md },
  text: { flex: 1 },
});
