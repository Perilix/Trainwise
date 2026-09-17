import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton } from './icon-button';
import { Text } from './text';

type Props = {
  title?: string;
  right?: ReactNode;
  onBack?: () => void;
};

export function BackBar({ title, right, onBack }: Props) {
  const router = useRouter();
  return (
    <View style={styles.bar}>
      <IconButton icon="chevronLeft" size={44} glass accessibilityLabel="Retour" onPress={onBack ?? (() => router.back())} />
      <Text variant="h2" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, paddingLeft: 8, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { flex: 1 },
});
