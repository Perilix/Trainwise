import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BackBar, Button, Card, ChoicePill, Field, FormError, Screen, Section, Text } from '@/components/ui';
import { useBringIntoView } from '@/components/ui/keyboard-scroll';
import { useSession } from '@/features/auth/session';
import { DIPLOMA_OPTIONS, DISCIPLINE_OPTIONS } from '@/features/coach/profile-options';
import { useCoachActions } from '@/features/coach/queries';
import { parseDecimal } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

export default function CoachProfileEditScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const areaRef = useRef<TextInput>(null);
  const bringIntoView = useBringIntoView();
  const { user } = useSession();
  const { updateProfile } = useCoachActions();
  const [disciplines, setDisciplines] = useState<string[]>(() => user?.disciplines ?? []);
  const [diplomas, setDiplomas] = useState<string[]>(() => user?.diplomas ?? []);
  const [experience, setExperience] = useState(() => (user?.experience ? String(user.experience) : ''));
  const [bio, setBio] = useState(() => user?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const years = parseDecimal(experience);
    if (experience.trim() && (years === undefined || years < 0 || years > 60)) {
      setError('L’expérience doit être un nombre d’années entre 0 et 60.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ disciplines, diplomas, experience: years === undefined ? undefined : Math.round(years), bio: bio.trim() });
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
          <FormError message={error} />
          <Button label={saving ? 'Enregistrement…' : 'Enregistrer'} icon="check" fullWidth disabled={saving} onPress={save} />
        </View>
      }>
      <BackBar title="Modifier le profil" />

      <Section style={styles.tight}>
        <Card>
          <Text variant="sectionTitle">Disciplines</Text>
          <View style={styles.pills}>
            {DISCIPLINE_OPTIONS.map((option) => (
              <ChoicePill key={option.value} label={option.label} selected={disciplines.includes(option.value)} onPress={() => setDisciplines((list) => toggle(list, option.value))} />
            ))}
          </View>
        </Card>
      </Section>

      <Section style={styles.tight}>
        <Card>
          <Text variant="sectionTitle">Diplômes et certifications</Text>
          <View style={styles.pills}>
            {DIPLOMA_OPTIONS.map((option) => (
              <ChoicePill key={option.value} label={option.label} selected={diplomas.includes(option.value)} onPress={() => setDiplomas((list) => toggle(list, option.value))} />
            ))}
          </View>
        </Card>
      </Section>

      <Section>
        <Card style={styles.gap}>
          <Field label="Années d’expérience" placeholder="8" keyboardType="number-pad" value={experience} onChangeText={setExperience} />
          <View>
            <Text variant="caption" color="ink" style={styles.label}>
              Présentation
            </Text>
            <TextInput
            ref={areaRef}
            onFocus={() => bringIntoView(areaRef.current)}
              accessibilityLabel="Présentation"
              placeholder="Votre parcours, votre approche, les athlètes que vous accompagnez…"
              placeholderTextColor={colors.text3}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={1000}
              style={[styles.bio, { backgroundColor: colors.surface, borderColor: colors.borderStrong, color: colors.ink }]}
            />
          </View>
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tight: { paddingBottom: 12 },
  gap: { gap: 14 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  label: { marginBottom: 6 },
  bio: { minHeight: 120, padding: 12, borderWidth: 1, borderRadius: radius.md, fontFamily: fontFamily.regular, fontSize: 14, textAlignVertical: 'top' },
  footer: { gap: 8, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
});
