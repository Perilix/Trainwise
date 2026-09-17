import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { BackBar, Button, Card, ChoicePill, Field, FormError, Icon, IconButton, Screen, Section, StateView, Text } from '@/components/ui';
import { useAthleteActions, useAthleteProfile } from '@/features/athlete/queries';
import { formatDayShort, toIsoDay } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

const DISCIPLINES = [
  { value: '5km', label: '5 km' },
  { value: '10km', label: '10 km' },
  { value: 'semi_marathon', label: 'Semi' },
  { value: 'marathon', label: 'Marathon' },
  { value: 'trail', label: 'Trail' },
  { value: 'ultra', label: 'Ultra' },
  { value: 'cross_country', label: 'Cross' },
  { value: 'piste', label: 'Piste' },
  { value: 'autre', label: 'Autre' },
];

const PRIORITIES = [
  { value: 'A' as const, label: 'A · objectif principal' },
  { value: 'B' as const, label: 'B · intermédiaire' },
  { value: 'C' as const, label: 'C · préparation' },
];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const TARGET_TIME = /^\d{1,2}:\d{2}(:\d{2})?$/;

type Draft = { id: string | null; name: string; date: string; discipline: string; targetTime: string; priority: 'A' | 'B' | 'C' };

const emptyDraft = (): Draft => ({ id: null, name: '', date: '', discipline: '10km', targetTime: '', priority: 'A' });

/** Liste des compétitions à venir, avec ajout, modification et suppression. */
export default function CompetitionsScreen() {
  const { colors } = useTheme();
  const { data: profile, loading, error, refetch } = useAthleteProfile();
  const { saveCompetition, deleteCompetition } = useAthleteActions();

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!draft.name.trim()) return setFormError('Donne un nom à ta compétition.');
    if (!ISO_DAY.test(draft.date)) return setFormError('La date doit être au format AAAA-MM-JJ (ex. 2026-10-04).');
    if (draft.targetTime.trim() && !TARGET_TIME.test(draft.targetTime.trim())) return setFormError('L’objectif doit ressembler à 3:15:00 ou 45:00.');

    setSaving(true);
    setFormError(null);
    try {
      await saveCompetition(draft.id, {
        name: draft.name.trim(),
        date: new Date(`${draft.date}T09:00:00`).toISOString(),
        discipline: draft.discipline,
        targetTime: draft.targetTime.trim() || null,
        priority: draft.priority,
      });
      setDraft(emptyDraft());
      refetch();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (id: string, name: string) =>
    Alert.alert('Supprimer', `Supprimer « ${name} » de tes compétitions ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCompetition(id);
            if (draft.id === id) setDraft(emptyDraft());
            refetch();
          } catch (reason) {
            Alert.alert('Compétitions', reason instanceof Error ? reason.message : 'Suppression impossible.');
          }
        },
      },
    ]);

  if (!profile) {
    return (
      <Screen>
        <BackBar title="Compétitions" />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button
            label={saving ? 'Enregistrement…' : draft.id ? 'Enregistrer les modifications' : 'Ajouter la compétition'}
            icon={draft.id ? 'check' : 'plus'}
            fullWidth
            disabled={saving}
            onPress={save}
          />
        </View>
      }>
      <BackBar title="Compétitions" right={draft.id ? <Button label="Annuler" variant="ghost" size="sm" onPress={() => setDraft(emptyDraft())} /> : undefined} />

      {profile.competitions.length ? (
        <Section style={styles.tight}>
          <Text variant="sectionTitle" style={styles.listTitle}>
            À venir
          </Text>
          <Card padding={0}>
            {profile.competitions.map((competition, index) => (
              <View key={competition.id} style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={[styles.priority, { backgroundColor: competition.priority === 'A' ? colors.primary : colors.subtle }]}>
                  <Text style={{ color: competition.priority === 'A' ? colors.onPrimary : colors.text2 }}>{competition.priority}</Text>
                </View>
                <View style={styles.flex}>
                  <Text variant="h3" numberOfLines={1}>
                    {competition.name}
                  </Text>
                  <Text variant="small">
                    {formatDayShort(competition.date)}
                    {competition.goal ? ` · Objectif ${competition.goal}` : ''}
                  </Text>
                </View>
                <Button
                  label="Modifier"
                  variant="secondary"
                  size="sm"
                  onPress={() =>
                    setDraft({
                      id: competition.id,
                      name: competition.name,
                      date: competition.date,
                      discipline: competition.discipline ?? '10km',
                      targetTime: competition.goal ?? '',
                      priority: competition.priority,
                    })
                  }
                />
                <IconButton icon="x" size={36} accessibilityLabel={`Supprimer ${competition.name}`} color={colors.danger} onPress={() => remove(competition.id, competition.name)} />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section>
        <Card style={styles.gap}>
          <View style={styles.formHeader}>
            <Icon name="flag" size={18} color={colors.accentInk} />
            <Text variant="sectionTitle">{draft.id ? 'Modifier la compétition' : 'Nouvelle compétition'}</Text>
          </View>

          <Field label="Nom" placeholder="Marathon de Lyon" value={draft.name} onChangeText={set('name')} />
          <Field label="Date" placeholder={toIsoDay(new Date())} autoCapitalize="none" value={draft.date} onChangeText={set('date')} />

          <View>
            <Text variant="caption">Discipline</Text>
            <View accessibilityRole="radiogroup" style={styles.pills}>
              {DISCIPLINES.map((option) => (
                <ChoicePill key={option.value} role="radio" label={option.label} selected={draft.discipline === option.value} onPress={() => set('discipline')(option.value)} />
              ))}
            </View>
          </View>

          <Field label="Objectif de temps" placeholder="3:15:00" autoCapitalize="none" value={draft.targetTime} onChangeText={set('targetTime')} />

          <View>
            <Text variant="caption">Priorité</Text>
            <View accessibilityRole="radiogroup" style={styles.pills}>
              {PRIORITIES.map((option) => (
                <ChoicePill key={option.value} role="radio" label={option.label} selected={draft.priority === option.value} onPress={() => set('priority')(option.value)} />
              ))}
            </View>
          </View>

          <FormError message={formError} />
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tight: { paddingBottom: 12 },
  gap: { gap: 14 },
  listTitle: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  priority: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
});
