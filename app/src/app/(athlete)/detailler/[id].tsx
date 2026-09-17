import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackBar, Button, Card, FormError, Screen, Section, StateView, Text } from '@/components/ui';
import { useAthleteActions, useRunBlocksDraft } from '@/features/athlete/queries';
import { useSession } from '@/features/auth/session';
import { RunBlocksEditor } from '@/features/sessions/run-blocks-editor';
import { toEditable, toPayload, validateBlocks, type EditableBlock } from '@/features/sessions/run-blocks-model';
import { emitAppEvent } from '@/lib/app-events';
import { layout } from '@/theme/tokens';

/**
 * Déroulé réalisé d'une sortie : l'athlète décrit ce qu'il a vraiment fait,
 * en partant des tours reconstruits par Strava quand il y en a.
 */
export default function RunBlocksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const { data: draft, loading, error, refetch } = useRunBlocksDraft(id);
  const { saveRunBlocks } = useAthleteActions();
  const [blocks, setBlocks] = useState<EditableBlock[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!draft) {
    return (
      <Screen>
        <BackBar title="Déroulé réalisé" />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const current = blocks ?? toEditable(draft.blocks);

  const save = async () => {
    const problem = validateBlocks(current);
    if (problem) return setSaveError(problem);

    setSaving(true);
    setSaveError(null);
    try {
      await saveRunBlocks(id, toPayload(current, user?.vma));
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
          <Button label={saving ? 'Enregistrement…' : 'Enregistrer le déroulé'} icon="check" fullWidth disabled={saving} onPress={save} />
        </View>
      }>
      <BackBar title="Déroulé réalisé" />

      <Section style={styles.tight}>
        <Card>
          <Text variant="sectionTitle">{draft.title}</Text>
          <Text variant="body2" style={styles.intro}>
            {draft.auto
              ? 'Ces blocs viennent des tours enregistrés par ta montre. Corrige-les pour que ton coach voie ce que tu as vraiment fait.'
              : 'Décris ta séance bloc par bloc : échauffement, corps de séance, retour au calme.'}
          </Text>
        </Card>
      </Section>

      <RunBlocksEditor blocks={current} onChange={setBlocks} vma={user?.vma} realized />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tight: { paddingBottom: 12 },
  intro: { marginTop: 6 },
  footer: { gap: 8, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
});
