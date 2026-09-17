import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, avatarToneFor, BackBar, Button, Card, FormError, Icon, Screen, Section, StateView, Text } from '@/components/ui';
import { useCoachActions, useCoachAthleteList } from '@/features/coach/queries';
import { mainPercent, useTemplate } from '@/features/coach/templates';
import { DateStepper } from '@/features/sessions/date-stepper';
import { paceFromPercent } from '@/features/sessions/run-blocks-model';
import { emitAppEvent } from '@/lib/app-events';
import { formatDecimal, toIsoDay } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { layout } from '@/theme/tokens';

export default function AssignTemplateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { data: template } = useTemplate(id);
  const { data: athletes, loading, error, refetch } = useCoachAthleteList();
  const { assignTemplateToAthletes } = useCoachActions();
  const [date, setDate] = useState(() => toIsoDay(new Date()));
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const main = template?.sport === 'running' ? mainPercent(template) : undefined;
  const allSelected = Boolean(athletes?.length) && selected.length === athletes?.length;
  const count = selected.length;

  const toggle = (athleteId: string) => setSelected((list) => (list.includes(athleteId) ? list.filter((item) => item !== athleteId) : [...list, athleteId]));

  const submit = async () => {
    if (!count) return;
    setSaving(true);
    setSaveError(null);
    try {
      await assignTemplateToAthletes(id, selected, date);
      emitAppEvent('sessions:changed');
      emitAppEvent('templates:changed');
      router.back();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Planification impossible.');
      setSaving(false);
    }
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <FormError message={saveError} />
          <Button
            label={saving ? 'Planification…' : count ? `Planifier pour ${count} athlète${count > 1 ? 's' : ''}` : 'Choisissez des athlètes'}
            icon="calendar"
            fullWidth
            disabled={!count || saving}
            onPress={submit}
          />
        </View>
      }>
      <BackBar title="Planifier la séance" />

      {template ? (
        <Section style={styles.intro}>
          <Text variant="h2">{template.name}</Text>
          <Text variant="small">{main ? 'Les allures sont calculées avec la VMA de chaque athlète.' : 'La séance est ajoutée au planning de chaque athlète choisi.'}</Text>
        </Section>
      ) : null}

      <Section style={styles.tight}>
        <DateStepper date={date} onChange={setDate} />
      </Section>

      <Section>
        <View style={styles.rowBetween}>
          <Text variant="sectionTitle">Athlètes</Text>
          {athletes?.length ? <Button label={allSelected ? 'Aucun' : 'Tous'} variant="ghost" size="sm" onPress={() => setSelected(allSelected ? [] : athletes.map((athlete) => athlete.id))} /> : null}
        </View>
        {athletes ? (
          athletes.length ? (
            <Card padding={0} style={styles.list}>
              {athletes.map((athlete, index) => {
                const checked = selected.includes(athlete.id);
                const pace = paceFromPercent(athlete.vma, main?.percent);
                return (
                  <Pressable
                    key={athlete.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={athlete.name}
                    onPress={() => toggle(athlete.id)}
                    style={[styles.athlete, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <Avatar initials={athlete.initials} size={40} tone={avatarToneFor(athlete.id)} />
                    <View style={styles.flex}>
                      <Text variant="h3">{athlete.name}</Text>
                      {main ? (
                        <Text variant="small" color={pace ? 'text2' : 'warningInk'} tabular>
                          {pace ? `VMA ${formatDecimal(athlete.vma ?? 0)} · ${pace} /km` : 'VMA manquante : allure non calculée'}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.check, checked ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.borderStrong }]}>
                      {checked ? <Icon name="check" size={14} color={colors.onPrimary} strokeWidth={2.5} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          ) : (
            <Card style={styles.list}>
              <Text variant="body2">Vous n’avez pas encore d’athlète. Invitez-en depuis l’accueil.</Text>
            </Card>
          )
        ) : (
          <StateView loading={loading} error={error} onRetry={refetch} />
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { gap: 2, paddingBottom: 12 },
  tight: { paddingBottom: 16 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { paddingHorizontal: 16, marginTop: 8 },
  athlete: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  footer: { gap: 8, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
});
