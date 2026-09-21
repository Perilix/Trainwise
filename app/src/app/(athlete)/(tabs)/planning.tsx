import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Icon, Screen, Section, SectionHeader, Stat, Text } from '@/components/ui';
import { activityHref } from '@/features/athlete/activity-link';
import { AthleteAppBar } from '@/features/athlete/athlete-app-bar';
import { useAthleteActions, usePlanningMonth } from '@/features/athlete/queries';
import { SESSION_STATUS_CHIP } from '@/features/athlete/session-status';
import type { Activity, PlannedSession } from '@/features/athlete/types';
import { MonthCalendar } from '@/features/planning/month-calendar';
import { emitAppEvent, onAppEvent } from '@/lib/app-events';
import { formatClock, formatDayLong, formatDecimal, formatHoursMinutes, formatPace, toIsoDay } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

export default function PlanningScreen() {
  const [now] = useState(() => new Date());
  const today = toIsoDay(now);
  const [month, setMonth] = useState({ year: now.getFullYear(), monthIndex: now.getMonth() });
  const [selected, setSelected] = useState(today);
  const { data, loading, error, refetch } = usePlanningMonth(month.year, month.monthIndex);
  const { skipSession } = useAthleteActions();
  const router = useRouter();

  useEffect(() => onAppEvent('sessions:changed', refetch), [refetch]);

  const shiftMonth = (delta: number) =>
    setMonth(({ year, monthIndex }) => {
      const date = new Date(year, monthIndex + delta, 1);
      return { year: date.getFullYear(), monthIndex: date.getMonth() };
    });

  const goToToday = () => {
    setMonth({ year: now.getFullYear(), monthIndex: now.getMonth() });
    setSelected(today);
  };

  const skip = async (id: string) => {
    await skipSession(id).catch(() => undefined);
    emitAppEvent('sessions:changed');
  };

  const sessions = data?.sessionsByDay[selected] ?? [];
  // Séances réalisées du jour (saisies ou importées de Strava) : elles ne sont pas des séances planifiées.
  const activities = data?.activitiesByDay[selected] ?? [];

  return (
    <Screen tabs>
      <AthleteAppBar />

      <Section style={styles.header}>
        <Text variant="h1">Planning</Text>
        <Button label="Aujourd’hui" variant="secondary" size="sm" onPress={goToToday} />
      </Section>

      <Section>
        <MonthCalendar
          year={month.year}
          monthIndex={month.monthIndex}
          month={data}
          selected={selected}
          onSelect={setSelected}
          onShiftMonth={shiftMonth}
          labels={{ coach: 'Coach', athlete: 'Par toi' }}
          loading={loading}
          error={error}
          onRetry={refetch}
        />
      </Section>

      {data ? (
        <>
          <Section>
            <View style={styles.dayHeader}>
              <View style={styles.flex}>
                <Text variant="h2">{formatDayLong(selected)}</Text>
                {selected === today ? <Text variant="small">Aujourd’hui</Text> : null}
              </View>
              <Button label="Ajouter" variant="secondary" size="sm" icon="plus" onPress={() => router.push({ pathname: '/seance/nouvelle', params: { date: selected } })} />
            </View>
            {sessions.length || activities.length ? (
              <View style={styles.sessionList}>
                {sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onSkip={() => skip(session.id)}
                    onOpen={() => router.push({ pathname: '/seance/[id]', params: { id: session.id } })}
                  />
                ))}
                {activities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onPress={() => router.push(activityHref(activity))}
                  />
                ))}
              </View>
            ) : (
              <Card>
                <Text variant="body2">Aucune séance ce jour.</Text>
              </Card>
            )}
          </Section>

          <Section>
            <SectionHeader title="Ce mois" />
            <Card style={styles.monthStats}>
              <Stat label="Planifiées" value={String(data.stats.planned)} style={styles.flex} />
              <Stat label="Effectuées" value={String(data.stats.done)} style={styles.flex} />
              <Stat label="Distance" value={formatDecimal(data.stats.distanceKm, 0)} unit="km" style={styles.flex} />
            </Card>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

function SessionCard({ session, onSkip, onOpen }: { session: PlannedSession; onSkip: () => void; onOpen: () => void }) {
  const byCoach = session.plannedBy === 'coach';
  const status = SESSION_STATUS_CHIP[session.status];
  return (
    <Card>
      <View style={styles.chips}>
        <Chip label={byCoach ? `Planifiée par ${session.coachName ?? 'ton coach'}` : 'Ajoutée par toi'} tone={byCoach ? 'violet' : 'neutral'} icon={byCoach ? 'user' : 'pen'} />
        <Chip label={status.label} tone={status.tone} icon={status.icon} />
      </View>
      <View style={styles.sessionTitle}>
        <Text variant="h2" style={{ fontSize: 17 }}>
          {session.title}
        </Text>
        {session.description ? <Text variant="body2">{session.description}</Text> : null}
      </View>
      <View style={styles.sessionStats}>
        {session.distanceKm ? <Stat label="Distance" value={formatDecimal(session.distanceKm, session.distanceKm % 1 ? 1 : 0)} unit="km" style={styles.flex} /> : null}
        {session.durationMin ? <Stat label="Durée" value={formatHoursMinutes(session.durationMin * 60)} style={styles.flex} /> : null}
        {session.paceSecPerKm ? <Stat label="Allure" value={formatPace(session.paceSecPerKm)} unit="/km" style={styles.flex} /> : null}
        {session.exercisesCount ? <Stat label="Exercices" value={String(session.exercisesCount)} style={styles.flex} /> : null}
      </View>
      {session.status === 'planned' ? (
        <View style={styles.sessionActions}>
          <Button label="Passer" variant="secondary" onPress={onSkip} style={styles.flex} />
          <Button label="Voir" onPress={onOpen} style={styles.flex} />
        </View>
      ) : (
        <Button label="Voir la séance" variant="secondary" fullWidth onPress={onOpen} style={styles.detailButton} />
      )}
    </Card>
  );
}

/** Séance déjà réalisée : saisie dans l'app ou importée de Strava. */
function ActivityCard({ activity, onPress }: { activity: Activity; onPress?: () => void }) {
  const { colors } = useTheme();
  const running = activity.sport === 'running';
  const meta = running
    ? [activity.distanceKm ? `${formatDecimal(activity.distanceKm)} km` : null, formatClock(activity.durationSec), activity.paceSecPerKm ? `${formatPace(activity.paceSecPerKm)} /km` : null]
    : [formatHoursMinutes(activity.durationSec), activity.setsCount ? `${activity.setsCount} séries` : null];

  return (
    <Card onPress={onPress} accessibilityLabel={`${activity.title}, séance réalisée`}>
      <View style={styles.activityRow}>
        <View style={[styles.activityTile, { backgroundColor: colors.accentSoft }]}>
          <Icon name={running ? 'route' : 'dumbbell'} size={19} color={colors.accentInk} strokeWidth={1.9} />
        </View>
        <View style={styles.flex}>
          <Text variant="h3" numberOfLines={1}>
            {activity.title}
          </Text>
          <Text variant="small" tabular numberOfLines={1}>
            {meta.filter(Boolean).join(' · ')}
          </Text>
        </View>
        {activity.fromStrava ? <Chip label="Strava" tone="strava" badge /> : <Chip label="Réalisée" tone="success" badge />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 16 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activityTile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sessionList: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sessionTitle: { gap: 2, marginTop: 10 },
  sessionStats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  sessionActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  monthStats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  detailButton: { marginTop: 16 },
});
