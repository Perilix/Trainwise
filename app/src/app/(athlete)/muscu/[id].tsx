import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BackBar, Button, Card, FeelingSlider, Icon, Screen, Section, StateView, Text } from '@/components/ui';
import { useAthleteActions, usePlannedSession, useStrengthSession } from '@/features/athlete/queries';
import { buildStrengthPayload, entriesFromPlan, entriesFromSession, groupEntries, type LogEntry, type LogSet } from '@/features/athlete/strength-log';
import { emitAppEvent } from '@/lib/app-events';
import { formatClock, formatDecimal } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

export default function StrengthLogScreen() {
  // `done` : on complète une séance déjà enregistrée — celle venue de Strava,
  // qui a les exercices du coach mais pas encore ses séries.
  const { id, done } = useLocalSearchParams<{ id: string; done?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { data: session, loading, error, refetch } = usePlannedSession(done ? '' : id);
  const { data: existing, loading: loadingDone, error: errorDone, refetch: refetchDone } = useStrengthSession(done ?? '');
  const { saveStrengthSession, updateStrengthSession } = useAthleteActions();
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [edited, setEdited] = useState<LogEntry[] | null>(null);
  const [feeling, setFeeling] = useState(7);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const plan = session?.strength;

  if (done ? !existing : !session || !plan) {
    const missingPlan = !done && session && !plan ? 'Cette séance ne contient pas d’exercices à saisir.' : null;
    return (
      <Screen>
        <BackBar title="Séance muscu" />
        <StateView
          loading={done ? loadingDone : loading}
          error={(done ? errorDone : error) ?? missingPlan}
          onRetry={missingPlan ? undefined : done ? refetchDone : refetch}
        />
      </Screen>
    );
  }

  const entries = edited ?? (existing ? entriesFromSession(existing) : entriesFromPlan(plan!));
  const totalSets = entries.reduce((sum, entry) => sum + entry.sets.length, 0);
  const doneSets = entries.reduce((sum, entry) => sum + entry.sets.filter((set) => set.done).length, 0);

  const updateEntry = (entryIndex: number, change: (entry: LogEntry) => LogEntry) =>
    setEdited(entries.map((entry, index) => (index === entryIndex ? change(entry) : entry)));

  const changeSet = (entryIndex: number, setIndex: number, patch: Partial<LogSet>) =>
    updateEntry(entryIndex, (entry) => ({ ...entry, sets: entry.sets.map((set, index) => (index === setIndex ? { ...set, ...patch } : set)) }));

  const addSet = (entryIndex: number) =>
    updateEntry(entryIndex, (entry) => {
      const last = entry.sets[entry.sets.length - 1];
      return { ...entry, sets: [...entry.sets, { reps: last?.reps ?? '10', weight: last?.weight ?? '', done: false }] };
    });

  const removeSet = (entryIndex: number) => updateEntry(entryIndex, (entry) => ({ ...entry, sets: entry.sets.slice(0, -1) }));

  const finish = async () => {
    if (doneSets === 0) {
      setSaveError('Coche au moins une série réalisée.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = buildStrengthPayload({
        plannedId: existing ? undefined : session!.id,
        sessionType: existing?.sessionType ?? session!.sessionType,
        plan,
        entries,
        durationMin: Math.max(1, Math.round((now - startedAt) / 60_000)),
        feeling,
        notes,
      });
      // Compléter une séance existante la met à jour ; sinon on en crée une.
      if (existing) await updateStrengthSession(existing._id, payload);
      else await saveStrengthSession(payload);
      emitAppEvent('sessions:changed');
      router.dismissAll();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  };

  const footer = (
    <View style={styles.footer}>
      {saveError ? (
        <Text variant="small" color="danger">
          {saveError}
        </Text>
      ) : null}
      <Button label={saving ? 'Enregistrement…' : `Terminer · ${doneSets}/${totalSets} séries`} icon="check" fullWidth disabled={saving} onPress={finish} />
    </View>
  );

  return (
    <Screen footer={footer}>
      <BackBar
        title="Séance muscu"
        right={
          <View accessibilityLabel={`Temps écoulé ${formatClock((now - startedAt) / 1000)}`} style={[styles.chrono, { backgroundColor: colors.subtle }]}>
            <Icon name="clock" size={14} color={colors.text2} />
            <Text variant="h3" tabular>
              {formatClock((now - startedAt) / 1000)}
            </Text>
          </View>
        }
      />

      <Section style={styles.titleBlock}>
        <Text variant="h1">{session?.title ?? 'Séance de renforcement'}</Text>
        <Text variant="body2">
          {existing
            ? 'Cette séance vient de Strava : les exercices sont ceux de ton coach, les séries restent à saisir.'
            : 'Coche chaque série une fois faite, ajuste les répétitions et la charge si besoin.'}
        </Text>
      </Section>

      {groupEntries(entries).map((section) => (
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
              {row.map(({ entry, index, slot }) => (
                <View key={entry.key} style={styles.cardSpace}>
                  {slot ? (
                    <Text variant="caption" color="accentInk" style={styles.slot}>
                      {slot}
                    </Text>
                  ) : null}
                  <ExerciseCard
                    entry={entry}
                    onChangeSet={(setIndex, patch) => changeSet(index, setIndex, patch)}
                    onAddSet={() => addSet(index)}
                    onRemoveSet={() => removeSet(index)}
                  />
                </View>
              ))}
            </View>
          ))}
        </Section>
      ))}

      <Section style={styles.tight}>
        <Card>
          <View style={styles.rowBetween}>
            <Text variant="sectionTitle">Ressenti</Text>
            <View style={styles.baseline}>
              <Text variant="stat" tabular>
                {feeling}
              </Text>
              <Text variant="small">/10</Text>
            </View>
          </View>
          <View style={styles.slider}>
            <FeelingSlider value={feeling} onChange={setFeeling} />
          </View>
        </Card>
      </Section>

      <Section>
        <Card>
          <Text variant="sectionTitle">Notes</Text>
          <TextInput
            accessibilityLabel="Notes pour ton coach"
            placeholder="Sensations, douleurs, charges à revoir…"
            placeholderTextColor={colors.text3}
            value={notes}
            onChangeText={setNotes}
            multiline
            style={[styles.notes, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.ink }]}
          />
        </Card>
      </Section>
    </Screen>
  );
}

