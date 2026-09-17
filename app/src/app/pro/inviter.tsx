import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, BackBar, Button, Card, Chip, Field, FormError, Screen, Section, SectionHeader, Text } from '@/components/ui';
import { InviteCodeCard } from '@/features/coach/invite-code-card';
import { useCoachActions, useInviteOverview } from '@/features/coach/queries';
import type { AthleteSearchRow, PackageType } from '@/features/coach/types';
import { emitAppEvent } from '@/lib/app-events';
import { useTheme } from '@/theme/theme-provider';

// Les formules d'abonnement n'existent plus pour l'instant : on n'en propose pas
// au coach et on envoie une valeur neutre, que l'API attend toujours.
const DEFAULT_PACKAGE: PackageType = 'silver';
const SEARCH_DELAY_MS = 350;

export default function InviteAthleteScreen() {
  const { colors } = useTheme();
  const { data: overview, refetch } = useInviteOverview();
  const { searchAthletes, inviteAthlete } = useCoachActions();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AthleteSearchRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQuery = useRef('');

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const changeQuery = (text: string) => {
    setQuery(text);
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    const needle = text.trim();
    latestQuery.current = needle;
    if (needle.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(() => {
      searchAthletes(needle)
        .then(
          (rows) => {
            if (latestQuery.current === needle) setResults(rows);
          },
          (reason: unknown) => {
            if (latestQuery.current === needle) setError(reason instanceof Error ? reason.message : 'Recherche impossible.');
          },
        )
        .finally(() => {
          if (latestQuery.current === needle) setSearching(false);
        });
    }, SEARCH_DELAY_MS);
  };

  const invite = async (row: AthleteSearchRow) => {
    setBusyId(row.id);
    setError(null);
    try {
      await inviteAthlete(row.id, DEFAULT_PACKAGE);
      setInvitedIds((ids) => [...ids, row.id]);
      refetch();
      emitAppEvent('athletes:changed');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Invitation impossible.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen>
      <BackBar title="Inviter un athlète" />

      <Section style={styles.tight}>
        <InviteCodeCard code={overview?.code ?? null} onChanged={refetch} />
      </Section>

      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <View>
            <Text variant="sectionTitle">Inviter un utilisateur Trainwise</Text>
            <Text variant="small" style={styles.hint}>
              Il reçoit une invitation à accepter dans son app.
            </Text>
          </View>
          <Field icon="search" label="Rechercher" placeholder="Nom ou email" autoCapitalize="none" autoCorrect={false} value={query} onChangeText={changeQuery} />
          <FormError message={error} />

          {searching ? <Text variant="small">Recherche…</Text> : null}
          {!searching && results?.length === 0 ? <Text variant="small">Aucun utilisateur trouvé.</Text> : null}
          {!searching && results?.length ? (
            <View>
              {results.map((row, index) => {
                const invited = invitedIds.includes(row.id) || row.state === 'pending';
                return (
                  <View key={row.id} style={[styles.result, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <Avatar initials={row.initials} size={40} tone="accent" />
                    <View style={styles.flex}>
                      <Text variant="h3" numberOfLines={1}>
                        {row.name}
                      </Text>
                      {row.email ? (
                        <Text variant="small" numberOfLines={1}>
                          {row.email}
                        </Text>
                      ) : null}
                    </View>
                    {row.state === 'following' ? (
                      <Chip label="Déjà suivi" tone="success" icon="check" />
                    ) : invited ? (
                      <Chip label="Invité" tone="warning" icon="clock" />
                    ) : row.state === 'taken' ? (
                      <Chip label="A déjà un coach" />
                    ) : (
                      <Button label="Inviter" size="sm" disabled={busyId !== null} onPress={() => invite(row)} />
                    )}
                  </View>
                );
              })}
            </View>
          ) : null}
        </Card>
      </Section>

      {overview?.pending.length ? (
        <Section>
          <SectionHeader title="Invitations en attente" />
          <Card padding={0} style={styles.list}>
            {overview.pending.map((invitation, index) => (
              <View key={invitation.id} style={[styles.result, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Avatar initials={invitation.initials} size={40} tone="accent" />
                <View style={styles.flex}>
                  <Text variant="h3">{invitation.name}</Text>
                  <Text variant="small">{invitation.sentLabel}</Text>
                </View>
                <Chip label="En attente" tone="warning" icon="clock" />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tight: { paddingBottom: 12 },
  gap: { gap: 16 },
  hint: { marginTop: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  list: { paddingHorizontal: 16, marginTop: 12 },
});
