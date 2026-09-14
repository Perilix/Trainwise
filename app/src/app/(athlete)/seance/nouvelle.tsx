import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BackBar, Button, Card, Field, FormError, IconButton, Screen, Section, Segmented, Text } from '@/components/ui';
import { useAthleteActions } from '@/features/athlete/queries';
import type { Sport } from '@/features/athlete/types';
import { emitAppEvent } from '@/lib/app-events';
import { addDays } from '@/lib/dates';
import { formatDayLong, parseDay, parseDecimal, toIsoDay } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

const SESSION_TYPES: Record<Sport, readonly (readonly [string, string])[]> = {
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

export default function NewPlannedSessionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ date?: string }>();
  const { createPlannedSession } = useAthleteActions();
  const [date, setDate] = useState(() => (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : toIsoDay(new Date())));
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

  const save = async () => {
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
      await createPlannedSession({
        date,
        activityType: activity,
        sessionType,
        targetDistance: running ? km : undefined,
        targetDuration: minutes ? Math.round(minutes) : undefined,
        targetPace: running && pace.trim() ? pace.trim() : undefined,
        description: description.trim() || undefined,
      });
      emitAppEvent('sessions:changed');
      router.back();
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
    <Screen
      footer={
        <View style={styles.footer}>
          <FormError message={error} />
          <Button label={saving ? 'Ajout…' : 'Ajouter au planning'} icon="plus" fullWidth disabled={saving} onPress={save} />
        </View>
      }>
      <BackBar title="Nouvelle séance" />

      <Section style={styles.tight}>
        <Card style={styles.dateCard}>
          <IconButton icon="chevronLeft" size={36} accessibilityLabel="Jour précédent" onPress={() => setDate((current) => toIsoDay(addDays(parseDay(current), -1)))} />
          <View style={styles.dateLabel}>
            <Text variant="caption">Date</Text>
            <Text variant="h3">{formatDayLong(date)}</Text>
          </View>
          <IconButton icon="chevronRight" size={36} accessibilityLabel="Jour suivant" onPress={() => setDate((current) => toIsoDay(addDays(parseDay(current), 1)))} />
        </Card>
      </Section>

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
              {SESSION_TYPES[activity].map(([value, label]) => {
                const selected = value === sessionType;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setSessionType(value)}
                    style={[styles.pill, selected ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text variant="small" style={{ color: selected ? colors.onPrimary : colors.ink, fontFamily: fontFamily.medium }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
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
          <Text variant="small">Tout est facultatif : ajoute seulement ce qui t’aide.</Text>
        </Card>
      </Section>

      <Section>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tight: { paddingBottom: 12 },
  gap: { gap: 14 },
  dateCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 10 },
  dateLabel: { flex: 1, alignItems: 'center' },
  fieldLabel: { marginBottom: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  description: { minHeight: 96, marginTop: 10, padding: 12, borderWidth: 1, borderRadius: radius.md, fontFamily: fontFamily.regular, fontSize: 14, textAlignVertical: 'top' },
  footer: { gap: 8, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
});
