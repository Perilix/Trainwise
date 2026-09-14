import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { BackBar, Button, Card, Chip, Icon, Screen, Section, Stat, StateView, Text, WorkoutProfile } from '@/components/ui';
import { useAthleteActions, usePlannedSession } from '@/features/athlete/queries';
import { SESSION_STATUS_CHIP } from '@/features/athlete/session-status';
import type { PlanExercise, RunBlockView, StrengthPlanView } from '@/features/athlete/types';
import { emitAppEvent } from '@/lib/app-events';
import { formatDayLong, formatDecimal, formatHoursMinutes, formatPace } from '@/lib/format';
import { formatDuration, intensityColor, totals } from '@/lib/sessions';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';

export default function PlannedSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data: session, loading, error, refetch } = usePlannedSession(id);
  const { skipSession, completeSession, reopenSession } = useAthleteActions();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!session) {
    return (
      <Screen>
        <BackBar />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      emitAppEvent('sessions:changed');
      refetch();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  };

  const running = session.sport === 'running';
  const byCoach = session.plannedBy === 'coach';
  const status = SESSION_STATUS_CHIP[session.status];
  const linkedRunId = session.linkedRunId;
  const totalSec = totals(session.segments).sec;

  let footer: React.ReactNode;
  if (session.status === 'planned') {
    footer = (
      <View style={styles.footer}>
        {actionError ? (
          <Text variant="small" color="danger">
            {actionError}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button label="Passer" variant="secondary" disabled={busy} onPress={() => act(() => skipSession(session.id))} style={styles.flex} />
          {running ? (
            <Button label="Séance faite" icon="check" disabled={busy} onPress={() => act(() => completeSession(session.id))} style={styles.flex} />
          ) : (
            <Button label="Commencer" icon="dumbbell" disabled={busy} onPress={() => router.push({ pathname: '/muscu/[id]', params: { id: session.id } })} style={styles.flex} />
          )}
        </View>
      </View>
    );
  } else if (session.status === 'skipped') {
    footer = (
      <View style={styles.footer}>
        <Button label="Remettre à faire" variant="secondary" icon="rotate" fullWidth disabled={busy} onPress={() => act(() => reopenSession(session.id))} />
      </View>
    );
  } else if (linkedRunId) {
    footer = (
      <View style={styles.footer}>
        <Button label="Voir la sortie" icon="route" fullWidth onPress={() => router.push({ pathname: '/sortie/[id]', params: { id: linkedRunId } })} />
      </View>
    );
  }

  return (
    <Screen footer={footer}>
      <BackBar />

      <Section style={styles.titleBlock}>
        <Text variant="small">{formatDayLong(session.date)}</Text>
        <Text variant="h1">{session.title}</Text>
        <View style={styles.chips}>
          <Chip label={byCoach ? `Planifiée par ${session.coachName ?? 'ton coach'}` : 'Ajoutée par toi'} tone={byCoach ? 'violet' : 'neutral'} icon={byCoach ? 'user' : 'pen'} />
          <Chip label={status.label} tone={status.tone} icon={status.icon} />
        </View>
      </Section>

      <Section style={styles.tight}>
        <Card style={styles.stats}>
          {running ? (
            <>
              <Stat label="Distance" value={session.distanceKm ? formatDecimal(session.distanceKm, session.distanceKm % 1 ? 1 : 0) : '—'} unit="km" style={styles.flex} />
              <Stat label="Durée" value={session.durationMin ? formatHoursMinutes(session.durationMin * 60) : '—'} style={styles.flex} />
              <Stat label="Allure" value={session.paceSecPerKm ? formatPace(session.paceSecPerKm) : '—'} unit="/km" style={styles.flex} />
            </>
          ) : (
            <>
              <Stat label="Exercices" value={session.exercisesCount ? String(session.exercisesCount) : '—'} style={styles.flex} />
              <Stat label="Durée" value={session.durationMin ? formatHoursMinutes(session.durationMin * 60) : '—'} style={styles.flex} />
            </>
          )}
        </Card>
      </Section>

      {session.description ? (
        <Section style={styles.tight}>
          <Card>
            <Text variant="h2">Consignes</Text>
            <Text variant="body2" style={styles.paragraph}>
              {session.description}
            </Text>
          </Card>
        </Section>
      ) : null}

      {session.blocks.length ? (
        <Section style={styles.tight}>
          <Card>
            <View style={styles.cardHeader}>
              <Text variant="h2">Déroulé</Text>
              {totalSec ? (
                <Text variant="small" tabular>
                  ≈ {formatDuration(totalSec)}
                </Text>
              ) : null}
            </View>
            <View style={styles.profile}>
              <WorkoutProfile segments={session.segments} width={width - layout.gutter * 2 - 32} height={56} />
            </View>
            {session.blocks.map((block, index) => (
              <BlockRow key={block.key} block={block} first={index === 0} />
            ))}
          </Card>
        </Section>
      ) : null}

      {running && !session.blocks.length && session.textPlan.length ? (
        <Section style={styles.tight}>
          <Card>
            <Text variant="h2">Déroulé</Text>
            {session.textPlan.map((item) => (
              <View key={item.label} style={styles.textPlanItem}>
                <Text variant="overline">{item.label}</Text>
                <Text variant="body2">{item.text}</Text>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      {session.strength ? <StrengthPlanCards plan={session.strength} /> : null}
    </Screen>
  );
}

function BlockRow({ block, first }: { block: RunBlockView; first: boolean }) {
  const { colors, ramp } = useTheme();
  const peak = Math.max(...block.steps.map((step) => step.pct));
  const single = block.steps.length === 1 ? block.steps[0] : null;

  return (
    <View style={[styles.block, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <View style={[styles.blockBar, { backgroundColor: intensityColor(peak, ramp) }]} />
      <View style={styles.flex}>
        <View style={styles.rowBetween}>
          <Text variant="overline">{block.roleLabel}</Text>
          {block.durationSec ? (
            <Text variant="caption" color="text3" tabular>
              {formatDuration(block.durationSec)}
            </Text>
          ) : null}
        </View>
        {single ? (
          <Text variant="h3" style={styles.stepTitle}>
            {block.repetitions > 1 ? `${block.repetitions} × ` : ''}
            {single.label}
            {single.paceLabel ? <Text variant="h3" color="accentInk">{` · ${single.paceLabel}`}</Text> : null}
          </Text>
        ) : (
          <View style={styles.group}>
            {block.repetitions > 1 ? <Text variant="h3">{`${block.repetitions} × la série`}</Text> : null}
            {block.steps.map((step) => (
              <View key={step.key} style={[styles.groupStep, { borderLeftColor: colors.border }]}>
                <Text>
                  {step.label}
                  {step.paceLabel ? <Text color="accentInk">{` · ${step.paceLabel}`}</Text> : null}
                </Text>
                {step.recoveryLabel ? <Text variant="small">{step.recoveryLabel}</Text> : null}
                {step.note ? <Text variant="small">{step.note}</Text> : null}
              </View>
            ))}
          </View>
        )}
        {block.recoveryLabel ? (
          <Text variant="small" style={styles.detail}>
            {block.recoveryLabel}
          </Text>
        ) : null}
        {block.note ? (
          <Text variant="small" style={styles.detail}>
            {block.note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function StrengthPlanCards({ plan }: { plan: StrengthPlanView }) {
  const { superset, circuit } = plan;
  return (
    <>
      {plan.exercises.length ? (
        <Section style={styles.tight}>
          <Card>
            <Text variant="h2">Exercices</Text>
            {plan.exercises.map((exercise, index) => (
              <ExerciseRow key={exercise.key} exercise={exercise} first={index === 0} showSets />
            ))}
          </Card>
        </Section>
      ) : null}

      {superset ? (
        <Section style={styles.tight}>
          <Card>
            <View style={styles.cardHeader}>
              <Text variant="h2">{superset.name ?? 'Super-set'}</Text>
              <Chip label={`${superset.sets} séries · repos ${formatDuration(superset.restBetweenSetsSec)}`} tone="violet" />
            </View>
            {superset.pairs.map((pair, pairIndex) => (
              <View key={pairIndex}>
                {pair.a ? <ExerciseRow exercise={pair.a} first={pairIndex === 0} prefix={`${pairIndex + 1}A`} /> : null}
                {pair.b ? <ExerciseRow exercise={pair.b} first={pairIndex === 0 && !pair.a} prefix={`${pairIndex + 1}B`} /> : null}
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      {circuit ? (
        <Section style={styles.tight}>
          <Card>
            <View style={styles.cardHeader}>
              <Text variant="h2">{circuit.name ?? 'Circuit'}</Text>
              <Chip label={`${circuit.rounds} tours · repos ${formatDuration(circuit.restBetweenRoundsSec)}`} tone="accent" />
            </View>
            {circuit.exercises.map((exercise, index) => (
              <ExerciseRow key={exercise.key} exercise={exercise} first={index === 0} />
            ))}
          </Card>
        </Section>
      ) : null}
    </>
  );
}

function ExerciseRow({ exercise, first, prefix, showSets }: { exercise: PlanExercise; first: boolean; prefix?: string; showSets?: boolean }) {
  const { colors } = useTheme();
  const volume = showSets && exercise.sets && exercise.reps ? `${exercise.sets} × ${exercise.reps}` : exercise.reps;
  const meta = [
    volume,
    exercise.weight ? `${formatDecimal(exercise.weight, exercise.weight % 1 ? 1 : 0)} kg` : null,
    exercise.rest ? `récup ${exercise.rest}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.exerciseRow, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <View style={[styles.exerciseTile, { backgroundColor: colors.subtle }]}>
        {prefix ? <Text variant="h3">{prefix}</Text> : <Icon name="dumbbell" size={18} color={colors.primary} />}
      </View>
      <View style={styles.flex}>
        <Text variant="h3">{exercise.name}</Text>
        <Text variant="small" tabular>
          {[exercise.muscle, meta].filter(Boolean).join(' · ')}
        </Text>
        {exercise.notes ? (
          <Text variant="small" color="text3">
            {exercise.notes}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleBlock: { paddingBottom: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tight: { paddingBottom: 12 },
  stats: { flexDirection: 'row', gap: 8 },
  paragraph: { marginTop: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  profile: { marginTop: 14, marginBottom: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  block: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  blockBar: { width: 4, borderRadius: 2 },
  stepTitle: { marginTop: 2 },
  group: { gap: 6, marginTop: 4 },
  groupStep: { borderLeftWidth: 2, paddingLeft: 10 },
  detail: { marginTop: 2 },
  textPlanItem: { gap: 2, marginTop: 12 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  exerciseTile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  footer: { gap: 8, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
  actions: { flexDirection: 'row', gap: 8 },
});
