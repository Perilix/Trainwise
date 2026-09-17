import { BlurView } from 'expo-blur';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, Icon, Text } from '@/components/ui';
import type { PlannedSession } from '@/features/athlete/types';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { formatDayShort, formatDecimal, formatHoursMinutes, formatPace, toIsoDay } from '@/lib/format';

import { useAthletePlanning } from './queries';

type Props = {
  athleteId: string;
  visible: boolean;
  onClose: () => void;
  onPick: (session: PlannedSession) => void;
};

export const citedMeta = (session: PlannedSession) =>
  (session.sport === 'running'
    ? [session.distanceKm ? `${formatDecimal(session.distanceKm)} km` : null, session.durationMin ? formatHoursMinutes(session.durationMin * 60) : null, session.paceSecPerKm ? `${formatPace(session.paceSecPerKm)} /km` : null]
    : [session.exercisesCount ? `${session.exercisesCount} exercices` : null, session.durationMin ? formatHoursMinutes(session.durationMin * 60) : null]
  )
    .filter(Boolean)
    .join(' · ');

/** Choix d'une séance du planning de l'athlète, à citer dans la conversation. */
export function CiteSessionModal({ athleteId, visible, onClose, onPick }: Props) {
  const { colors, scheme } = useTheme();
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const current = useAthletePlanning(athleteId, now.getFullYear(), now.getMonth());
  const following = useAthletePlanning(athleteId, nextMonth.getFullYear(), nextMonth.getMonth());

  const today = toIsoDay(now);
  // À partir d'aujourd'hui : on cite une séance à venir, pas une séance passée.
  // Dédoublonné par identifiant : les deux mois se recouvrent en fin de mois.
  const byId = new Map(
    [current.data, following.data]
      .flatMap((month) => Object.values(month?.sessionsByDay ?? {}).flat())
      .filter((session) => session.date >= today)
      .map((session) => [session.id, session] as const),
  );
  const sessions = [...byId.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 20);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <BlurView intensity={40} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Pressable accessibilityLabel="Fermer" style={styles.flex} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="h2">Citer une séance</Text>
          <Text variant="small">Elle s’affichera dans la conversation avec son déroulé.</Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {sessions.length ? (
              sessions.map((session) => (
                <Pressable
                  key={session.id}
                  accessibilityRole="button"
                  onPress={() => onPick(session)}
                  style={({ pressed }) => [styles.row, { borderColor: colors.border }, pressed && { backgroundColor: colors.subtle }]}>
                  <View style={[styles.tile, { backgroundColor: session.sport === 'strength' ? colors.subtle : colors.accentSoft }]}>
                    <Icon name={session.sport === 'strength' ? 'dumbbell' : 'route'} size={18} color={session.sport === 'strength' ? colors.primary : colors.accentInk} />
                  </View>
                  <View style={styles.flex}>
                    <Text variant="h3" numberOfLines={1}>
                      {session.title}
                    </Text>
                    <Text variant="small" tabular numberOfLines={1}>
                      {[formatDayShort(session.date), citedMeta(session)].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {session.plannedBy === 'coach' ? <Chip label="Vous" tone="violet" badge /> : null}
                </Pressable>
              ))
            ) : (
              <Text variant="body2">Aucune séance à venir dans le planning de cet athlète.</Text>
            )}
          </ScrollView>

          <Button label="Fermer" variant="secondary" fullWidth onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, zIndex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { zIndex: 1, gap: 6, borderTopWidth: 1, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingBottom: 28 },
  list: { maxHeight: 360 },
  listContent: { gap: 8, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderRadius: radius.md },
  tile: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
