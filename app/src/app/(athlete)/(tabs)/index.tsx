import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { Avatar, BRAND, Button, Card, Chip, GlassSurface, Icon, IconButton, Screen, Section, SectionHeader, StateView, Text } from '@/components/ui';
import { AthleteAppBar } from '@/features/athlete/athlete-app-bar';
import { useAthleteHome } from '@/features/athlete/queries';
import { onAppEvent } from '@/lib/app-events';
import type { Activity, PlannedSession, WeekDay } from '@/features/athlete/types';
import { formatClock, formatDayShort, formatDecimal, formatHoursMinutes, formatPace, formatWeekdayTile, parseDay, WEEKDAY_INITIALS } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

export default function AthleteHomeScreen() {
  const router = useRouter();
  const { data, loading, error, refetch } = useAthleteHome();

  useEffect(() => onAppEvent('sessions:changed', refetch), [refetch]);
  useEffect(() => onAppEvent('coach:changed', refetch), [refetch]);

  if (!data) {
    return (
      <Screen tabs>
        <AthleteAppBar />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen tabs>
      <AthleteAppBar />

      <Section style={styles.greeting}>
        <View style={styles.flex}>
          <Text variant="display">Bonjour, {data.firstName} !</Text>
          <Text variant="body2" style={styles.motto}>
            {data.motto}
          </Text>
        </View>
        <StreakBadge weeks={data.streakWeeks} />
      </Section>

      {data.today ? (
        <Section>
          <TodayCard session={data.today} onOpen={() => data.today && router.push({ pathname: '/seance/[id]', params: { id: data.today.id } })} />
        </Section>
      ) : null}

      <Section>
        <SectionHeader title="Cette semaine" actionLabel="Voir tout" onAction={() => router.push('/planning')} />
        <Card padding={12} style={styles.sectionCard}>
          <WeekStrip days={data.week} />
          <Legend />
          <View style={styles.statsRow}>
            <StatTile value={String(data.weekStats.runs)} label="Sorties" />
            <StatTile value={formatDecimal(data.weekStats.distanceKm)} label="km" />
            <StatTile value={formatHoursMinutes(data.weekStats.durationSec)} label="Temps" />
          </View>
        </Card>
      </Section>

      <Section>
        <SectionHeader title="Prochains entraînements" actionLabel="Voir tout" onAction={() => router.push('/planning')} />
        <Card padding={0} style={styles.sectionCard}>
          {data.upcoming.map((session, index) => (
            <UpcomingRow key={session.id} session={session} first={index === 0} onPress={() => router.push({ pathname: '/seance/[id]', params: { id: session.id } })} />
          ))}
        </Card>
      </Section>

      <Section>
        <SectionHeader title="Derniers entraînements" actionLabel="Voir tout" onAction={() => router.push('/sorties')} />
        <Card padding={0} style={styles.sectionCard}>
          {data.recent.map((activity, index) => (
            <RecentRow
              key={activity.id}
              activity={activity}
              first={index === 0}
              onPress={activity.sport === 'running' ? () => router.push({ pathname: '/sortie/[id]', params: { id: activity.id } }) : undefined}
            />
          ))}
          {data.strava.connected ? <StravaRow /> : null}
        </Card>
      </Section>

      {data.coach ? (
        <Section>
          <CoachCard coach={data.coach} onMessage={() => router.push('/coach')} />
        </Section>
      ) : null}
    </Screen>
  );
}

// Signature visuelle : verre renforcé, comme les deux boutons de l'en-tête.
function StreakBadge({ weeks }: { weeks: number }) {
  const { colors } = useTheme();
  return (
    <GlassSurface intensity="strong" radius={18} interactive={false} accessibilityLabel={`Série de ${weeks} semaines`} style={styles.streak}>
      <Icon name="flame" size={22} color={colors.warning} fill={colors.warning} strokeWidth={1.25} />
      <View style={styles.streakValue}>
        <Text variant="stat" tabular style={styles.streakNumber}>
          {weeks}
        </Text>
        <Text variant="overline" style={styles.streakLabel}>
          semaines
        </Text>
      </View>
    </GlassSurface>
  );
}

function TodayCard({ session, onOpen }: { session: PlannedSession; onOpen: () => void }) {
  const { colors } = useTheme();
  const faded = 'rgba(255, 255, 255, 0.7)';
  const stats = [
    { label: 'Distance', value: session.distanceKm ? formatDecimal(session.distanceKm, 0) : '—', unit: 'km' },
    { label: 'Durée', value: session.durationMin ? formatHoursMinutes(session.durationMin * 60) : '—', unit: '' },
    { label: 'Allure', value: session.paceSecPerKm ? formatPace(session.paceSecPerKm) : '—', unit: '/km' },
  ];

  return (
    <View style={[styles.today, { backgroundColor: colors.brand }]}>
      <View style={styles.watermark} pointerEvents="none">
        <SvgXml xml={BRAND.glyph} width={112} height={112} opacity={0.05} />
      </View>

      <View style={styles.rowBetween}>
        <Text variant="overline" style={{ color: colors.highlight }}>
          Aujourd’hui
        </Text>
        {session.plannedBy === 'coach' ? (
          <View style={styles.todayChip}>
            <Icon name="user" size={13} color="#DDD3FF" strokeWidth={2.2} />
            <Text variant="caption" style={styles.todayChipLabel}>
              Planifiée par {session.coachName ?? 'ton coach'}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.todayTitle}>
        <Text variant="h1" style={{ color: colors.onBrand }}>
          {session.title}
        </Text>
        {session.description ? <Text style={{ color: faded }}>{session.description}</Text> : null}
      </View>

      <View style={styles.todayStats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.flex}>
            <Text variant="overline" style={styles.todayStatLabel}>
              {stat.label}
            </Text>
            <View style={styles.baseline}>
              <Text variant="stat" tabular style={{ color: colors.onBrand }}>
                {stat.value}
              </Text>
              {stat.unit ? <Text variant="small" style={{ color: faded }}>{stat.unit}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      <Button label="Voir la séance" variant="accent" shape="pill" icon="arrowRight" iconPosition="trailing" fullWidth onPress={onOpen} />
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
        const planned = day.status === 'planned';
        const statusLabel = done ? 'effectuée' : planned ? 'séance prévue' : 'repos';
        const dot = done ? colors.success : planned ? colors.violet : undefined;
        return (
          <View
            key={day.date}
            accessible
            accessibilityLabel={`${formatDayShort(day.date)}, ${statusLabel}`}
            style={[styles.weekDay, day.isToday && { backgroundColor: colors.accentSoft }]}>
            <Text variant="overline" style={{ color: day.isToday ? colors.accentInk : colors.text2, fontSize: 10.5 }}>
              {WEEKDAY_INITIALS[index]}
            </Text>
            <Text tabular style={[styles.weekNumber, { color: day.isToday ? colors.accentInk : day.status === 'rest' ? colors.text3 : colors.ink }]}>
              {date.getDate()}
            </Text>
            <View style={styles.weekMark}>{dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}</View>
          </View>
        );
      })}
    </View>
  );
}

