import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

import { Button } from './button';
import { Icon } from './icon';
import { Text } from './text';

type Props = {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
};

// Contenu d'un écran en attente de ses données : chargement ou erreur avec nouvel essai.
export function StateView({ loading, error, onRetry }: Props) {
  const { colors } = useTheme();

  if (error) {
    return (
      <View style={styles.center}>
        <Icon name="warning" size={28} color={colors.text3} />
        <Text variant="h3">Chargement impossible</Text>
        <Text variant="small" style={styles.message}>
          {error}
        </Text>
        {onRetry ? <Button label="Réessayer" variant="secondary" size="sm" onPress={onRetry} style={styles.retry} /> : null}
      </View>
    );
  }

  return <View style={styles.center}>{loading ? <ActivityIndicator color={colors.text3} accessibilityLabel="Chargement" /> : null}</View>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 32, paddingVertical: 80 },
  message: { textAlign: 'center' },
  retry: { marginTop: 10 },
});
