import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { BackBar, Button, Card, FormError, Screen, Section, Segmented, StateView, Text, useToast } from '@/components/ui';
import { useAthletePlanning, useCoachActions } from '@/features/coach/queries';
import { SessionDraftFooter, SessionDraftForm, SessionSportPicker, useSessionDraft } from '@/features/coach/session-draft';
import { TemplateItem } from '@/features/coach/template-item';
import { useTemplates, type TemplateRow } from '@/features/coach/templates';
import { WeekStrip } from '@/features/sessions/week-strip';
import { emitAppEvent } from '@/lib/app-events';
import { formatDayLong, parseDay, toIsoDay } from '@/lib/format';
import { layout } from '@/theme/tokens';

type Mode = 'new' | 'library';

export default function CoachAddSessionScreen() {
  const { id, date: dateParam, name } = useLocalSearchParams<{ id: string; date?: string; name?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [date, setDate] = useState(() => (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : toIsoDay(new Date())));
  const [mode, setMode] = useState<Mode>('new');
  const { data: groups, loading, error, refetch } = useTemplates();
  const { assignTemplate, createAthleteSession } = useCoachActions();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Les jours déjà occupés de la semaine affichée (mois du jour choisi).
  const day = parseDay(date);
  const { data: planning } = useAthletePlanning(id, day.getFullYear(), day.getMonth());
  const busyDays = useMemo(
    () =>
      new Set(
        planning
          ? [...Object.keys(planning.sessionsByDay), ...Object.keys(planning.activitiesByDay), ...Object.keys(planning.othersByDay)]
          : [],
      ),
    [planning],
  );

  const finish = () => {
    emitAppEvent('sessions:changed');
    router.back();
  };

  const draft = useSessionDraft(date, async (payload) => {
    await createAthleteSession(id, payload);
    toast.success(`Séance ajoutée au planning le ${formatDayLong(payload.date).toLowerCase()}`);
    finish();
  });

  const assign = async (row: TemplateRow) => {
    setBusyId(row.id);
    setAssignError(null);
    try {
      await assignTemplate(row.id, id, date);
      toast.success(`Séance planifiée le ${formatDayLong(date).toLowerCase()}`);
      finish();
    } catch (reason) {
      setAssignError(reason instanceof Error ? reason.message : 'Planification impossible.');
      setBusyId(null);
    }
  };

  const profileWidth = width - layout.gutter * 2 - 32 - 48;

  return (
    <Screen footer={mode === 'new' ? <SessionDraftFooter draft={draft} /> : undefined}>
      <BackBar title="Ajouter une séance" />
      {name ? (
        <Section style={styles.subtitle}>
          <Text variant="small">Pour {name}</Text>
        </Section>
      ) : null}

      <Section style={styles.tight}>
        <Segmented<Mode>
          options={[
            { value: 'new', label: 'Nouvelle séance' },
            { value: 'library', label: 'Bibliothèque' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Section>

      {mode === 'new' ? (
        <>
          <SessionSportPicker draft={draft} />
          <Section style={styles.block}>
            <WeekStrip date={date} onChange={setDate} busyDays={busyDays} />
          </Section>
          <SessionDraftForm draft={draft} />
        </>
      ) : (
        <>
          <Section style={styles.block}>
            <WeekStrip date={date} onChange={setDate} busyDays={busyDays} />
          </Section>

          {/* Les séances détaillées se construisent dans l'éditeur, bloc par bloc ou exercice par exercice. */}
          <Section style={styles.tight}>
            <View style={styles.editors}>
              <Button
                label="Séance par blocs"
                variant="secondary"
                icon="repeat"
                onPress={() => router.replace({ pathname: '/pro/athletes/[id]/editeur', params: { id, date } })}
                style={styles.flex}
              />
              <Button
                label="Séance de muscu"
                variant="secondary"
                icon="dumbbell"
                onPress={() => router.replace({ pathname: '/pro/athletes/[id]/editeur', params: { id, date, sport: 'strength' } })}
                style={styles.flex}
              />
            </View>
          </Section>

          {groups ? (
            groups.length ? (
              <>
                <Section style={styles.hint}>
                  <FormError message={assignError} />
                  <Text variant="small">Les allures des séances de course sont calculées à partir de la VMA de l’athlète.</Text>
                </Section>
                {groups.map((group) => (
                  <Section key={group.label} style={styles.group}>
                    <Text variant="sectionTitle" style={styles.groupLabel}>
                      {group.label}
                    </Text>
                    <Card padding={0} style={styles.list}>
                      {group.templates.map((row, index) => (
                        <TemplateItem
                          key={row.id}
                          row={row}
                          divided={index > 0}
                          profileWidth={profileWidth}
                          action={<Button label={busyId === row.id ? '…' : 'Planifier'} size="sm" disabled={busyId !== null} onPress={() => assign(row)} />}
                        />
                      ))}
                    </Card>
                  </Section>
                ))}
              </>
            ) : (
              <Section>
                <Card style={styles.empty}>
                  <Text variant="body2">Votre bibliothèque est vide pour l’instant.</Text>
                  <Button label="Créer une nouvelle séance" variant="secondary" onPress={() => setMode('new')} />
                </Card>
              </Section>
            )
          ) : (
            <StateView loading={loading} error={error} onRetry={refetch} />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  subtitle: { marginTop: -8, paddingBottom: 14 },
  editors: { flexDirection: 'row', gap: 8 },
  tight: { paddingBottom: 16 },
  block: { paddingBottom: 22 },
  hint: { gap: 8, paddingBottom: 14 },
  group: { paddingBottom: 16 },
  groupLabel: { marginBottom: 8 },
  list: { paddingHorizontal: 16 },
  empty: { gap: 12 },
});
