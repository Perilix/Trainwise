import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Divider, IconButton, Screen, Section, SectionHeader, Stat, StateView, Text } from '@/components/ui';
import { AthleteAppBar } from '@/features/athlete/athlete-app-bar';
import { useAthleteActions, usePlanningMonth } from '@/features/athlete/queries';
import { SESSION_STATUS_CHIP } from '@/features/athlete/session-status';
import { emitAppEvent, onAppEvent } from '@/lib/app-events';
import type { CalendarMarker, PlannedSession, PlanningMonth } from '@/features/athlete/types';
import { formatDayLong, formatDecimal, formatHoursMinutes, formatMonthYear, formatPace, toIsoDay, WEEKDAY_INITIALS } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { fontFamily } from '@/theme/typography';

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

  return (
    <Screen>
      <AthleteAppBar />

      <Section style={styles.header}>
        <Text variant="h1">Planning</Text>
        <Button label="Aujourd’hui" variant="secondary" size="sm" onPress={goToToday} />
      </Section>

      <Section>
        <Card style={styles.calendarCard}>
          <View style={styles.monthNav}>
            <IconButton icon="chevronLeft" size={36} accessibilityLabel="Mois précédent" onPress={() => shiftMonth(-1)} />
            <Text variant="h2">{formatMonthYear(month.year, month.monthIndex)}</Text>
            <IconButton icon="chevronRight" size={36} accessibilityLabel="Mois suivant" onPress={() => shiftMonth(1)} />
          </View>
          {data ? (
            <>
              <MonthGrid month={data} selected={selected} onSelect={setSelected} />
              <Divider style={styles.divider} />
              <Legend />
            </>
          ) : (
            <StateView loading={loading} error={error} onRetry={refetch} />
          )}
        </Card>
      </Section>

      {data ? (
        <>
          <Section>
            <View style={styles.dayHeader}>
              <View style={styles.flex}>
                <Text variant="h2">{formatDayLong(selected)}</Text>
                {selected === today ? <Text variant="small">Aujourd’hui</Text> : null}
              </View>
              <Button label="Ajouter" variant="secondary" size="sm" icon="plus" />
            </View>
            {sessions.length ? (
              <View style={styles.sessionList}>
                {sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onSkip={() => skip(session.id)}
                    onOpen={() => router.push({ pathname: '/seance/[id]', params: { id: session.id } })}
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

type Cell = { iso: string; day: number; inMonth: boolean };

function buildCells(year: number, monthIndex: number): Cell[] {
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // lundi en premier
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const count = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(year, monthIndex, 1 - offset + i);
    return { iso: toIsoDay(date), day: date.getDate(), inMonth: date.getMonth() === monthIndex };
  });
}

function MonthGrid({ month, selected, onSelect }: { month: PlanningMonth; selected: string; onSelect: (iso: string) => void }) {
  const { colors } = useTheme();
  const markerColor: Record<CalendarMarker, string> = { done: colors.success, coach: colors.violet, athlete: colors.primary, competition: colors.primary };

  return (
    <View>
      <View style={styles.gridRow}>
        {WEEKDAY_INITIALS.map((initial, index) => (
          <View key={index} style={styles.weekdayCell}>
            <Text variant="caption" color="text3">
              {initial}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {buildCells(month.year, month.monthIndex).map((cell) => {
          const marker = month.markers[cell.iso];
          const isToday = cell.iso === month.today;
          const isSelected = cell.iso === selected;
          const priority = month.competitionPriority[cell.iso];
          const outlined = !isToday && (isSelected || marker === 'competition');
          return (
            <Pressable key={cell.iso} accessibilityRole="button" accessibilityState={{ selected: isSelected }} onPress={() => onSelect(cell.iso)} style={styles.cell}>
              <View style={[styles.dayNumber, isToday && { backgroundColor: colors.primary }, outlined && { borderWidth: 1.5, borderColor: colors.primary }]}>
                <Text
                  tabular
                  style={{ fontSize: 14, fontFamily: isToday ? fontFamily.semibold : fontFamily.medium, color: isToday ? colors.onPrimary : cell.inMonth ? colors.ink : colors.text3 }}>
                  {cell.day}
                </Text>
              </View>
              <View style={styles.markerSlot}>
                {priority ? (
                  <Text style={{ fontSize: 10, lineHeight: 10, fontFamily: fontFamily.bold, color: colors.primary }}>{priority}</Text>
                ) : marker && cell.inMonth ? (
                  <View style={[styles.marker, { backgroundColor: markerColor[marker] }]} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Legend() {
  const { colors } = useTheme();
  const items = [
    { color: colors.success, label: 'Effectuée' },
    { color: colors.violet, label: 'Coach' },
    { color: colors.primary, label: 'Par toi' },
  ];
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text variant="caption">{item.label}</Text>
        </View>
      ))}
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { borderWidth: 1.5, borderColor: colors.primary }]} />
        <Text variant="caption">Compétition</Text>
      </View>
    </View>
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
          <Button label="Détailler" onPress={onOpen} style={styles.flex} />
        </View>
      ) : (
        <Button label="Voir le détail" variant="secondary" fullWidth onPress={onOpen} style={styles.detailButton} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 16 },
  calendarCard: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  gridRow: { flexDirection: 'row' },
  weekdayCell: { width: `${100 / 7}%`, height: 28, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 50, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dayNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  markerSlot: { height: 8, alignItems: 'center', justifyContent: 'center' },
  marker: { width: 6, height: 6, borderRadius: 3 },
  divider: { marginTop: 10, marginBottom: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  sessionList: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sessionTitle: { gap: 2, marginTop: 10 },
  sessionStats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  sessionActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  monthStats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  detailButton: { marginTop: 16 },
});
