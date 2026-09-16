import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text, WorkoutProfile } from '@/components/ui';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

import type { TemplateRow } from './templates';

type Props = {
  row: TemplateRow;
  divided: boolean;
  profileWidth: number;
  /** Action à droite (ex. « Planifier »). */
  action?: ReactNode;
  /** Ouvre la séance type (sans action à droite). */
  onPress?: () => void;
};

// Ligne de séance type : nom, résumé et profil d'intensité.
export function TemplateItem({ row, divided, profileWidth, action, onPress }: Props) {
  const { colors } = useTheme();
  const running = row.sport === 'running';

  const content = (
    <>
      <View style={styles.top}>
        <View style={[styles.tile, { backgroundColor: running ? colors.accentSoft : colors.subtle }]}>
          <Icon name={running ? 'route' : 'dumbbell'} size={18} color={running ? colors.accentInk : colors.primary} />
        </View>
        <View style={styles.text}>
          <Text variant="h3" numberOfLines={1}>
            {row.name}
          </Text>
          {row.meta ? (
            <Text variant="caption" numberOfLines={1}>
              {row.meta}
            </Text>
          ) : null}
        </View>
        {action ?? (onPress ? <Icon name="chevronRight" size={18} color={colors.text3} /> : null)}
      </View>
      {row.segments.length ? (
        <View style={styles.profile}>
          <WorkoutProfile segments={row.segments} width={profileWidth} height={16} gap={1} />
        </View>
      ) : null}
    </>
  );

  const style = [styles.item, divided && { borderTopWidth: 1, borderTopColor: colors.border }];

  if (onPress && !action) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${row.name}. ${row.meta}`} onPress={onPress} style={style}>
        {content}
      </Pressable>
    );
  }

  return (
    <View accessible={!action} accessibilityLabel={`${row.name}. ${row.meta}`} style={style}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { paddingVertical: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  profile: { marginTop: 8, marginLeft: 48 },
});