type ExerciseCardProps = {
  entry: LogEntry;
  onChangeSet: (setIndex: number, patch: Partial<LogSet>) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
};

function ExerciseCard({ entry, onChangeSet, onAddSet, onRemoveSet }: ExerciseCardProps) {
  const { colors } = useTheme();
  const { target } = entry;
  const goal = [
    target.sets && target.reps ? `${target.sets} × ${target.reps}` : target.reps,
    target.weight ? `${formatDecimal(target.weight, target.weight % 1 ? 1 : 0)} kg` : null,
    target.rest ? `récup ${target.rest}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card>
      <View style={styles.exerciseHeader}>
        <View style={styles.flex}>
          <Text variant="h3">{entry.name}</Text>
          <Text variant="small" tabular>
            {[entry.muscle, goal ? `Objectif ${goal}` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

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
        <View style={styles.checkSpace} />
      </View>

      {entry.sets.map((set, setIndex) => (
        <View key={setIndex} style={[styles.setRow, set.done && { backgroundColor: colors.successSoft }]}>
          <Text variant="small" color="text3" tabular style={styles.setIndex}>
            {setIndex + 1}
          </Text>
          <NumberCell label={`Répétitions, série ${setIndex + 1}`} value={set.reps} onChange={(reps) => onChangeSet(setIndex, { reps })} />
          <NumberCell label={`Charge en kilos, série ${setIndex + 1}`} value={set.weight} decimal suffix="kg" onChange={(weight) => onChangeSet(setIndex, { weight })} />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: set.done }}
            accessibilityLabel={`Série ${setIndex + 1} faite`}
            hitSlop={6}
            onPress={() => onChangeSet(setIndex, { done: !set.done })}
            style={[styles.check, set.done ? { backgroundColor: colors.success, borderColor: colors.success } : { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
            {set.done ? <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.5} /> : null}
          </Pressable>
        </View>
      ))}

      <View style={styles.setActions}>
        <Button label="Série" icon="plus" variant="ghost" size="sm" onPress={onAddSet} />
        {entry.sets.length > 1 ? <Button label="Retirer" variant="ghost" size="sm" onPress={onRemoveSet} /> : null}
      </View>
    </Card>
  );
}

type NumberCellProps = { label: string; value: string; onChange: (value: string) => void; decimal?: boolean; suffix?: string };

function NumberCell({ label, value, onChange, decimal, suffix }: NumberCellProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.cell, { borderColor: colors.border, backgroundColor: colors.bg }]}>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={(text) => onChange(text.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, ''))}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        placeholder="—"
        placeholderTextColor={colors.text3}
        maxLength={5}
        selectTextOnFocus
        style={[styles.cellInput, { color: colors.ink }]}
      />
      {suffix ? (
        <Text variant="small" color="text3">
          {suffix}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleBlock: { gap: 4, paddingBottom: 16 },
  blockHead: { gap: 2, marginBottom: 10, paddingLeft: 10, borderLeftWidth: 3 },
  pair: { borderLeftWidth: 1, paddingLeft: 10, marginBottom: 6 },
  pairLabel: { marginBottom: 4 },
  slot: { marginBottom: 2 },
  cardSpace: { marginBottom: 8 },
  tight: { paddingBottom: 12 },
  chrono: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 10, borderRadius: radius.pill },
  exerciseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  setHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 4, paddingHorizontal: 6 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingVertical: 5, borderRadius: radius.sm },
  setIndex: { width: 36 },
  checkSpace: { width: 36 },
  cell: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 40, paddingHorizontal: 10, borderWidth: 1, borderRadius: radius.sm },
  cellInput: { flex: 1, minWidth: 0, fontFamily: fontFamily.semibold, fontSize: 15, paddingVertical: 0 },
  check: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  setActions: { flexDirection: 'row', gap: 4, marginTop: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  slider: { marginTop: 12 },
  notes: { minHeight: 88, marginTop: 10, padding: 12, borderWidth: 1, borderRadius: radius.md, fontFamily: fontFamily.regular, fontSize: 14, textAlignVertical: 'top' },
  footer: { gap: 8, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
});
