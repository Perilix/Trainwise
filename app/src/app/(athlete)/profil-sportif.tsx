import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackBar, Button, Card, ChoicePill, Field, FormError, Screen, Section, Text } from '@/components/ui';
import { useAthleteActions } from '@/features/athlete/queries';
import { useSession } from '@/features/auth/session';
import type { ApiUser } from '@/lib/api-types';
import { parseDecimal } from '@/lib/format';

type Level = NonNullable<ApiUser['runningLevel']>;

const LEVELS: { value: Level; label: string }[] = [
  { value: 'debutant', label: 'Débutant' },
  { value: 'intermediaire', label: 'Intermédiaire' },
  { value: 'confirme', label: 'Confirmé' },
  { value: 'expert', label: 'Expert' },
];

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const TIMES = [
  { value: 'matin', label: 'Matin' },
  { value: 'midi', label: 'Midi' },
  { value: 'soir', label: 'Soir' },
];

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

/** Édition du profil sportif : ce qui sert au coach et à la génération des allures. */
export default function SportProfileScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { updateSportProfile } = useAthleteActions();

  const [level, setLevel] = useState<Level | undefined>(user?.runningLevel);
  const [frequency, setFrequency] = useState(() => (user?.weeklyFrequency ? String(user.weeklyFrequency) : ''));
  const [vma, setVma] = useState(() => (user?.vma ? String(user.vma) : ''));
  const [fcmax, setFcmax] = useState(() => (user?.fcmax ? String(user.fcmax) : ''));
  const [height, setHeight] = useState(() => (user?.height ? String(user.height) : ''));
  const [weight, setWeight] = useState(() => (user?.weight ? String(user.weight) : ''));
  const [injuries, setInjuries] = useState(() => user?.injuries ?? '');
  const [days, setDays] = useState<string[]>(() => user?.availableDays ?? []);
  const [time, setTime] = useState(() => user?.preferredTime ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numberOr = (value: string, { min, max, label }: { min: number; max: number; label: string }) => {
    if (!value.trim()) return { ok: true as const, value: undefined };
    const parsed = parseDecimal(value);
    if (parsed === undefined || parsed < min || parsed > max) return { ok: false as const, message: `${label} doit être un nombre entre ${min} et ${max}.` };
    return { ok: true as const, value: parsed };
  };

  const save = async () => {
    const fields = {
      weeklyFrequency: numberOr(frequency, { min: 1, max: 14, label: 'La fréquence' }),
      vma: numberOr(vma, { min: 8, max: 25, label: 'La VMA' }),
      fcmax: numberOr(fcmax, { min: 120, max: 230, label: 'La FC max' }),
      height: numberOr(height, { min: 120, max: 230, label: 'La taille' }),
      weight: numberOr(weight, { min: 30, max: 200, label: 'Le poids' }),
    };
    const invalid = Object.values(fields).find((field) => !field.ok);
    if (invalid && !invalid.ok) {
      setError(invalid.message);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateSportProfile({
        runningLevel: level,
        weeklyFrequency: fields.weeklyFrequency.value === undefined ? undefined : Math.round(fields.weeklyFrequency.value),
        vma: fields.vma.value,
        fcmax: fields.fcmax.value === undefined ? undefined : Math.round(fields.fcmax.value),
        height: fields.height.value === undefined ? undefined : Math.round(fields.height.value),
        weight: fields.weight.value,
        injuries: injuries.trim(),
        availableDays: days,
        preferredTime: time || undefined,
      });
      router.back();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button label={saving ? 'Enregistrement…' : 'Enregistrer'} icon="check" fullWidth disabled={saving} onPress={save} />
        </View>
      }>
      <BackBar title="Profil sportif" />

      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <View>
            <Text variant="sectionTitle">Niveau</Text>
            <View accessibilityRole="radiogroup" style={styles.pills}>
              {LEVELS.map((option) => (
                <ChoicePill key={option.value} role="radio" label={option.label} selected={level === option.value} onPress={() => setLevel(option.value)} />
              ))}
            </View>
          </View>
          <Field label="Séances par semaine" placeholder="4" keyboardType="number-pad" value={frequency} onChangeText={setFrequency} />
        </Card>
      </Section>

      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <Text variant="sectionTitle">Repères physiques</Text>
          <View style={styles.row}>
            <Field label="VMA (km/h)" placeholder="16,5" keyboardType="decimal-pad" value={vma} onChangeText={setVma} containerStyle={styles.flex} />
            <Field label="FC max" placeholder="191" keyboardType="number-pad" value={fcmax} onChangeText={setFcmax} containerStyle={styles.flex} />
          </View>
          <View style={styles.row}>
            <Field label="Taille (cm)" placeholder="178" keyboardType="number-pad" value={height} onChangeText={setHeight} containerStyle={styles.flex} />
            <Field label="Poids (kg)" placeholder="71" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} containerStyle={styles.flex} />
          </View>
          <Text variant="small">La VMA sert à calculer les allures de tes séances.</Text>
        </Card>
      </Section>

      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <View>
            <Text variant="sectionTitle">Disponibilités</Text>
            <View style={styles.pills}>
              {DAYS.map((day, index) => (
                <ChoicePill key={day} label={DAY_LABELS[index]} selected={days.includes(day)} onPress={() => setDays((current) => toggle(current, day))} />
              ))}
            </View>
          </View>
          <View>
            <Text variant="caption">Créneau préféré</Text>
            <View accessibilityRole="radiogroup" style={styles.pills}>
              {TIMES.map((option) => (
                <ChoicePill
                  key={option.value}
                  role="radio"
                  label={option.label}
                  selected={time === option.value}
                  onPress={() => setTime((current) => (current === option.value ? '' : option.value))}
                />
              ))}
            </View>
          </View>
        </Card>
      </Section>

      <Section>
        <Card style={styles.gap}>
          <Text variant="sectionTitle">Blessures et contraintes</Text>
          <Field placeholder="Tendinite d’Achille (2025), genou sensible…" multiline value={injuries} onChangeText={setInjuries} />
        </Card>
        <FormError message={error} style={styles.error} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tight: { paddingBottom: 12 },
  gap: { gap: 14 },
  row: { flexDirection: 'row', gap: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  error: { marginTop: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
});
