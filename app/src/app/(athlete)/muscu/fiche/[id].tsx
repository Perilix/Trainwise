import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { SvgXml } from 'react-native-svg';

import { BackBar, BRAND, Button, Card, Chip, Icon, Screen, Section, Stat, StateView, Text } from '@/components/ui';
import { useStrengthSession } from '@/features/athlete/queries';
import { recordedSets, sessionSections, sessionTotals, targetGoal } from '@/features/athlete/strength-detail';
import { sessionTitle, type LogEntry } from '@/features/athlete/strength-log';
import { CoachFeedbackCard } from '@/features/sessions/coach-feedback';
import { onAppEvent } from '@/lib/app-events';
import { formatDayShort, formatDecimal, formatHoursMinutes, toIsoDay } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';

/**
 * Une séance de renforcement réalisée, en lecture.
 *
 * L'écran de saisie sert à remplir ses séries ; celui-ci sert à les relire —
 * ce qui a été soulevé, pour combien de volume. « Modifier » renvoie à la
 * saisie quand il y a quelque chose à corriger.
 */
export default function StrengthDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { data: session, loading, error, refetch } = useStrengthSession(id);

  // Retour de l'écran de saisie : la séance a changé sous nos pieds.
  useEffect(() => onAppEvent('sessions:changed', refetch), [refetch]);

  if (!session) {
    return (
      <Screen>
        <BackBar title="Séance muscu" />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const sections = sessionSections(session);
  const totals = sessionTotals(session);
  // Au-delà de la tonne, le compte en kilos ne se lit plus.
  const volume = !totals.volumeKg
    ? { value: '—', unit: undefined }
    : totals.volumeKg >= 1000
      ? { value: formatDecimal(totals.volumeKg / 1000, 1), unit: 't' }
      : { value: String(Math.round(totals.volumeKg)), unit: 'kg' };
  const footer = (
    <View style={styles.footer}>
      <Button
        label="Modifier"
        icon="pen"
        variant="secondary"
        fullWidth
        onPress={() => router.push({ pathname: '/muscu/[id]', params: { id: session._id, done: session._id } })}
      />
    </View>
  );

  return (
    <Screen footer={footer}>
      <BackBar title="Séance muscu" />

      <Section style={styles.tight}>
        <View style={[styles.hero, { backgroundColor: colors.brand }]}>
          <View style={styles.watermark} pointerEvents="none">
            <SvgXml xml={BRAND.glyph} width={112} height={112} opacity={0.05} />
          </View>
          <Text variant="overline" style={{ color: colors.highlight }}>
            {formatDayShort(toIsoDay(new Date(session.date)))}
          </Text>
          <Text variant="h1" style={[styles.heroTitle, { color: colors.onBrand }]}>
            {sessionTitle(session)}
          </Text>
          <View style={styles.heroChips}>
            {session.stravaActivityId ? <Chip label="Strava" tone="strava" /> : null}
            <Chip label="Réalisée" tone="success" />
          </View>
          <View style={styles.heroStats}>
            <Stat label="Durée" value={session.duration ? formatHoursMinutes(session.duration * 60) : '—'} tint={HERO_TINT} style={styles.flex} />
            <Stat label="Séries" value={String(totals.sets)} tint={HERO_TINT} style={styles.flex} />
            <Stat label="Volume" value={volume.value} unit={volume.unit} tint={HERO_TINT} style={styles.flex} />
          </View>
        </View>
      </Section>

      {sections.length ? (
        sections.map((section) => (
          <Section key={section.key} style={styles.tight}>
            {section.title ? (
              <View style={[styles.blockHead, { borderLeftColor: colors.accent }]}>
                <Text variant="sectionTitle">{section.title}</Text>
                {section.subtitle ? <Text variant="small">{section.subtitle}</Text> : null}
              </View>
            ) : null}

            {section.rows.map((row, rowIndex) => (
              <View key={`${section.key}-${rowIndex}`} style={section.kind === 'superset' ? [styles.pair, { borderLeftColor: colors.border }] : undefined}>
                {section.kind === 'superset' ? (
                  <Text variant="caption" style={styles.pairLabel}>
                    Couple {rowIndex + 1}
                  </Text>
                ) : null}
                {row.map(({ entry, slot }) => (
                  <View key={entry.key} style={styles.cardSpace}>
                    {slot ? (
                      <Text variant="caption" color="accentInk" style={styles.slot}>
                        {slot}
                      </Text>
                    ) : null}
                    <ExerciseRecap entry={entry} />
                  </View>
                ))}
              </View>
            ))}
          </Section>
        ))
      ) : (
        <Section style={styles.tight}>
          <Card>
            <Text variant="body2">
              Aucun exercice n’est rattaché à cette séance. Rapproche-la d’une séance planifiée pour retrouver la liste de ton coach.
            </Text>
          </Card>
        </Section>
      )}

      <Section style={styles.tight}>
        <Card>
          <View style={styles.rowBetween}>
            <Text variant="sectionTitle">Ressenti</Text>
            <View style={styles.baseline}>
              <Text variant="stat" tabular>
                {session.feeling ?? '—'}
              </Text>
              <Text variant="small">/10</Text>
            </View>
          </View>
        </Card>
      </Section>

      {session.notes ? (
        <Section style={styles.tight}>
          <Card>
            <Text variant="sectionTitle">Notes</Text>
            <Text variant="body2" style={styles.notes}>
              {session.notes}
            </Text>
          </Card>
        </Section>
      ) : null}

      <Section>
        <CoachFeedbackCard feedback={session.coachFeedback} />
      </Section>
    </Screen>
  );
}

/** Un exercice et ses séries réalisées, série par série. */
function ExerciseRecap({ entry }: { entry: LogEntry }) {
  const { colors } = useTheme();
  const sets = recordedSets(entry);
  const goal = targetGoal(entry);

  return (
    <Card>
      <View style={styles.exerciseHeader}>
        <View style={[styles.tile, { backgroundColor: colors.accentSoft }]}>
          <Icon name="dumbbell" size={17} color={colors.accentInk} strokeWidth={1.9} />
        </View>
        <View style={styles.flex}>
          <Text variant="h3">{entry.name}</Text>
          <Text variant="small" tabular>
            {[entry.muscle, goal ? `Objectif ${goal}` : null].filter(Boolean).join(' · ') || 'À ton rythme'}
          </Text>
        </View>
      </View>

      {sets.length ? (
        <>
          <View style={styles.setHeader}>
            <Text variant="overline" style={styles.setIndex}>
              Série
            </Text>
            <Text variant="overline" style={styles.flex}>
              Rép.
            </Text>
            <Text variant="overline" style={styles.flex}>
              Charge
            </Text>
          </View>
          {sets.map((set, index) => (
            <View key={index} style={[styles.setRow, { borderTopColor: colors.border }]}>
              <Text variant="small" color="text3" tabular style={styles.setIndex}>
                {index + 1}
              </Text>
              <Text variant="body2" tabular style={styles.flex}>
                {set.reps}
              </Text>
              <Text variant="body2" tabular style={styles.flex}>
                {set.weight ? `${set.weight} kg` : '—'}
              </Text>
            </View>
          ))}
        </>
      ) : (
        <Text variant="small" style={styles.notDone}>
          Aucune série enregistrée.
        </Text>
      )}
    </Card>
  );
}

const HERO_TINT = { label: 'rgba(255, 255, 255, 0.55)', value: '#FFFFFF' };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tight: { paddingBottom: 12 },
  hero: { borderRadius: radius.xl, padding: 20, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -16, bottom: -18 },
  heroTitle: { marginTop: 6 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.14)' },
  blockHead: { gap: 2, marginBottom: 10, paddingLeft: 10, borderLeftWidth: 3 },
  pair: { borderLeftWidth: 1, paddingLeft: 10, marginBottom: 6 },
  pairLabel: { marginBottom: 4 },
  slot: { marginBottom: 2 },
  cardSpace: { marginBottom: 8 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tile: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  setHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 2, paddingHorizontal: 6 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingVertical: 7, borderTopWidth: 1 },
  setIndex: { width: 36 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  notes: { marginTop: 6 },
  notDone: { marginTop: 10 },
  footer: { paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
});
