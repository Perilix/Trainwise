import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, FormError, Text } from '@/components/ui';
import { useCoachActions } from '@/features/coach/queries';
import { formatDayShort, toIsoDay } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

type Feedback = { text: string | null; at: string | null } | null | undefined;

type Props = {
  feedback: Feedback;
  /** Renseigné côté coach : lui seul écrit. */
  editable?: { athleteId: string; kind: 'run' | 'strength'; sessionId: string; onSaved: () => void };
};

/**
 * Le retour du coach sur une séance réalisée.
 *
 * Le même bloc des deux côtés : le coach l'écrit et le corrige, l'athlète le
 * lit. Un seul retour par séance — il se modifie, il ne s'empile pas ; une
 * discussion se tient dans la messagerie, pas sous une sortie.
 */
export function CoachFeedbackCard({ feedback, editable }: Props) {
  const { colors } = useTheme();
  const { setSessionFeedback } = useCoachActions();

  const [local, setLocal] = useState<Feedback>(undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = (local === undefined ? feedback : local)?.text ?? '';
  const at = (local === undefined ? feedback : local)?.at ?? null;

  if (!editable && !current) return null;

  const save = async () => {
    if (!editable) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await setSessionFeedback(editable.athleteId, editable.kind, editable.sessionId, draft.trim());
      setLocal(saved);
      setEditing(false);
      editable.onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text variant="sectionTitle" style={styles.flex}>
          {editable ? 'Mon retour' : 'Le retour de ton coach'}
        </Text>
        {at ? <Text variant="caption">{formatDayShort(toIsoDay(new Date(at)))}</Text> : null}
      </View>

      {editing ? (
        <>
          <TextInput
            accessibilityLabel="Retour du coach"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={2000}
            placeholder="Ce que tu as vu de cette séance : ce qui va, ce qu’il faut ajuster la prochaine fois."
            placeholderTextColor={colors.text3}
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.borderStrong, color: colors.ink }]}
          />
          <FormError message={error} />
          <View style={styles.actions}>
            <Button label="Annuler" variant="secondary" size="sm" onPress={() => setEditing(false)} style={styles.flex} />
            <Button label={saving ? 'Enregistrement…' : 'Enregistrer'} size="sm" icon="check" disabled={saving} onPress={save} style={styles.flex} />
          </View>
          <Text variant="caption">L’athlète est prévenu à ton premier retour, pas à chaque correction.</Text>
        </>
      ) : current ? (
        <>
          <Text variant="body2" style={[styles.quote, { borderLeftColor: colors.borderStrong }]}>
            « {current} »
          </Text>
          {editable ? (
            <Button
              label="Modifier"
              variant="secondary"
              size="sm"
              icon="pen"
              onPress={() => {
                setDraft(current);
                setEditing(true);
              }}
            />
          ) : null}
        </>
      ) : (
        <>
          <Text variant="body2">Pas encore de retour sur cette séance.</Text>
          <Button
            label="Écrire un retour"
            variant="secondary"
            size="sm"
            icon="pen"
            onPress={() => {
              setDraft('');
              setEditing(true);
            }}
          />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quote: { paddingLeft: 12, borderLeftWidth: 2, fontStyle: 'italic' },
  input: { minHeight: 110, padding: 12, borderWidth: 1, borderRadius: radius.md, fontFamily: fontFamily.regular, fontSize: 14, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 8 },
});