function Legend() {
  const { colors } = useTheme();
  return (
    <View style={[styles.legend, { borderTopColor: colors.border }]}>
      <View style={styles.legendItem}>
        <View style={[styles.dot, { backgroundColor: colors.success }]} />
        <Text variant="caption">Effectuée</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.dot, { backgroundColor: colors.violet }]} />
        <Text variant="caption">Planifiée coach</Text>
      </View>
    </View>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statTile, { backgroundColor: colors.subtle }]}>
      <Text variant="stat" tabular>
        {value}
      </Text>
      <Text variant="overline" style={styles.statTileLabel}>
        {label}
      </Text>
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
      <View style={styles.dateTile}>
        <Text variant="overline" style={{ color: colors.accentInk, fontSize: 10.5 }}>
          {formatWeekdayTile(session.date)}
        </Text>
        <Text tabular style={[styles.weekNumber, { color: colors.ink, fontSize: 17, lineHeight: 22 }]}>
          {parseDay(session.date).getDate()}
        </Text>
      </View>
      <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
      <View style={styles.flex}>
        <Text variant="h3" numberOfLines={1}>
          {session.title}
        </Text>
        <Text variant="small" tabular>
          {meta.filter(Boolean).join(' · ')}
        </Text>
      </View>
      {session.plannedBy === 'coach' ? <Chip label="Coach" tone="violet" badge /> : <Icon name="chevronRight" size={18} color={colors.text3} />}
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
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.listRow, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <View style={[styles.iconTile, { backgroundColor: colors.accentSoft }]}>
        <Icon name={running ? 'route' : 'dumbbell'} size={19} color={colors.accentInk} strokeWidth={1.9} />
      </View>
      <View style={styles.flex}>
        <Text variant="h3" numberOfLines={1}>
          {activity.title}
        </Text>
        <Text variant="small" tabular numberOfLines={1}>
          {[formatDayShort(activity.date), ...meta.filter(Boolean)].join(' · ')}
        </Text>
      </View>
      {activity.fromStrava ? <Chip label="Strava" tone="strava" badge /> : null}
    </Pressable>
  );
}

