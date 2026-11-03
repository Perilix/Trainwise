import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackBar, Button, Card, Chip, Icon, Screen, Section, SectionHeader, Stat, Text } from '@/components/ui';
import { isOtherSport, otherActivityMeta, otherSessionMeta, otherSportIcon, SPORT_LABELS, sportIcon } from '@/features/athlete/other-sports';
import { SESSION_STATUS_CHIP } from '@/features/athlete/session-status';
import type { Activity, OtherActivity, PlannedSession } from '@/features/athlete/types';
import { useAthletePlanning } from '@/features/coach/queries';
import { MonthCalendar } from '@/features/planning/month-calendar';
import { onAppEvent } from '@/lib/app-events';
import { formatClock, formatDayLong, formatDecimal, formatHoursMinutes, formatPace, toIsoDay } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

export default function CoachAthletePlanningScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const [now] = useState(() => new Date());
  const today = toIsoDay(now);
  const [month, setMonth] = useState({ year: now.getFullYear(), monthIndex: now.getMonth() });
  const [selected, setSelected] = useState(today);
  const { data, loading, error, refetch } = useAthletePlanning(id, month.year, month.monthIndex);

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

  const sessions = data?.sessionsByDay[selected] ?? [];
  const activities = data?.activitiesByDay[selected] ?? [];
  const others = data?.othersByDay[selected] ?? [];
  const firstName = name?.split(' ')[0];

  return (
    <Screen>
      <BackBar title={firstName ? `Planning de ${firstName}` : 'Planning'} right={<Button label="Aujourd’hui" variant="ghost" size="sm" onPress={goToToday} />} />

      <Section style={styles.tight}>
        <MonthCalendar
          year={month.year}
          monthIndex={month.monthIndex}
          month={data}
          selected={selected}
          onSelect={setSelected}
          onShiftMonth={shiftMonth}
          labels={{ coach: 'Par vous', athlete: 'Par l’athlète' }}
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
              <Button label="Ajouter" icon="plus" size="sm" onPress={() => router.push({ pathname: '/pro/athletes/[id]/ajouter', params: { id, date: selected, name: firstName } })} />
            </View>
            {sessions.length || activities.length || others.length ? (
              <View style={styles.list}>
                {sessions.map((session) => (
                  <SessionItem key={session.id} session={session} onPress={() => router.push({ pathname: '/pro/athletes/[id]/seance/[planId]', params: { id, planId: session.id } })} />
                ))}
                {activities.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    onPress={() =>
                      activity.sport === 'running'
                        ? router.push({ pathname: '/pro/athletes/[id]/sortie/[runId]', params: { id, runId: activity.id } })
                        : router.push({ pathname: '/pro/athletes/[id]/muscu/[sessionId]', params: { id, sessionId: activity.id } })
                    }
                  />
                ))}
                {others.map((other) => (
                  <OtherItem key={other.id} activity={other} />
                ))}
              </View>
            ) : (
              <Card>
                <Text variant="body2">Rien de prévu ce jour. Ajoutez une séance depuis la bibliothèque ou créez-en une.</Text>
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

function SessionItem({ session, onPress }: { session: PlannedSession; onPress: () => void }) {
  const { colors } = useTheme();
  const byCoach = session.plannedBy === 'coach';
  const status = SESSION_STATUS_CHIP[session.status];
  const meta =
    isOtherSport(session.sport)
      ? [otherSessionMeta(session)]
      : session.sport === 'running'
      ? [
          session.distanceKm ? `${formatDecimal(session.distanceKm, session.distanceKm % 1 ? 1 : 0)} km` : null,
          session.durationMin ? formatHoursMinutes(session.durationMin * 60) : null,
          session.paceSecPerKm ? `${formatPace(session.paceSecPerKm)} /km` : null,
        ]
      : [session.exercisesCount ? `${session.exercisesCount} exercices` : null, session.durationMin ? formatHoursMinutes(session.durationMin * 60) : null];

  return (
    <Card onPress={onPress} accessibilityLabel={`${session.title}, ${status.label}`}>
      <View style={styles.itemRow}>
        <View style={styles.flex}>
          <View style={styles.chips}>
            <Chip label={byCoach ? 'Par vous' : 'Par l’athlète'} tone={byCoach ? 'violet' : 'neutral'} icon={byCoach ? 'user' : 'pen'} />
            <Chip label={status.label} tone={status.tone} icon={status.icon} />
            {isOtherSport(session.sport) ? <Chip label={SPORT_LABELS[session.sport]} tone="accent" icon={sportIcon(session.sport)} /> : null}
          </View>
          <Text variant="h3" style={styles.itemTitle}>
            {session.title}
          </Text>
          {meta.some(Boolean) ? (
            <Text variant="small" tabular>
              {meta.filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        <Icon name="chevronRight" size={18} color={colors.text3} />
      </View>
    </Card>
  );
}

function ActivityItem({ activity, onPress }: { activity: Activity; onPress: () => void }) {
  const { colors } = useTheme();
  const running = activity.sport === 'running';
  const meta = running
    ? [activity.distanceKm ? `${formatDecimal(activity.distanceKm)} km` : null, formatClock(activity.durationSec), activity.paceSecPerKm ? `${formatPace(activity.paceSecPerKm)} /km` : null]
    : [formatHoursMinutes(activity.durationSec), activity.setsCount ? `${activity.setsCount} séries` : null];

  return (
    <Card onPress={onPress} accessibilityLabel={`${activity.title}, séance réalisée`}>
      <View style={styles.itemRow}>
        <View style={[styles.tile, { backgroundColor: running ? colors.accentSoft : colors.subtle }]}>
          <Icon name={running ? 'route' : 'dumbbell'} size={20} color={running ? colors.accentInk : colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="h3" numberOfLines={1}>
            {activity.title}
          </Text>
          <Text variant="small" tabular numberOfLines={1}>
            {meta.filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={styles.activityEnd}>
          <Chip label="Réalisée" tone="success" icon="check" />
          {activity.feeling ? <Text variant="caption">Ressenti {activity.feeling}/10</Text> : null}
        </View>
      </View>
    </Card>
  );
}

/** Vélo, natation… importé de Strava : pas de page de détail, la carte suffit. */
function OtherItem({ activity }: { activity: OtherActivity }) {
  const { colors } = useTheme();
  return (
    <Card accessibilityLabel={`${activity.title}, ${activity.sportLabel}, importée de Strava`}>
      <View style={styles.itemRow}>
        <View style={[styles.tile, { backgroundColor: colors.accentSoft }]}>
          <Icon name={otherSportIcon(activity.family)} size={20} color={colors.accentInk} />
        </View>
        <View style={styles.flex}>
          <Text variant="h3" numberOfLines={1}>
            {activity.title}
          </Text>
          <Text variant="small" tabular numberOfLines={1}>
            {otherActivityMeta(activity) || activity.sportLabel}
          </Text>
        </View>
        <Chip label="Strava" tone="strava" badge />
      </View>
      {activity.description ? (
        <Text variant="body2" style={styles.otherDesc}>
          {activity.description}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tight: { paddingBottom: 16 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  list: { gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  itemTitle: { marginTop: 8 },
  tile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  activityEnd: { alignItems: 'flex-end', gap: 4 },
  monthStats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  otherDesc: { marginTop: 10 },
});
