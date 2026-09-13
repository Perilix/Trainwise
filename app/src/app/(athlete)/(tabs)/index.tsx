import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Chip, Divider, Icon, IconButton, Screen, Section, SectionHeader, Stat, StateView, Text } from '@/components/ui';
import { AthleteAppBar } from '@/features/athlete/athlete-app-bar';
import { useAthleteHome } from '@/features/athlete/queries';
import type { Activity, PlannedSession, WeekDay } from '@/features/athlete/types';
import { formatClock, formatDayShort, formatDecimal, formatHoursMinutes, formatPace, formatWeekdayTile, parseDay, WEEKDAY_INITIALS } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

export default function AthleteHomeScreen() {
  const router = useRouter();
  const { data, loading, error, refetch } = useAthleteHome();

  if (!data) {
    return (
      <Screen>
        <AthleteAppBar />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AthleteAppBar />

      <Section style={styles.greeting}>
        <View style={styles.flex}>
          <Text variant="h1">Bonjour, {data.firstName}</Text>
          <Text variant="body2">{data.motto}</Text>
        </View>
        <StreakBadge weeks={data.streakWeeks} />
      </Section>

      {data.today ? (
        <Section>
          <TodayCard session={data.today} onOpen={() => router.push('/planning')} />
        </Section>
      ) : null}

      <Section>
        <SectionHeader title="Cette semaine" actionLabel="Voir tout" onAction={() => router.push('/planning')} />
        <Card style={styles.sectionCard}>
          <WeekStrip days={data.week} />
          <Divider style={styles.divider} />
          <View style={styles.statsRow}>
            <Stat label="Sorties" value={String(data.weekStats.runs)} style={styles.flex} />
            <Stat label="Distance" value={formatDecimal(data.weekStats.distanceKm)} unit="km" style={styles.flex} />
            <Stat label="Temps" value={formatHoursMinutes(data.weekStats.durationSec)} style={styles.flex} />
          </View>
        </Card>
      </Section>

      <Section>
        <SectionHeader title="Prochains entraînements" actionLabel="Planning" onAction={() => router.push('/planning')} />
        <Card padding={0} style={[styles.sectionCard, styles.listCard]}>
          {data.upcoming.map((session, index) => (
            <UpcomingRow key={session.id} session={session} first={index === 0} onPress={() => router.push('/planning')} />
          ))}
        </Card>
      </Section>

      <Section>
        <SectionHeader title="Derniers entraînements" actionLabel="Sorties" onAction={() => router.push('/sorties')} />
        <Card padding={0} style={[styles.sectionCard, styles.listCard]}>
          {data.recent.map((activity, index) => (
            <RecentRow
              key={activity.id}
              activity={activity}
              first={index === 0}
              onPress={activity.sport === 'running' ? () => router.push({ pathname: '/sortie/[id]', params: { id: activity.id } }) : undefined}
            />
          ))}
          {data.strava.connected ? <StravaRow lastSync={data.strava.lastSyncLabel} /> : null}
        </Card>
      </Section>

      {data.coach ? (
        <Section>
          <Card>
            <View style={styles.coachHeader}>
              <Avatar initials={data.coach.initials} size={44} tone="violet" />
              <View style={styles.flex}>
                <Text variant="h3">{data.coach.name}</Text>
                <Text variant="small">Ton coach{data.coach.online ? ' · en ligne' : ''}</Text>
              </View>
              <IconButton icon="message" accessibilityLabel={`Écrire à ${data.coach.name}`} bordered onPress={() => router.push('/coach')} />
            </View>
            {data.coach.lastMessage ? <CoachQuote text={data.coach.lastMessage} /> : null}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

function StreakBadge({ weeks }: { weeks: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel={`Série de ${weeks} semaines`}
      style={[styles.streak, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name="flame" size={16} color={colors.warning} fill={colors.warning} strokeWidth={1.25} />
      <Text variant="h3" tabular style={{ fontSize: 13 }}>
        {weeks} sem.
      </Text>
    </View>
  );
}

function TodayCard({ session, onOpen }: { session: PlannedSession; onOpen: () => void }) {
  const { colors } = useTheme();
  const faded = 'rgba(255, 255, 255, 0.64)';
  const stats = [
    { label: 'Distance', value: session.distanceKm ? formatDecimal(session.distanceKm, 0) : '—', unit: 'km' },
    { label: 'Durée', value: session.durationMin ? formatHoursMinutes(session.durationMin * 60) : '—' },
    { label: 'Allure', value: session.paceSecPerKm ? formatPace(session.paceSecPerKm) : '—', unit: '/km' },
  ];

  return (
    <View style={[styles.today, { backgroundColor: colors.brand }]}>
      <View style={styles.rowBetween}>
        <Text variant="overline" style={{ color: faded }}>
          Aujourd’hui
        </Text>
        {session.plannedBy === 'coach' ? (
          <View style={styles.todayChip}>
            <Icon name="user" size={13} color={colors.highlight} strokeWidth={2} />
            <Text variant="caption" style={{ color: colors.onBrand }}>
              Planifiée par {session.coachName ?? 'ton coach'}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.todayTitle}>
        <Text variant="h2" style={{ color: colors.onBrand, fontSize: 20, lineHeight: 28 }}>
          {session.title}
        </Text>
        {session.description ? <Text style={{ color: 'rgba(255, 255, 255, 0.72)' }}>{session.description}</Text> : null}
      </View>
      <View style={styles.todayStats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.flex}>
            <Text variant="caption" style={{ color: 'rgba(255, 255, 255, 0.6)', fontFamily: fontFamily.regular }}>
              {stat.label}
            </Text>
            <View style={styles.baseline}>
              <Text tabular style={{ color: colors.onBrand, fontFamily: fontFamily.semibold, fontSize: 18, lineHeight: 26 }}>
                {stat.value}
              </Text>
              {stat.unit ? <Text variant="caption" style={{ color: 'rgba(255, 255, 255, 0.6)', fontFamily: fontFamily.regular }}>{stat.unit}</Text> : null}
            </View>
          </View>
        ))}
      </View>
      <Button label="Voir la séance" variant="inverse" fullWidth onPress={onOpen} />
    </View>
  );
}

function WeekStrip({ days }: { days: WeekDay[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.week}>
      {days.map((day, index) => {
        const date = parseDay(day.date);
        const done = day.status === 'done';
        const circle = day.isToday ? { backgroundColor: colors.primary } : done ? { backgroundColor: colors.successSoft } : undefined;
        const numberColor = day.isToday ? colors.onPrimary : done ? colors.successInk : colors.ink;
        const statusLabel = done ? 'effectuée' : day.status === 'planned' ? 'séance prévue' : 'repos';
        return (
          <View key={day.date} style={styles.weekDay} accessible accessibilityLabel={`${formatDayShort(day.date)}, ${statusLabel}`}>
            <Text variant="caption" color="text3">
              {WEEKDAY_INITIALS[index]}
            </Text>
            <View style={[styles.weekCircle, circle]}>
              <Text tabular style={{ color: numberColor, fontFamily: fontFamily.semibold, fontSize: 14 }}>
                {date.getDate()}
              </Text>
            </View>
            <View style={styles.weekMark}>
              {done ? <Icon name="check" size={12} color={colors.successInk} strokeWidth={2.5} /> : null}
              {day.status === 'planned' ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function UpcomingRow({ session, first, onPress }: { session: PlannedSession; first: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const meta =
    session.sport === 'running'
      ? [session.distanceKm ? `${formatDecimal(session.distanceKm, 0)} km` : null, session.paceSecPerKm ? `${formatPace(session.paceSecPerKm)} /km` : null]
      : [session.durationMin ? `${session.durationMin} min` : null, session.exercisesCount ? `${session.exercisesCount} exercices` : null];

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.listRow, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <View style={[styles.dateTile, { backgroundColor: colors.subtle }]}>
        <Text variant="overline" style={{ fontSize: 10, lineHeight: 12 }}>
          {formatWeekdayTile(session.date)}
        </Text>
        <Text tabular style={{ fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 22, color: colors.ink }}>
          {parseDay(session.date).getDate()}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text variant="h3" numberOfLines={1}>
          {session.title}
        </Text>
        <Text variant="small" tabular>
          {meta.filter(Boolean).join(' · ')}
        </Text>
      </View>
      {session.plannedBy === 'coach' ? <Chip label="Coach" tone="violet" icon="user" /> : null}
      <Icon name="chevronRight" size={18} color={colors.text3} />
    </Pressable>
  );
}

function RecentRow({ activity, first, onPress }: { activity: Activity; first: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  const running = activity.sport === 'running';
  const meta = running
    ? [activity.distanceKm ? `${formatDecimal(activity.distanceKm)} km` : null, formatClock(activity.durationSec), activity.paceSecPerKm ? `${formatPace(activity.paceSecPerKm)} /km` : null]
    : [formatHoursMinutes(activity.durationSec), activity.setsCount ? `${activity.setsCount} séries` : null];

  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress} style={[styles.listRow, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <View style={[styles.iconTile, { backgroundColor: running ? colors.accentSoft : colors.subtle }]}>
        <Icon name={running ? 'route' : 'dumbbell'} size={20} color={running ? colors.accentInk : colors.primary} />
      </View>
      <View style={styles.flex}>
        <View style={styles.rowBetween}>
          <Text variant="h3" numberOfLines={1} style={styles.flex}>
            {activity.title}
          </Text>
          {activity.fromStrava ? <Chip label="Strava" tone="strava" /> : null}
        </View>
        <Text variant="small" tabular numberOfLines={1}>
          {[formatDayShort(activity.date), ...meta.filter(Boolean)].join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

function StravaRow({ lastSync }: { lastSync?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stravaRow, { borderTopColor: colors.border }]}>
      <View style={styles.stravaLabel}>
        <View style={[styles.dot, { backgroundColor: colors.success, width: 8, height: 8 }]} />
        <Text variant="small">Strava{lastSync ? ` · synchro ${lastSync}` : ''}</Text>
      </View>
      <Button label="Importer" variant="secondary" size="sm" icon="rotate" />
    </View>
  );
}

function CoachQuote({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.quote, { backgroundColor: colors.bg }]}>
      <Text>« {text} »</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  greeting: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 4, paddingBottom: 20 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingLeft: 9, paddingRight: 11, borderRadius: radius.pill, borderWidth: 1 },
  sectionCard: { marginTop: 12 },
  listCard: { paddingHorizontal: 16 },
  divider: { marginVertical: 14 },
  statsRow: { flexDirection: 'row', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  today: { borderRadius: radius.lg, padding: 18, gap: 14 },
  todayChip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: 'rgba(255, 255, 255, 0.12)' },
  todayTitle: { gap: 4 },
  todayStats: { flexDirection: 'row', gap: 8, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)' },
  week: { flexDirection: 'row', gap: 4 },
  weekDay: { flex: 1, alignItems: 'center', gap: 6 },
  weekCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  weekMark: { height: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  dateTile: { width: 44, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  iconTile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  stravaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 12, paddingBottom: 14, borderTopWidth: 1 },
  stravaLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  coachHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quote: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md },
});