// Les sorties publiées sur Strava arrivent d'elles-mêmes (webhook) : pas d'import manuel.
function StravaRow() {
  const { colors } = useTheme();
  return (
    <View style={[styles.stravaRow, { borderTopColor: colors.border }]}>
      <View style={[styles.dot, { backgroundColor: colors.success }]} />
      <Text variant="small">Strava connecté · import automatique</Text>
    </View>
  );
}

function CoachCard({ coach, onMessage }: { coach: NonNullable<ReturnType<typeof useAthleteHome>['data']>['coach']; onMessage: () => void }) {
  const { colors } = useTheme();
  if (!coach) return null;

  return (
    <View style={[styles.coachCard, { backgroundColor: colors.violetSoft, borderColor: colors.violetLine }]}>
      <View style={styles.coachHeader}>
        <View>
          <Avatar initials={coach.initials} size={50} tone="violetSolid" />
          {coach.online ? <View style={[styles.presence, { backgroundColor: colors.success, borderColor: colors.bg }]} /> : null}
        </View>
        <View style={styles.flex}>
          <Text variant="overline" style={{ color: colors.violetInk }}>
            Ta coach{coach.online ? ' · en ligne' : ''}
          </Text>
          <Text variant="h2">{coach.name}</Text>
        </View>
        <IconButton icon="message" accessibilityLabel={`Écrire à ${coach.name}`} bordered onPress={onMessage} />
      </View>
      {coach.lastMessage ? (
        <View style={[styles.quote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text>{coach.lastMessage}</Text>
        </View>
      ) : null}
      <Button label="Envoyer un message" variant="violet" icon="message" fullWidth style={styles.coachButton} onPress={onMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 20 },
  motto: { marginTop: 4 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 11, paddingRight: 13, paddingVertical: 8 },
  streakValue: { alignItems: 'center' },
  streakNumber: { fontSize: 19, lineHeight: 22 },
  streakLabel: { fontSize: 9, letterSpacing: 0.54, marginTop: 2 },
  sectionCard: { marginTop: 12 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statTile: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, gap: 2 },
  statTileLabel: { fontSize: 10, letterSpacing: 0.5 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  today: { borderRadius: radius.xl, padding: 20, gap: 16, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -16, bottom: -18 },
  todayChip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: 'rgba(167, 139, 250, 0.32)' },
  todayChipLabel: { color: '#EFE9FF' },
  todayTitle: { gap: 6 },
  todayStats: { flexDirection: 'row', gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.14)' },
  todayStatLabel: { color: 'rgba(255, 255, 255, 0.55)', fontSize: 10.5 },
  week: { flexDirection: 'row', gap: 3 },
  weekDay: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.md },
  weekNumber: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 21, marginTop: 4 },
  weekMark: { height: 7, marginTop: 6, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowDivider: { width: 1, alignSelf: 'stretch' },
  dateTile: { width: 40, alignItems: 'center' },
  iconTile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  stravaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 1 },
  coachCard: { borderRadius: radius.xl, borderWidth: 1, padding: 18 },
  coachHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  presence: { position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  quote: { marginTop: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderTopLeftRadius: 4, borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  coachButton: { marginTop: 12 },
});
