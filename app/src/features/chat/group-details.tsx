import { StyleSheet, View } from 'react-native';

import { Avatar, avatarToneFor, BackBar, Card, Chip, Icon, Screen, Section, SectionHeader, StateView, Text } from '@/components/ui';
import { useConversationGroup, useConversationRow } from '@/features/chat/conversations';
import { tintOf } from '@/features/coach/group-colors';
import { daysBetween } from '@/lib/dates';
import { formatDayShort, toIsoDay } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';

/**
 * Les détails d'une discussion de groupe : son nom et ses membres.
 *
 * On y arrive en touchant le titre du fil, comme partout ailleurs. Seul le
 * coach compose le groupe — l'écran ne fait que montrer qui en est.
 */
export function GroupDetails({ conversationId, name }: { conversationId: string; name: string }) {
  const { colors } = useTheme();
  const { data, loading, error, refetch } = useConversationRow(conversationId);
  const { data: group } = useConversationGroup(conversationId);

  const people = data?.people ?? [];
  const tint = group ? tintOf(group.color) : null;

  // Une course passée n'a plus de compte à rebours à afficher.
  const raceDate = group?.race?.date ? new Date(group.race.date) : null;
  const days = raceDate ? daysBetween(new Date(), raceDate) : null;
  const countdown = days === null ? null : days === 0 ? 'Aujourd’hui' : days > 0 ? `J-${days}` : null;

  return (
    <Screen>
      <BackBar title="Détails" />

      <Section style={styles.tight}>
        <Card style={styles.identity}>
          <View style={[styles.tile, { backgroundColor: tint?.soft ?? colors.dangerSoft }]}>
            <Icon name="users" size={26} color={tint?.ink ?? colors.danger} />
          </View>
          <Text variant="h2" style={styles.centered}>
            {data?.name ?? name}
          </Text>
          <Text variant="small">
            {people.length} participant{people.length > 1 ? 's' : ''}
          </Text>
          {group?.race ? (
            <View style={[styles.race, { backgroundColor: colors.subtle }]}>
              <Icon name="flag" size={14} color={colors.text2} />
              <Text variant="small" numberOfLines={1}>
                {group.race.name}
                {raceDate ? ` · ${formatDayShort(toIsoDay(raceDate))}` : ''}
              </Text>
              {countdown ? <Chip label={countdown} tone="accent" /> : null}
            </View>
          ) : null}
        </Card>
      </Section>

      {!data && (loading || error) ? (
        <StateView loading={loading} error={error} onRetry={refetch} />
      ) : (
        <Section>
          <SectionHeader title="Membres" />
          {people.length ? (
            <Card padding={0} style={styles.list}>
              {people.map((person, index) => (
                <View key={person.id} style={[styles.row, index > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : null]}>
                  <Avatar initials={person.initials} size={40} tone={person.coach ? 'violet' : avatarToneFor(person.id)} />
                  <Text variant="h3" numberOfLines={1} style={styles.flex}>
                    {person.name}
                  </Text>
                  {person.coach ? <Chip label="Coach" tone="violet" /> : null}
                </View>
              ))}
            </Card>
          ) : (
            <Card>
              <Text variant="body2">Personne dans ce groupe.</Text>
            </Card>
          )}
        </Section>
      )}

      <Section>
        <Text variant="caption">Les membres suivent le groupe : le coach les ajoute et les retire depuis son accueil.</Text>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  tight: { paddingBottom: 12 },
  identity: { alignItems: 'center', gap: 8, paddingVertical: 22 },
  tile: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  centered: { textAlign: 'center' },
  race: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  list: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
});
