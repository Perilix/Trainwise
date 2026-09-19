import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, avatarToneFor, Button, Card, Field, FormError, Icon, IconButton, Screen, Section, SectionHeader, Segmented, StateView, Text } from '@/components/ui';
import { tintOf } from '@/features/coach/group-colors';
import { InviteCodeCard } from '@/features/coach/invite-code-card';
import { useCoachActions, useCoachGroups, useCoachHome, useInviteOverview } from '@/features/coach/queries';
import { ATHLETE_STATUS_STYLE } from '@/features/coach/status';
import type { CoachAthleteRow, CoachGroup, SubscriptionRequestRow } from '@/features/coach/types';
import { MainAppBar } from '@/features/shell/main-app-bar';
import { emitAppEvent, onAppEvent } from '@/lib/app-events';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

export default function CoachHomeScreen() {
  const router = useRouter();
  const { data, loading, error, refetch } = useCoachHome();
  const { data: groups, refetch: refetchGroups } = useCoachGroups();
  const { data: invite, refetch: refetchInvite } = useInviteOverview();
  const { respondToRequest } = useCoachActions();
  const [tab, setTab] = useState<'athletes' | 'groupes'>('athletes');
  /** Groupe sur lequel la liste d'athlètes est filtrée, depuis l'onglet Groupes. */
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(
    () =>
      onAppEvent('athletes:changed', () => {
        refetch();
        refetchGroups();
      }),
    [refetch, refetchGroups],
  );

  if (!data) {
    return (
      <Screen tabs>
        <MainAppBar />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const needle = search.trim().toLowerCase();
  const activeGroup = groupFilter ? (groups ?? []).find((group) => group.id === groupFilter) : undefined;
  const members = activeGroup ? new Set(activeGroup.athletes.map((athlete) => athlete.id)) : null;
  const athletes = data.athletes
    .filter((athlete) => (members ? members.has(athlete.id) : true))
    .filter((athlete) => (needle ? `${athlete.name} ${athlete.email}`.toLowerCase().includes(needle) : true));

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
        <InviteCodeCard code={invite?.code ?? null} onChanged={refetchInvite} />
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

      <Section style={styles.tight}>
        <Segmented
          options={[
            { value: 'athletes' as const, label: `Athlètes · ${data.athletes.length}` },
            { value: 'groupes' as const, label: `Groupes · ${(groups ?? []).length}` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </Section>

      {tab === 'athletes' ? (
        <Section>
          <SectionHeader title={activeGroup ? activeGroup.name : 'Mes athlètes'} />
          {activeGroup ? (
            <Pressable accessibilityRole="button" onPress={() => setGroupFilter(null)} style={styles.filterRow}>
              <View style={[styles.filterChip, { backgroundColor: tintOf(activeGroup.color).soft }]}>
                <Text variant="caption" style={{ color: tintOf(activeGroup.color).ink }}>
                  Groupe · {activeGroup.athletes.length}
                </Text>
                <Icon name="x" size={12} color={tintOf(activeGroup.color).ink} strokeWidth={2} />
              </View>
            </Pressable>
          ) : null}
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
      ) : (
        <Section>
          <SectionHeader title="Mes groupes" />
          <Text variant="caption" style={styles.groupHint}>
            Rassemblez les athlètes qui visent la même course ou suivent le même plan.
          </Text>
          {(groups ?? []).map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onOpen={() => {
                setGroupFilter(group.id);
                setSearch('');
                setTab('athletes');
              }}
              onEdit={() => router.push({ pathname: '/pro/groupe', params: { id: group.id } })}
            />
          ))}
          <Pressable accessibilityRole="button" onPress={() => router.push('/pro/groupe')} style={styles.newGroupWrap}>
            <NewGroupCard />
          </Pressable>
        </Section>
      )}
    </Screen>
  );
}

function GroupCard({ group, onOpen, onEdit }: { group: CoachGroup; onOpen: () => void; onEdit: () => void }) {
  const { colors } = useTheme();
  const tint = tintOf(group.color);
  const subtitle = group.race ? [group.race.name, group.race.countdown ?? group.race.dateLabel].filter(Boolean).join(' · ') : 'Aucune course visée';

  return (
    <Card style={styles.groupCard}>
      <View style={styles.row}>
        <View style={[styles.groupTile, { backgroundColor: tint.soft }]}>
          <Icon name="users" size={20} color={tint.ink} />
        </View>
        <View style={styles.flex}>
          <Text variant="h3" numberOfLines={1}>
            {group.name}
          </Text>
          <Text variant="small" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <IconButton icon="pen" size={36} bordered accessibilityLabel={`Modifier ${group.name}`} onPress={onEdit} />
      </View>

      <View style={styles.members}>
        {group.athletes.slice(0, 5).map((athlete) => (
          <Avatar key={athlete.id} initials={athlete.initials} size={28} tone={avatarToneFor(athlete.id)} />
        ))}
        {group.athletes.length > 5 ? (
          <View style={[styles.more, { backgroundColor: colors.subtle }]}>
            <Text variant="caption" tabular>
              +{group.athletes.length - 5}
            </Text>
          </View>
        ) : null}
        <Text variant="small" style={styles.flex}>
          {group.athletes.length} athlète{group.athletes.length > 1 ? 's' : ''}
        </Text>
      </View>

      <Button label="Voir les athlètes" variant="secondary" size="sm" icon="users" fullWidth onPress={onOpen} />
    </Card>
  );
}

/** La place qu'occupera le prochain groupe, en pointillé. */
function NewGroupCard() {
  const { colors } = useTheme();
  return (
    <View style={[styles.newGroup, { borderColor: colors.borderStrong }]}>
      <View style={[styles.plus, { backgroundColor: colors.subtle }]}>
        <Icon name="plus" size={20} color={colors.text2} strokeWidth={2} />
      </View>
      <Text variant="h3">Nouveau groupe</Text>
      <Text variant="small" style={styles.newGroupText}>
        Rassemblez les athlètes qui visent la même course ou suivent le même plan.
      </Text>
    </View>
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
  groupHint: { marginTop: 4, marginBottom: 12 },
  groupCard: { gap: 14, marginBottom: 12 },
  groupTile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  members: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  more: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  newGroupWrap: { marginTop: 4 },
  newGroup: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.lg, paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center', gap: 8 },
  plus: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  newGroupText: { textAlign: 'center' },
  filterRow: { marginTop: 10 },
  filterChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
});
