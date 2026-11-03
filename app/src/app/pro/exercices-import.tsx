import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';

import { BackBar, Button, Card, FormError, Screen, Section, Text } from '@/components/ui';
import { useBringIntoView } from '@/components/ui/keyboard-scroll';
import { useCoachActions } from '@/features/coach/queries';
import { parseExerciseList } from '@/features/sessions/exercise-library';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

const EXAMPLE = 'Step-up lesté ; quadriceps ; haltères\nPied-poing ; mollets ; poids du corps\nGainage latéral ; abdos';
const PREVIEW_ROWS = 8;

/** Import d'une liste d'exercices perso, collée depuis un tableur ou des notes. */
export default function ExercisesImportScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const areaRef = useRef<TextInputInstance>(null);
  const bringIntoView = useBringIntoView();
  const { importExercises } = useCoachActions();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const rows = parseExerciseList(text);

  const run = async () => {
    if (!rows.length) return;
    setSaving(true);
    setError(null);
    try {
      const { created, skipped } = await importExercises(rows.map(({ line, muscleLabel, equipmentLabel, ...exercise }) => exercise));
      const done = `${created} exercice${created > 1 ? 's' : ''} importé${created > 1 ? 's' : ''}`;
      setResult(skipped ? `${done}, ${skipped} déjà présent${skipped > 1 ? 's' : ''}.` : `${done}.`);
      setText('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Import impossible.');
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <View style={styles.footer}>
      <FormError message={error} />
      {result ? (
        <>
          <Text variant="small" color="successInk" accessibilityRole="alert">
            {result}
          </Text>
          <Button label="Voir mes exercices" icon="check" fullWidth onPress={() => router.back()} />
        </>
      ) : (
        <Button
          label={saving ? 'Import…' : rows.length ? `Importer ${rows.length} exercice${rows.length > 1 ? 's' : ''}` : 'Importer'}
          icon="check"
          fullWidth
          disabled={saving || !rows.length}
          onPress={run}
        />
      )}
    </View>
  );

  return (
    <Screen footer={footer}>
      <BackBar title="Importer une liste" />

      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <Text variant="body2">
            Une ligne par exercice : nom ; muscle ; équipement ; lien vidéo. Seul le nom est obligatoire. Vous pouvez coller des colonnes copiées depuis Excel ou Google Sheets.
          </Text>
          <TextInput
            ref={areaRef}
            onFocus={() => bringIntoView(areaRef.current)}
            accessibilityLabel="Liste d'exercices à importer"
            placeholder={EXAMPLE}
            placeholderTextColor={colors.text3}
            value={text}
            onChangeText={(value) => {
              setText(value);
              setResult(null);
            }}
            multiline
            autoCorrect={false}
            style={[styles.area, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.ink }]}
          />
        </Card>
      </Section>

      {rows.length ? (
        <Section>
          <Card>
            <Text variant="sectionTitle">Aperçu</Text>
            {rows.slice(0, PREVIEW_ROWS).map((row, index) => (
              <View key={row.line} style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text variant="h3" style={styles.flex}>
                  {row.name}
                </Text>
                <Text variant="small" color={row.muscleLabel ? 'text2' : 'text3'}>
                  {[row.muscleLabel ?? 'muscle non reconnu', row.equipmentLabel].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ))}
            {rows.length > PREVIEW_ROWS ? <Text variant="small">… et {rows.length - PREVIEW_ROWS} autres.</Text> : null}
            <Text variant="small" style={styles.note}>
              Les exercices que vous avez déjà (même nom) ne sont pas recréés. Tout reste modifiable ensuite.
            </Text>
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tight: { paddingBottom: 12 },
  gap: { gap: 12 },
  area: { minHeight: 160, padding: 12, borderWidth: 1, borderRadius: radius.md, fontFamily: fontFamily.regular, fontSize: 14, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  note: { marginTop: 8 },
  footer: { gap: 8, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
});
