import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, BackBar, Button, Card, Chip, Field, FormError, Icon, IconButton, Screen, Section, Stat, StateView, Text } from '@/components/ui';
import { useAthleteFiche, useCoachActions } from '@/features/coach/queries';
import { ATHLETE_STATUS_STYLE } from '@/features/coach/status';
import type { AthleteFiche } from '@/features/coach/types';
import { emitAppEvent } from '@/lib/app-events';
import { formatDecimal, parseDecimal } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

const WEEKDAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function AthleteFicheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { data: fiche, loading, error, refetch } = useAthleteFiche(id);
  const { updateAthleteVma } = useCoachActions();
  const [vmaDraft, setVmaDraft] = useState<string | null>(null);
  const [vmaError, setVmaError] = useState<string | null>(null);
  const [savingVma, setSavingVma] = useState(false);

  if (!fiche) {
    return (
      <Screen>
        <BackBar />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const status = ATHLETE_STATUS_STYLE[fiche.status];
  const { physical } = fiche;

  const saveVma = async () => {
    const value = parseDecimal(vmaDraft ?? '');
    if (!value || value < 8 || value > 30) {
      setVmaError('La VMA doit être comprise entre 8 et 30 km/h.');
      return;
    }
    setSavingVma(true);
    setVmaError(null);
    try {
      await updateAthleteVma(fiche.id, value);
      setVmaDraft(null);
      emitAppEvent('athletes:changed');
      refetch();
    } catch (reason) {
      setVmaError(reason instanceof Error ? reason.message : 'Modification impossible.');
    } finally {
      setSavingVma(false);
    }
  };

  const cancelVma = () => {
    setVmaDraft(null);
    setVmaError(null);
  };

  const weekCounts = fiche.weeks.reduce<Record<string, number>>((counts, week) => ({ ...counts, [week ?? 'none']: (counts[week ?? 'none'] ?? 0) + 1 }), {});

  return (
    <Screen>
      <BackBar />

      <Section style={styles.header}>
        <View style={styles.identity}>
          <Avatar initials={fiche.initials} size={56} tone="accent" />
          <View style={styles.flex}>
            <Text variant="h1" style={styles.name}>
              {fiche.name}
            </Text>
            {fiche.sinceLabel ? <Text variant="small">{fiche.sinceLabel}</Text> : null}
          </View>
        </View>
        <Button label="Message" variant="secondary" icon="message" fullWidth onPress={() => router.push({ pathname: '/pro/conversation/[id]', params: { id: fiche.id } })} style={styles.headerAction} />
      </Section>

      <Section style={styles.tight}>
        <Card>
          <View style={styles.rowBetween}>
            <View>
              <Text variant="caption">Statut de forme</Text>
              <View style={styles.statusLine}>
                <View style={[styles.statusDot, { backgroundColor: colors[status.color] }]} />
                <Text style={[styles.statusLabel, { color: colors.ink }]}>{status.label}</Text>
              </View>
            </View>
            {fiche.trend !== 'stable' ? (
              <View style={styles.trend}>
                <Chip
                  label={fiche.trend === 'declining' ? 'En dégradation' : 'En amélioration'}
                  tone={fiche.trend === 'declining' ? 'warning' : 'success'}
                  icon={fiche.trend === 'declining' ? 'trendDown' : 'trendUp'}
                />
                {fiche.statusSinceLabel ? <Text variant="caption">{fiche.statusSinceLabel}</Text> : null}
              </View>
            ) : null}
          </View>

          <View style={[styles.grid, styles.divided, { borderTopColor: colors.border }]}>
            <Stat label="Dernière activité" value={fiche.lastActivityLabel} style={styles.half} />
            <Stat label="Séances sautées · 4 sem." value={String(fiche.skippedCount)} style={styles.half} />
            <Stat label="Ressenti moyen" value={fiche.avgFeeling !== undefined ? formatDecimal(fiche.avgFeeling) : '—'} unit={fiche.avgFeeling !== undefined ? '/10' : undefined} style={styles.half} />
            <Stat label="Volume · 7 jours" value={formatDecimal(fiche.weeklyVolume, fiche.weeklyVolume % 1 ? 1 : 0)} unit="km" style={styles.half} />
          </View>
          {fiche.baselineWeeklyVolume ? (
            <Text variant="caption" style={styles.baseline}>
              Habituellement {formatDecimal(fiche.baselineWeeklyVolume, 0)} km par semaine
            </Text>
          ) : null}

          <View style={[styles.divided, { borderTopColor: colors.border }]}>
            <View style={styles.rowBetween}>
              <Text variant="caption">8 semaines</Text>
              <View style={styles.legend}>
                {(['green', 'orange', 'red'] as const).map((key) => (
                  <View key={key} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors[ATHLETE_STATUS_STYLE[key].color] }]} />
                    <Text variant="caption">{ATHLETE_STATUS_STYLE[key].label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View
              accessible
              accessibilityLabel={`8 dernières semaines : ${weekCounts.green ?? 0} en forme, ${weekCounts.orange ?? 0} en vigilance, ${weekCounts.red ?? 0} en alerte`}
              style={styles.weeks}>
              {fiche.weeks.map((week, index) => (
                <View key={index} style={[styles.week, { backgroundColor: week ? colors[ATHLETE_STATUS_STYLE[week].color] : colors.subtle }]} />
              ))}
            </View>
          </View>
        </Card>
      </Section>

      <Section style={styles.tight}>
        <Card>
          <Text variant="h2">Données physiques</Text>
          <View style={styles.grid}>
            <Fact label="Taille" value={physical.heightCm ? `${physical.heightCm} cm` : '—'} />
            <Fact label="Poids" value={physical.weightKg ? `${formatDecimal(physical.weightKg, physical.weightKg % 1 ? 1 : 0)} kg` : '—'} />
            <View style={styles.half}>
              <Text variant="caption">VMA</Text>
              <View style={styles.inline}>
                <Text variant="h3" tabular>
                  {physical.vma ? `${formatDecimal(physical.vma)} km/h` : 'Non définie'}
                </Text>
                {vmaDraft === null ? (
                  <IconButton icon="pen" size={32} color={colors.accentInk} accessibilityLabel="Modifier la VMA" onPress={() => setVmaDraft(physical.vma ? formatDecimal(physical.vma) : '')} />
                ) : null}
              </View>
            </View>
            <Fact label="FCmax" value={physical.fcMax ? `${physical.fcMax} bpm` : '—'} />
          </View>
          {vmaDraft !== null ? (
            <View style={[styles.vmaEditor, { borderTopColor: colors.border }]}>
              <Field label="VMA (km/h)" keyboardType="decimal-pad" placeholder="17,0" value={vmaDraft} onChangeText={setVmaDraft} autoFocus />
              <FormError message={vmaError} />
              <View style={styles.actions}>
                <Button label="Annuler" variant="secondary" onPress={cancelVma} style={styles.flex} />
                <Button label={savingVma ? 'Enregistrement…' : 'Enregistrer'} disabled={savingVma} onPress={saveVma} style={styles.flex} />
              </View>
            </View>
          ) : null}
        </Card>
      </Section>

      <Section style={styles.tight}>
        <SportProfile fiche={fiche} />
      </Section>

      <Section>
        <Card>
          <View style={styles.rowBetween}>
            <Text variant="h2">Activité</Text>
            <Text variant="caption">7 derniers jours</Text>
          </View>
          {fiche.activities.length ? (
            fiche.activities.map((activity, index) => {
              const running = activity.sport === 'running';
              return (
                <View key={activity.id} style={[styles.activity, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <View style={[styles.tile, { backgroundColor: running ? colors.accentSoft : colors.subtle }]}>
                    <Icon name={running ? 'route' : 'dumbbell'} size={20} color={running ? colors.accentInk : colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text variant="h3">{activity.title}</Text>
                    <Text variant="small">{activity.dateLabel}</Text>
                  </View>
                  <View style={styles.activityValue}>
                    <Text variant="h3" tabular>
                      {activity.value}
                    </Text>
                    {activity.feeling ? <Text variant="caption">Ressenti {activity.feeling}/10</Text> : null}
                  </View>
                </View>
              );
            })
          ) : (
            <Text variant="body2" style={styles.empty}>
              Aucune activité ces 7 derniers jours.
            </Text>
          )}
        </Card>
      </Section>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.half}>
      <Text variant="caption">{label}</Text>
      <Text variant="h3" tabular>
        {value}
      </Text>
    </View>
  );
}

function Line({ label, value, first }: { label: string; value: string; first?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.line, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <Text variant="body2" style={styles.flex}>
        {label}
      </Text>
      <Text variant="h3" style={styles.lineValue}>
        {value}
      </Text>
    </View>
  );
}

function SportProfile({ fiche }: { fiche: AthleteFiche }) {
  const { colors } = useTheme();
  const { running, strength, availability, competition } = fiche;
  const runningLines = [
    running.level ? { label: 'Niveau', value: running.level } : null,
    running.frequency ? { label: 'Fréquence', value: `${running.frequency} séances/sem.` } : null,
    running.injuries ? { label: 'Blessures', value: running.injuries } : null,
  ].filter((line): line is { label: string; value: string } => line !== null);
  const strengthLines = [
    strength.goal ? { label: 'Objectif', value: strength.goal } : null,
    strength.type ? { label: 'Type', value: strength.type } : null,
    strength.frequency ? { label: 'Fréquence', value: `${strength.frequency} séances/sem.` } : null,
  ].filter((line): line is { label: string; value: string } => line !== null);
  const hasAvailability = availability.days.some(Boolean) || availability.preferredTime;

  return (
    <Card>
      <Text variant="h2">Profil sportif</Text>
      {!runningLines.length && !strengthLines.length && !competition && !hasAvailability ? (
        <Text variant="body2" style={styles.empty}>
          L’athlète n’a pas encore renseigné son profil sportif.
        </Text>
      ) : null}

      {runningLines.length || competition ? (
        <>
          <Text variant="overline" style={styles.overline}>
            Course à pied
          </Text>
          {runningLines.map((line, index) => (
            <Line key={line.label} label={line.label} value={line.value} first={index === 0} />
          ))}
          {competition ? (
            <View style={[styles.competition, { backgroundColor: colors.bg }]}>
              <View style={[styles.priority, { backgroundColor: competition.priority === 'A' ? colors.primary : colors.subtle }]}>
                <Text style={[styles.priorityText, { color: competition.priority === 'A' ? colors.onPrimary : colors.primary }]}>{competition.priority}</Text>
              </View>
              <View style={styles.flex}>
                <Text variant="h3">{competition.name}</Text>
                <Text variant="small">
                  {competition.dateLabel}
                  {competition.goal ? ` · Objectif ${competition.goal}` : ''}
                </Text>
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      {strengthLines.length ? (
        <>
          <Text variant="overline" style={styles.overline}>
            Musculation
          </Text>
          {strengthLines.map((line, index) => (
            <Line key={line.label} label={line.label} value={line.value} first={index === 0} />
          ))}
        </>
      ) : null}

      {hasAvailability ? (
        <>
          <Text variant="overline" style={styles.overline}>
            Disponibilités
          </Text>
          <View style={styles.days}>
            {availability.days.map((available, index) => (
              <View key={index} style={[styles.day, { backgroundColor: available ? colors.primary : colors.subtle }]}>
                <Text style={[styles.dayText, { color: available ? colors.onPrimary : colors.text3 }]}>{WEEKDAY_LETTERS[index]}</Text>
              </View>
            ))}
          </View>
          {availability.preferredTime ? (
            <Text variant="small" style={styles.preferred}>
              Créneau préféré : {availability.preferredTime}
            </Text>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingTop: 4, paddingBottom: 16 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { fontSize: 22, lineHeight: 30 },
  headerAction: { marginTop: 16 },
  tight: { paddingBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontFamily: fontFamily.semibold, fontSize: 18, lineHeight: 26 },
  trend: { alignItems: 'flex-end', gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginTop: 14 },
  divided: { marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
  half: { width: '50%', gap: 2 },
  baseline: { marginTop: 6, textAlign: 'right' },
  legend: { flexDirection: 'row', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  weeks: { flexDirection: 'row', gap: 3, marginTop: 8 },
  week: { flex: 1, height: 8, borderRadius: 3 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: -6, marginBottom: -6 },
  vmaEditor: { gap: 12, marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  overline: { marginTop: 16, marginBottom: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  lineValue: { flexShrink: 1, textAlign: 'right' },
  competition: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md },
  priority: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  priorityText: { fontFamily: fontFamily.bold, fontSize: 14 },
  days: { flexDirection: 'row', gap: 6, marginTop: 10 },
  day: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontFamily: fontFamily.semibold, fontSize: 13 },
  preferred: { marginTop: 8 },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  tile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  activityValue: { alignItems: 'flex-end' },
  empty: { marginTop: 8 },
});
