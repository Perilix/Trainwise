import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BackBar, Card, Chip, Icon, Screen, Section, Stat, StateView, Text } from '@/components/ui';
import { useCoachStrengthDone } from '@/features/coach/queries';
import type { DoneBlock, DoneExercise } from '@/features/sessions/strength-done';
import { formatDayShort, formatDecimal, formatHoursMinutes } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

export default function CoachStrengthDoneScreen() {
  const { id, sessionId, from } = useLocalSearchParams<{ id: string; sessionId: string; from?: string }>();
  const { data, loading, error, refetch } = useCoachStrengthDone(id, sessionId, from === 'planned' ? 'planned' : 'session');

  if (!data) {
    return (
      <Screen>
        <BackBar title="Séance réalisée" />
        <StateView loading={loading} error={error ?? (loading ? null : 'Séance introuvable.')} onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackBar title="Séance réalisée" />

      <Section style={styles.titleBlock}>
        <Text variant="small">{formatDayShort(data.date)}</Text>
        <Text variant="h1">Musculation</Text>
      </Section>

      <Section style={styles.tight}>
        <Card style={styles.stats}>
          <Stat label="Durée" value={data.durationMin ? formatHoursMinutes(data.durationMin * 60) : '—'} style={styles.gridCell} />
          <Stat label="Séries" value={String(data.totalSets)} style={styles.gridCell} />
          <Stat label="Volume" value={data.totalVolumeKg ? formatDecimal(data.totalVolumeKg, 0) : '—'} unit="kg" style={styles.gridCell} />
          <Stat label="Ressenti" value={data.feeling ? String(data.feeling) : '—'} unit="/10" style={styles.gridCell} />
        </Card>
      </Section>

      {data.blocks.map((block) => (
        <Section key={block.title} style={styles.tight}>
          <BlockCard block={block} />
        </Section>
      ))}

      {data.notes ? (
        <Section>
          <Card>
            <Text variant="sectionTitle">Notes de l’athlète</Text>
            <Text variant="body2" style={styles.notes}>
              {data.notes}
            </Text>
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

function BlockCard({ block }: { block: DoneBlock }) {
  return (
    <Card>
      <View style={styles.cardHeader}>
        <Text variant="h2">{block.title}</Text>
        {block.meta ? <Chip label={block.meta} tone={block.kind === 'circuit' ? 'accent' : 'violet'} /> : null}
      </View>
      {block.exercises.map((exercise, index) => (
        <ExerciseRow key={exercise.key} exercise={exercise} first={index === 0} />
      ))}
    </Card>
  );
}

function ExerciseRow({ exercise, first }: { exercise: DoneExercise; first: boolean }) {
  const { colors } = useTheme();
  const short = exercise.setsDelta !== undefined && exercise.setsDelta < 0;

  return (
    <View style={[styles.exercise, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <View style={styles.exerciseHeader}>
        <View style={[styles.tile, { backgroundColor: colors.subtle }]}>
          <Icon name="dumbbell" size={18} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="h3">{exercise.name}</Text>
          {exercise.muscle ? <Text variant="small">{exercise.muscle}</Text> : null}
        </View>
        {short ? <Chip label={`${exercise.setsDelta} série${exercise.setsDelta === -1 ? '' : 's'}`} tone="warning" icon="warning" /> : null}
      </View>

      <View style={styles.compare}>
        <View style={styles.flex}>
          <Text variant="overline">Prévu</Text>
          <Text variant="body2" tabular>
            {exercise.targetLabel ?? '—'}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text variant="overline">Réalisé</Text>
          <Text variant="h3" tabular>
            {exercise.doneLabel}
          </Text>
        </View>
      </View>

      <View style={styles.sets}>
        {exercise.sets.map((set, index) => (
          <View key={index} style={[styles.setChip, { borderColor: colors.border, backgroundColor: colors.bg }]}>
            <Text variant="small" color="text3" tabular>
              {index + 1}
            </Text>
            <Text variant="small" tabular>
              {set.reps}
              {set.weight ? ` × ${formatDecimal(set.weight, set.weight % 1 ? 1 : 0)} kg` : ''}
            </Text>
          </View>
        ))}
      </View>

      {exercise.notes ? (
        <Text variant="small" color="text3" style={styles.exerciseNotes}>
          {exercise.notes}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleBlock: { paddingBottom: 16 },
  tight: { paddingBottom: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  gridCell: { width: '50%' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  exercise: { paddingVertical: 12, gap: 10 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  compare: { flexDirection: 'row', gap: 12 },
  sets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  setChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderRadius: radius.sm },
  exerciseNotes: { marginTop: 2 },
  notes: { marginTop: 6 },
});
