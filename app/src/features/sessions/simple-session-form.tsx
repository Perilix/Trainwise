import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, ChoicePill, Field, FormError, Section, Segmented, Text } from '@/components/ui';
import type { NewPlannedSession, Sport } from '@/features/athlete/types';
import { parseDecimal } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

export const SESSION_TYPES: Record<Sport, readonly (readonly [string, string])[]> = {
  running: [
    ['endurance', 'Endurance'],
    ['sortie_longue', 'Sortie longue'],
    ['fractionne', 'Fractionné'],
    ['tempo', 'Tempo'],
    ['cotes', 'Côtes'],
    ['fartlek', 'Fartlek'],
    ['recuperation', 'Récupération'],
  ],
  strength: [
    ['full_body', 'Corps complet'],
    ['upper_body', 'Haut du corps'],
    ['lower_body', 'Bas du corps'],
    ['push', 'Poussée'],
    ['pull', 'Tirage'],
    ['legs', 'Jambes'],
    ['core', 'Gainage'],
    ['hiit', 'HIIT'],
  ],
};

const PACE_PATTERN = /^\d{1,2}:[0-5]\d$/;

type Props = {
  date: string; // AAAA-MM-JJ
  submitLabel: string;
  /** Enregistre la séance ; une erreur levée s'affiche sous le formulaire. */
  onSubmit: (payload: NewPlannedSession) => Promise<void>;
};

/** Séance simple (type, objectifs, consignes), sans blocs : ajout par l'athlète ou le coach. */
export function SimpleSessionForm({ date, submitLabel, onSubmit }: Props) {
  const { colors } = useTheme();
  const [activity, setActivity] = useState<Sport>('running');
  const [sessionType, setSessionType] = useState('endurance');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [pace, setPace] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const running = activity === 'running';

  const changeActivity = (next: Sport) => {
    setActivity(next);
    setSessionType(SESSION_TYPES[next][0][0]);
    setError(null);
  };

  const submit = async () => {
    const km = parseDecimal(distance);
    const minutes = parseDecimal(duration);
    if ((running && distance.trim() && !(km && km > 0)) || (duration.trim() && !(minutes && minutes > 0))) {
      setError('La distance et la durée doivent être des nombres positifs.');
      return;
    }
    if (running && pace.trim() && !PACE_PATTERN.test(pace.trim())) {
      setError('Allure au format min:s, par exemple 5:30.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        date,
        activityType: activity,
        sessionType,
        targetDistance: running ? km : undefined,
        targetDuration: minutes ? Math.round(minutes) : undefined,
        targetPace: running && pace.trim() ? pace.trim() : undefined,
        description: description.trim() || undefined,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ajout impossible.');
      setSaving(false);
    }
  };

  const unit = (label: string) => (
    <Text variant="small" color="text3">
      {label}
    </Text>
  );

  return (
    <>
      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <Segmented<Sport>
            options={[
              { value: 'running', label: 'Course' },
              { value: 'strength', label: 'Muscu' },
            ]}
            value={activity}
            onChange={changeActivity}
          />
          <View>
            <Text variant="caption" style={styles.fieldLabel}>
              Type de séance
            </Text>
            <View accessibilityRole="radiogroup" style={styles.pills}>
              {SESSION_TYPES[activity].map(([value, label]) => (
                <ChoicePill key={value} role="radio" label={label} selected={value === sessionType} onPress={() => setSessionType(value)} />
              ))}
            </View>
          </View>
        </Card>
      </Section>

      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <Text variant="h2">Objectifs</Text>
          {running ? (
            <View style={styles.row}>
              <View style={styles.flex}>
                <Field label="Distance" placeholder="10" keyboardType="decimal-pad" value={distance} onChangeText={setDistance} trailing={unit('km')} />
              </View>
              <View style={styles.flex}>
                <Field label="Allure" placeholder="5:30" keyboardType="numbers-and-punctuation" value={pace} onChangeText={setPace} trailing={unit('/km')} />
              </View>
            </View>
          ) : null}
          <Field label="Durée" placeholder={running ? '50' : '45'} keyboardType="number-pad" value={duration} onChangeText={setDuration} trailing={unit('min')} />
          <Text variant="small">Tout est facultatif.</Text>
        </Card>
      </Section>

      <Section style={styles.tight}>
        <Card>
          <Text variant="h2">Consignes</Text>
          <TextInput
            accessibilityLabel="Consignes de la séance"
            placeholder={running ? 'Ex. footing en aisance, 4 lignes droites à la fin' : 'Ex. 4 × 10 squats, 3 × 12 pompes'}
            placeholderTextColor={colors.text3}
            value={description}
            onChangeText={setDescription}
            multiline
            style={[styles.description, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.ink }]}
          />
        </Card>
      </Section>

      <Section style={styles.submit}>
        <FormError message={error} />
        <Button label={saving ? 'Ajout…' : submitLabel} icon="plus" fullWidth disabled={saving} onPress={submit} />
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tight: { paddingBottom: 12 },
  gap: { gap: 14 },
  fieldLabel: { marginBottom: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  description: { minHeight: 96, marginTop: 10, padding: 12, borderWidth: 1, borderRadius: radius.md, fontFamily: fontFamily.regular, fontSize: 14, textAlignVertical: 'top' },
  submit: { gap: 8 },
});
