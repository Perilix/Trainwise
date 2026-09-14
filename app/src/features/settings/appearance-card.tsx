import { StyleSheet, View } from 'react-native';

import { Card, Icon, Segmented, Text } from '@/components/ui';
import { useTheme, type ThemePreference } from '@/theme/theme-provider';

// Réglage d'apparence : clair, sombre ou selon le système.
export function AppearanceCard() {
  const { colors, preference, setPreference, scheme } = useTheme();

  return (
    <Card>
      <View style={styles.row}>
        <Icon name={scheme === 'dark' ? 'moon' : 'sun'} size={20} color={colors.text2} />
        <View style={styles.flex}>
          <Text variant="h3">Apparence</Text>
          <Text variant="small">Clair, sombre ou automatique</Text>
        </View>
      </View>
      <Segmented<ThemePreference>
        style={styles.segmented}
        options={[
          { value: 'light', label: 'Clair' },
          { value: 'dark', label: 'Sombre' },
          { value: 'system', label: 'Auto' },
        ]}
        value={preference}
        onChange={setPreference}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  segmented: { marginTop: 12 },
});
