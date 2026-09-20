import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BackBar, Button, Card, ChoicePill, FormError, Screen, Section, StateView, Text } from '@/components/ui';
import { useBringIntoView } from '@/components/ui/keyboard-scroll';
import { useAthleteFiche, useCoachActions, useCoachPlannedRaw } from '@/features/coach/queries';
import { DateStepper } from '@/features/sessions/date-stepper';
import { ExpectedFeelingPicker } from '@/features/sessions/expected-feeling';
import { RunBlocksEditor, Stepper } from '@/features/sessions/run-blocks-editor';
import { newCooldown, newWarmup, toEditable, toPayload, validateBlocks, type EditableBlock } from '@/features/sessions/run-blocks-model';
import { SESSION_TYPES } from '@/features/sessions/simple-session-form';
import { StrengthPlanEditor } from '@/features/sessions/strength-plan-editor';
import { toEditableStrength, toStrengthPayload, validateStrength, type EditableStrengthPlan } from '@/features/sessions/strength-plan-model';
import { emitAppEvent } from '@/lib/app-events';
import { toIsoDay } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

export default function CoachSessionEditorScreen() {
  const { id, planId, date: dateParam, sport: sportParam } = useLocalSearchParams<{ id: string; planId?: string; date?: string; sport?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const areaRef = useRef<TextInput>(null);
  const bringIntoView = useBringIntoView();
  const { data: raw, loading, error, refetch } = useCoachPlannedRaw(id, planId);
  const { data: fiche } = useAthleteFiche(id);
  const { createAthleteSession, updateAthleteSession } = useCoachActions();
  const [date, setDate] = useState(() => (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : toIsoDay(new Date())));
  const [sessionType, setSessionType] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  /** `undefined` tant que le coach n'y a pas touché : la valeur de la séance fait foi. */
  const [expectedFeeling, setExpectedFeeling] = useState<number | null | undefined>(undefined);
  // Nouvelle séance : échauffement et retour au calme proposés d'emblée.
  const [blocks, setBlocks] = useState<EditableBlock[] | null>(() => (planId ? null : [newWarmup(), newCooldown()]));
  const [plan, setPlan] = useState<EditableStrengthPlan | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const strength = (raw ? raw.activityType : sportParam) === 'strength';
  const title = planId ? 'Modifier la séance' : strength ? 'Séance de musculation' : 'Séance par blocs';

  if (planId && !raw) {
    return (
      <Screen>
        <BackBar title={title} />
        <StateView loading={loading} error={error ?? (loading ? null : 'Séance introuvable.')} onRetry={refetch} />
      </Screen>
    );
  }

  const vma = fiche?.physical.vma;
  const currentBlocks = blocks ?? toEditable(raw?.runBlocks ?? []);
  const currentPlan = plan ?? toEditableStrength(raw?.strengthPlan);
  const currentType = sessionType ?? raw?.sessionType ?? (strength ? 'full_body' : 'fractionne');
  const currentDescription = description ?? raw?.description ?? '';
  const currentFeeling = expectedFeeling === undefined ? (raw?.expectedFeeling ?? null) : expectedFeeling;
  const currentDuration = duration ?? raw?.strengthPlan?.estimatedDuration ?? raw?.targetDuration ?? 45;

  const save = async () => {
    const problem = strength ? validateStrength(currentPlan) : validateBlocks(currentBlocks);
    if (problem) {
      setSaveError(problem);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const content = strength ? { strengthPlan: toStrengthPayload(currentPlan, currentDuration), targetDuration: currentDuration } : { runBlocks: toPayload(currentBlocks, vma) };
    try {
      if (planId) {
        await updateAthleteSession(id, planId, { sessionType: currentType, description: currentDescription.trim(), expectedFeeling: currentFeeling, ...content });
      } else {
        await createAthleteSession(id, {
          date,
          activityType: strength ? 'strength' : 'running',
          sessionType: currentType,
          description: currentDescription.trim() || undefined,
          expectedFeeling: currentFeeling,
          ...content,
        });
      }
      emitAppEvent('sessions:changed');
      router.back();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <FormError message={saveError} />
          <Button label={saving ? 'Enregistrement…' : planId ? 'Enregistrer les modifications' : 'Ajouter au planning'} icon="check" fullWidth disabled={saving} onPress={save} />
        </View>
      }>
      <BackBar title={title} />

      {fiche ? (
        <Section style={styles.athlete}>
          <Text variant="small">
            Pour {fiche.name}
            {strength ? '' : vma ? ` · VMA ${String(vma).replace('.', ',')} km/h` : ' · VMA non renseignée'}
          </Text>
        </Section>
      ) : null}

      {!planId ? (
        <Section style={styles.tight}>
          <DateStepper date={date} onChange={setDate} />
        </Section>
      ) : null}

      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <View>
            <Text variant="caption" style={styles.label}>
              Type de séance
            </Text>
            <View accessibilityRole="radiogroup" style={styles.pills}>
              {SESSION_TYPES[strength ? 'strength' : 'running'].map(([value, label]) => (
                <ChoicePill key={value} role="radio" label={label} selected={value === currentType} onPress={() => setSessionType(value)} />
              ))}
            </View>
          </View>
          {strength ? <Stepper label="Durée estimée (min)" value={currentDuration} min={10} max={150} step={5} onChange={setDuration} /> : null}
          <View>
            <Text variant="caption" color="ink" style={styles.label}>
              Consignes
            </Text>
            <TextInput
            ref={areaRef}
            onFocus={() => bringIntoView(areaRef.current)}
              accessibilityLabel="Consignes de la séance"
              placeholder="Objectif de la séance, sensations attendues…"
              placeholderTextColor={colors.text3}
              value={currentDescription}
              onChangeText={setDescription}
              multiline
              style={[styles.description, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.ink }]}
            />
          </View>
          <View>
            <Text variant="caption" color="ink" style={styles.label}>
              Difficulté attendue
            </Text>
            <ExpectedFeelingPicker value={currentFeeling} onChange={setExpectedFeeling} />
          </View>
        </Card>
      </Section>

      <Section>
        {strength ? <StrengthPlanEditor plan={currentPlan} onChange={setPlan} /> : <RunBlocksEditor blocks={currentBlocks} onChange={setBlocks} vma={vma} />}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  athlete: { paddingBottom: 10 },
  tight: { paddingBottom: 12 },
  gap: { gap: 14 },
  label: { marginBottom: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  description: { minHeight: 80, padding: 12, borderWidth: 1, borderRadius: radius.md, fontFamily: fontFamily.regular, fontSize: 14, textAlignVertical: 'top' },
  footer: { gap: 8, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
});
