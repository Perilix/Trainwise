import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, avatarToneFor, Button, Card, Field, FormError, Icon, IconButton, Screen, Section, SectionHeader, StateView, Text } from '@/components/ui';
import { useCoachActions, useCoachHome } from '@/features/coach/queries';
import { ATHLETE_STATUS_STYLE } from '@/features/coach/status';
import type { CoachAthleteRow, SubscriptionRequestRow } from '@/features/coach/types';
import { MainAppBar } from '@/features/shell/main-app-bar';
import { emitAppEvent, onAppEvent } from '@/lib/app-events';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

export default function CoachHomeScreen() {
  const router = useRouter();
  const { data, loading, error, refetch } = useCoachHome();
  const { respondToRequest } = useCoachActions();
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => onAppEvent('athletes:changed', refetch), [refetch]);

  if (!data) {
    return (
      <Screen tabs>
        <MainAppBar />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const needle = search.trim().toLowerCase();
  const athletes = needle ? data.athletes.filter((athlete) => `${athlete.name} ${athlete.email}`.toLowerCase().includes(needle)) : data.athletes;

  const respond = async (id: string, accept: boolean) => {
    setBusyId(id);
    setActionError(null);
    try {
      await respondToRequest(id, accept);
      emitAppEvent('athletes:changed');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Réponse impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const openChat = (peerId: string) => router.push({ pathname: '/pro/conversation/[id]', params: { id: peerId } });

  return (
    <Screen tabs>
      <MainAppBar />

      <Section style={styles.heading}>
        <Text variant="h1">Espace coach</Text>
        <Text variant="body2">Gérez vos athlètes et leurs entraînements.</Text>
      </Section>

      <Section style={styles.tight}>
        <Button label="Inviter un athlète" icon="plus" fullWidth onPress={() => router.push('/pro/inviter')} />
      </Section>

      <Section>
        <Card padding={12}>
          <View style={styles.statsGrid}>
            <StatTile label="Athlètes" value={String(data.stats.athletes)} />
            <StatTile label="Invitations" value={String(data.stats.pendingInvitations)} />
            <StatTile label="Séances / sem." value={String(data.stats.sessionsThisWeek)} />
            <StatTile label="Séances créées" value={data.stats.sessionsTotal.toLocaleString('fr-FR')} />
          </View>
        </Card>
      </Section>

      {data.requests.length ? (
        <Section>
          <View style={styles.requestsTitle}>
            <Text variant="sectionTitle">Demandes d’abonnement</Text>
            <CountBadge count={data.requests.length} />
          </View>
          <FormError message={actionError} style={styles.requestError} />
          <Card padding={0} style={styles.list}>
            {data.requests.map((request, index) => (
              <RequestRow
                key={request.id}
                request={request}
                divided={index > 0}
                busy={busyId === request.id}
                onAccept={() => respond(request.id, true)}
                onDecline={() => respond(request.id, false)}
                onMessage={() => openChat(request.athleteId)}
              />
            ))}
          </Card>
        </Section>
      ) : null}

      <Section>
        <SectionHeader title="Mes athlètes" />
        <View style={styles.search}>
          <Field icon="search" placeholder="Rechercher un athlète" accessibilityLabel="Rechercher un athlète" value={search} onChangeText={setSearch} autoCapitalize="none" />
        </View>
        {athletes.length ? (
          <Card padding={0} style={styles.list}>
            {athletes.map((athlete, index) => (
              <AthleteRow key={athlete.id} athlete={athlete} divided={index > 0} onPress={() => router.push({ pathname: '/pro/athletes/[id]', params: { id: athlete.id } })} />
            ))}
          </Card>
        ) : (
          <Card style={styles.list}>
            <Text variant="body2">{needle ? 'Aucun athlète ne correspond à cette recherche.' : 'Aucun athlète pour l’instant. Invitez-les avec votre code.'}</Text>
          </Card>
        )}
      </Section>
    </Screen>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
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

function CountBadge({ count }: { count: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.danger }]}>
      <Text style={styles.badgeText}>{count}</Text>
    </View>
  );
}

type RequestRowProps = {
  request: SubscriptionRequestRow;
  divided: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onMessage: () => void;
};

function RequestRow({ request, divided, busy, onAccept, onDecline, onMessage }: RequestRowProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.request, divided && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <View style={styles.row}>
        <Avatar initials={request.initials} size={40} tone={avatarToneFor(request.id)} />
        <View style={styles.flex}>
          <Text variant="h3">{request.name}</Text>
          <Text variant="small">{request.requestedLabel}</Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        <Button label="Accepter" icon="check" size="sm" disabled={busy} onPress={onAccept} style={styles.flex} />
        <Button label="Refuser" variant="secondary" size="sm" disabled={busy} onPress={onDecline} style={styles.flex} />
        <IconButton icon="message" size={36} bordered accessibilityLabel={`Écrire à ${request.name}`} onPress={onMessage} />
      </View>
    </View>
  );
}

function AthleteRow({ athlete, divided, onPress }: { athlete: CoachAthleteRow; divided: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const status = ATHLETE_STATUS_STYLE[athlete.status];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${athlete.name}, ${status.label}, ${athlete.subtitle}`}
      onPress={onPress}
      style={[styles.athlete, divided && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <View>
        <Avatar initials={athlete.initials} size={40} tone={avatarToneFor(athlete.id)} />
        <View style={[styles.statusDot, { backgroundColor: colors[status.color], borderColor: colors.surface }]} />
      </View>
      <View style={styles.athleteText}>
        <View style={styles.row}>
          <Text variant="h3" numberOfLines={1} style={styles.shrink}>
            {athlete.name}
          </Text>
        </View>
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
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  heading: { gap: 2, paddingTop: 4, paddingBottom: 14 },
  tight: { paddingBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statTileLabel: { fontSize: 10, letterSpacing: 0.5 },
  statTile: { flexBasis: '47%', flexGrow: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, gap: 2 },
  requestsTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requestError: { marginTop: 12 },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16 },
  list: { paddingHorizontal: 16, marginTop: 12 },
  request: { paddingVertical: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requestActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: { marginTop: 12 },
  athlete: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  athleteText: { flex: 1, gap: 2, minWidth: 0 },
  statusDot: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
});
