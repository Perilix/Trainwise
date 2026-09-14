import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { BackBar, Button, Card, FormError, Screen, Section, Segmented, StateView, Text } from '@/components/ui';
import { useCoachActions } from '@/features/coach/queries';
import { TemplateItem } from '@/features/coach/template-item';
import { useTemplates, type TemplateRow } from '@/features/coach/templates';
import { DateStepper } from '@/features/sessions/date-stepper';
import { SimpleSessionForm } from '@/features/sessions/simple-session-form';
import { emitAppEvent } from '@/lib/app-events';
import { toIsoDay } from '@/lib/format';
import { layout } from '@/theme/tokens';

type Mode = 'library' | 'simple';

export default function CoachAddSessionScreen() {
  const { id, date: dateParam } = useLocalSearchParams<{ id: string; date?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [date, setDate] = useState(() => (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : toIsoDay(new Date())));
  const [mode, setMode] = useState<Mode>('library');
  const { data: groups, loading, error, refetch } = useTemplates();
  const { assignTemplate, createAthleteSession } = useCoachActions();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const finish = () => {
    emitAppEvent('sessions:changed');
    router.back();
  };

  const assign = async (row: TemplateRow) => {
    setBusyId(row.id);
    setAssignError(null);
    try {
      await assignTemplate(row.id, id, date);
      finish();
    } catch (reason) {
      setAssignError(reason instanceof Error ? reason.message : 'Planification impossible.');
      setBusyId(null);
    }
  };

  const profileWidth = width - layout.gutter * 2 - 32 - 48;

  return (
    <Screen>
      <BackBar title="Ajouter une séance" />

      <Section style={styles.tight}>
        <DateStepper date={date} onChange={setDate} />
      </Section>

      <Section style={styles.tight}>
        <Segmented<Mode>
          options={[
            { value: 'library', label: 'Bibliothèque' },
            { value: 'simple', label: 'Séance simple' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Section>

      <Section style={styles.tight}>
        <Button
          label="Créer une séance par blocs"
          variant="secondary"
          icon="repeat"
          fullWidth
          onPress={() => router.replace({ pathname: '/pro/athletes/[id]/editeur', params: { id, date } })}
        />
      </Section>

      {mode === 'simple' ? (
        <SimpleSessionForm
          date={date}
          submitLabel="Ajouter au planning"
          onSubmit={async (payload) => {
            await createAthleteSession(id, payload);
            finish();
          }}
        />
      ) : groups ? (
        groups.length ? (
          <>
            <Section style={styles.hint}>
              <FormError message={assignError} />
              <Text variant="small">Les allures des séances de course sont calculées à partir de la VMA de l’athlète.</Text>
            </Section>
            {groups.map((group) => (
              <Section key={group.label} style={styles.group}>
                <Text variant="overline" style={styles.groupLabel}>
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
              <Button label="Créer une séance simple" variant="secondary" onPress={() => setMode('simple')} />
            </Card>
          </Section>
        )
      ) : (
        <StateView loading={loading} error={error} onRetry={refetch} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tight: { paddingBottom: 12 },
  hint: { gap: 8, paddingBottom: 14 },
  group: { paddingBottom: 16 },
  groupLabel: { marginBottom: 8 },
  list: { paddingHorizontal: 16 },
  empty: { gap: 12 },
});
