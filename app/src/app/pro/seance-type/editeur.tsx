import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BackBar, Button, Card, ChoicePill, Field, FormError, Screen, Section, StateView, Text } from '@/components/ui';
import { useCoachActions } from '@/features/coach/queries';
import { templateRunBlocks, toTemplateBlocks, useTemplate } from '@/features/coach/templates';
import { RunBlocksEditor, Stepper } from '@/features/sessions/run-blocks-editor';
import { newCooldown, newWarmup, toEditable, validateBlocks, type EditableBlock } from '@/features/sessions/run-blocks-model';
import { SESSION_TYPES } from '@/features/sessions/simple-session-form';
import { emitAppEvent } from '@/lib/app-events';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

export default function TemplateEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { data: template, loading, error, refetch } = useTemplate(id);
  const { createTemplate, updateTemplate } = useCoachActions();
  const [name, setName] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<EditableBlock[] | null>(() => (id ? null : [newWarmup(), newCooldown()]));
  // Une séance type n'a pas d'athlète : les allures sont prévisualisées pour une VMA choisie.
  const [previewVma, setPreviewVma] = useState(16);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const title = id ? 'Modifier la séance type' : 'Nouvelle séance type';

  if (id && !template) {
    return (
      <Screen>
        <BackBar title={title} />
        <StateView loading={loading} error={error ?? (loading ? null : 'Séance introuvable.')} onRetry={refetch} />
      </Screen>
    );
  }

  if (template && template.sport !== 'running') {
    return (
      <Screen>
        <BackBar title={title} />
        <Section>
          <Card>
            <Text variant="body2">L’édition des séances de musculation arrive bientôt dans l’app.</Text>
          </Card>
        </Section>
      </Screen>
    );
  }

  const currentName = name ?? template?.name ?? '';
  const currentType = sessionType ?? template?.sessionType ?? 'fractionne';
  const currentDescription = description ?? template?.description ?? '';
  const currentBlocks = blocks ?? toEditable(templateRunBlocks(template?.runBlocks ?? []));

  const save = async () => {
    if (!currentName.trim()) {
      setSaveError('Donnez un nom à la séance.');
      return;
    }
    const problem = validateBlocks(currentBlocks);
    if (problem) {
      setSaveError(problem);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const payload = {
      name: currentName.trim(),
      description: currentDescription.trim(),
      sport: 'running' as const,
      sessionType: currentType,
      targetDistance: template?.targetDistance ?? null,
      targetDuration: template?.targetDuration ?? null,
      runBlocks: toTemplateBlocks(currentBlocks),
      strengthPlan: null,
    };
    try {
      if (id) await updateTemplate(id, payload);
      else await createTemplate(payload);
      emitAppEvent('templates:changed');
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
          <Button label={saving ? 'Enregistrement…' : 'Enregistrer dans la bibliothèque'} icon="check" fullWidth disabled={saving} onPress={save} />
        </View>
      }>
      <BackBar title={title} />

      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <Field label="Nom" placeholder="Ex. Fractionné 12 × 400 m" value={currentName} onChangeText={setName} />
          <View>
            <Text variant="caption" style={styles.label}>
              Type de séance
            </Text>
            <View accessibilityRole="radiogroup" style={styles.pills}>
              {SESSION_TYPES.running.map(([value, label]) => (
                <ChoicePill key={value} role="radio" label={label} selected={value === currentType} onPress={() => setSessionType(value)} />
              ))}
            </View>
          </View>
          <View>
            <Text variant="caption" color="ink" style={styles.label}>
              Description
            </Text>
            <TextInput
              accessibilityLabel="Description de la séance"
              placeholder="Objectif, public visé, consignes générales…"
              placeholderTextColor={colors.text3}
              value={currentDescription}
              onChangeText={setDescription}
              multiline
              style={[styles.description, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.ink }]}
            />
          </View>
        </Card>
      </Section>

      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <Stepper label="VMA d’aperçu (km/h)" value={previewVma} min={10} max={25} onChange={setPreviewVma} />
          <Text variant="small">Les allures affichées sont un aperçu : à la planification, elles sont calculées avec la VMA de chaque athlète.</Text>
        </Card>
      </Section>

      <Section>
        <RunBlocksEditor blocks={currentBlocks} onChange={setBlocks} vma={previewVma} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tight: { paddingBottom: 12 },
  gap: { gap: 14 },
  label: { marginBottom: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  description: { minHeight: 80, padding: 12, borderWidth: 1, borderRadius: radius.md, fontFamily: fontFamily.regular, fontSize: 14, textAlignVertical: 'top' },
  footer: { gap: 8, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
});
