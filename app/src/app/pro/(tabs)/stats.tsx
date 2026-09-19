import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, avatarToneFor, Button, Card, Chip, Icon, Screen, Section, SectionHeader, Segmented, StateView, Text } from '@/components/ui';
import { useCoachActions, useCoachHome, useInviteOverview, useWeeklyStats } from '@/features/coach/queries';
import { ATHLETE_STATUS_STYLE } from '@/features/coach/status';
import { MainAppBar } from '@/features/shell/main-app-bar';
import { emitAppEvent, onAppEvent } from '@/lib/app-events';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

const PERIODS = [
  { value: '8', label: '8 sem.' },
  { value: '13', label: '3 mois' },
  { value: '26', label: '6 mois' },
] as const;

/**
 * Stats : l'activité du coach, et surtout ce qui attend une réponse.
 * Les demandes et les invitations vivaient sur l'accueil, où elles poussaient
 * la liste des athlètes vers le bas ; elles sont ici, comme sur le web.
 */
export default function CoachStatsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [weeks, setWeeks] = useState<(typeof PERIODS)[number]['value']>('8');

  const { data: home, loading, error, refetch } = useCoachHome();
  const { data: invite, refetch: refetchInvite } = useInviteOverview();
  const { data: weekly } = useWeeklyStats(Number(weeks));
  const { respondToRequest } = useCoachActions();
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(
    () =>
      onAppEvent('athletes:changed', () => {
        refetch();
        refetchInvite();
      }),
    [refetch, refetchInvite],
  );

  if (!home) {
    return (
      <Screen tabs>
        <MainAppBar />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const series = weekly?.weeks ?? [];
  const top = Math.max(1, ...series.map((week) => Math.max(week.planned, week.done)));
  const hasBars = series.some((week) => week.planned || week.done);
  const currentWeek = series.length ? series[series.length - 1] : null;

  // Ceux qui ne sont ni en forme ni à jour : c'est là que le coach doit regarder.
  const watch = home.athletes.filter((athlete) => athlete.status !== 'green');
  const pending = invite?.pending ?? [];

  const respond = async (id: string, accept: boolean) => {
    setBusyId(id);
    try {
      await respondToRequest(id, accept);
      emitAppEvent('athletes:changed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen tabs>
      <MainAppBar />

      <Section style={styles.heading}>
        <Text variant="h1">Stats</Text>
        <Text variant="body2">Votre activité, et ce qui attend une réponse.</Text>
      </Section>

      <Section style={styles.tight}>
        <Card padding={12}>
          <View style={styles.kpis}>
            <Kpi label="Athlètes" value={String(home.stats.athletes)} />
            <Kpi label="Séances / sem." value={String(currentWeek?.planned ?? home.stats.sessionsThisWeek)} />
            <Kpi label="Réalisation" value={weekly ? `${weekly.completionRate} %` : '—'} />
            <Kpi label="Planifiées" value={weekly ? String(weekly.totals.planned) : '—'} />
          </View>
        </Card>
      </Section>

      <Section style={styles.tight}>
        <SectionHeader title="Planifié et réalisé" />
        <Segmented options={PERIODS} value={weeks} onChange={setWeeks} style={styles.segmented} />
        <Card style={styles.chartCard}>
          {hasBars ? (
            <>
              <View style={styles.chart}>
                {series.map((week) => (
                  <View key={week.label} style={styles.slot}>
                    <View style={styles.pair}>
                      <View style={[styles.bar, { backgroundColor: colors.subtle, height: `${(week.planned / top) * 100}%` }]} />
                      <View style={[styles.bar, { backgroundColor: colors.accent, height: `${(week.done / top) * 100}%` }]} />
                    </View>
                    <Text variant="caption" numberOfLines={1}>
                      {week.label}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.legend}>
                <Legend color={colors.subtle} label="Planifié" />
                <Legend color={colors.accent} label="Réalisé" />
              </View>
              <Text variant="caption">
                La semaine en cours n’est pas terminée : {currentWeek?.done ?? 0} séances réalisées sur {currentWeek?.planned ?? 0} prévues. Elle ne compte pas dans
                le taux.
              </Text>
            </>
          ) : (
            <Text variant="body2">Pas encore de séance planifiée.</Text>
          )}
        </Card>
      </Section>

      {home.requests.length ? (
        <Section style={styles.tight}>
          <SectionHeader title="Demandes d’abonnement" />
          <Card padding={0} style={styles.list}>
            {home.requests.map((request, index) => (
              <View key={request.id} style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Avatar initials={request.initials} size={36} tone={avatarToneFor(request.id)} />
                <View style={styles.flex}>
                  <Text variant="h3" numberOfLines={1}>
                    {request.name}
                  </Text>
                  <Text variant="small">
                    {request.offer} · {request.requestedLabel}
                  </Text>
                </View>
                <Button label="Accepter" size="sm" disabled={busyId === request.id} onPress={() => respond(request.id, true)} />
                <Button label="Refuser" variant="secondary" size="sm" disabled={busyId === request.id} onPress={() => respond(request.id, false)} />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section style={styles.tight}>
        <SectionHeader title="Invitations en attente" />
        <Card padding={pending.length ? 0 : undefined} style={styles.list}>
          {pending.length ? (
            pending.map((invitation, index) => (
              <View key={invitation.id} style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Avatar initials={invitation.initials} size={36} />
                <View style={styles.flex}>
                  <Text variant="h3" numberOfLines={1}>
                    {invitation.name}
                  </Text>
                  <Text variant="small">{invitation.sentLabel}</Text>
                </View>
                <Chip label="En attente" tone="warning" />
              </View>
            ))
          ) : (
            <Text variant="body2">Aucune invitation en attente.</Text>
          )}
        </Card>
      </Section>

      <Section>
        <SectionHeader title="À surveiller" />
        <Card padding={watch.length ? 0 : undefined} style={styles.list}>
          {watch.length ? (
            watch.map((athlete, index) => {
              const status = ATHLETE_STATUS_STYLE[athlete.status];
              return (
                <Pressable
                  key={athlete.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/pro/athletes/[id]', params: { id: athlete.id } })}
                  style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Avatar initials={athlete.initials} size={36} tone={avatarToneFor(athlete.id)} />
                  <View style={styles.flex}>
                    <Text variant="h3" numberOfLines={1}>
                      {athlete.name}
                    </Text>
                    <Text variant="small" numberOfLines={1}>
                      <Text variant="small" style={{ color: colors.ink, fontFamily: fontFamily.medium }}>
                        {status.label}
                      </Text>
                      {` · ${athlete.subtitle}`}
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={18} color={colors.text3} />
                </Pressable>
              );
            })
          ) : (
            <Text variant="body2">Tout le monde est à jour.</Text>
          )}
        </Card>
      </Section>
    </Screen>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.kpi, { backgroundColor: colors.subtle }]}>
      <Text variant="stat" tabular>
        {value}
      </Text>
      <Text variant="overline" style={styles.kpiLabel}>
        {label}
      </Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text variant="caption">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  heading: { gap: 2, paddingTop: 4, paddingBottom: 14 },
  tight: { paddingBottom: 16 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { flexBasis: '47%', flexGrow: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, gap: 2 },
  kpiLabel: { fontSize: 10, letterSpacing: 0.5 },
  segmented: { marginTop: 12 },
  chartCard: { marginTop: 12, gap: 12 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 160 },
  slot: { flex: 1, alignItems: 'center', gap: 6, height: '100%' },
  pair: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  bar: { width: 10, minHeight: 3, borderRadius: 3 },
  legend: { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  list: { marginTop: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
});
