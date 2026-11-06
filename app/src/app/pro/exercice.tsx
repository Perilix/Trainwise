import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';

import { BackBar, Button, Card, ChoicePill, Field, FormError, Screen, Section, Segmented, StateView, Text } from '@/components/ui';
import { useBringIntoView } from '@/components/ui/keyboard-scroll';
import { useCoachActions } from '@/features/coach/queries';
import { EQUIPMENT_OPTIONS, MUSCLE_OPTIONS } from '@/features/sessions/exercise-library';
import { useExerciseLibrary } from '@/features/sessions/exercises';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

/** Création ou modification d'un exercice perso du coach. */
export default function ExerciseEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const areaRef = useRef<TextInputInstance>(null);
  const bringIntoView = useBringIntoView();
  const { data, loading, error, refetch } = useExerciseLibrary();
  const { createExercise, updateExercise, deleteExercise } = useCoachActions();
  const existing = id ? data?.find((exercise) => exercise._id === id) : undefined;

  const [name, setName] = useState<string | null>(null);
  const [primary, setPrimary] = useState<string | null>(null);
  const [groups, setGroups] = useState<string[] | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'private' | 'public' | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const title = id ? 'Modifier l’exercice' : 'Nouvel exercice';

  if (id && !existing) {
    return (
      <Screen>
        <BackBar title={title} />
        <StateView loading={loading} error={error ?? (loading ? null : 'Exercice introuvable.')} onRetry={refetch} />
      </Screen>
    );
  }

  const currentName = name ?? existing?.name ?? '';
  const currentPrimary = primary ?? existing?.primaryMuscle ?? '';
  const currentGroups = groups ?? (existing?.muscleGroups ?? []).filter((group) => group !== existing?.primaryMuscle);
  const currentEquipment = equipment ?? existing?.equipment ?? 'bodyweight';
  const currentVideo = videoUrl ?? existing?.videoUrl ?? '';
  const currentInstructions = instructions ?? existing?.instructions ?? '';
  const currentVisibility = visibility ?? (existing?.isPublic ? 'public' : 'private');

  const choosePrimary = (value: string) => {
    setPrimary(value);
    setGroups(currentGroups.filter((group) => group !== value));
  };

  const toggleGroup = (value: string) => setGroups(currentGroups.includes(value) ? currentGroups.filter((group) => group !== value) : [...currentGroups, value]);

  const save = async () => {
    if (!currentName.trim()) {
      setSaveError('Donnez un nom à l’exercice.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const body = {
      name: currentName.trim(),
      primaryMuscle: currentPrimary || undefined,
      // Le muscle principal compte aussi dans les groupes : c'est ce que filtre la recherche.
      muscleGroups: [...new Set([currentPrimary, ...currentGroups].filter(Boolean))],
      equipment: currentEquipment,
      videoUrl: currentVideo.trim(),
      instructions: currentInstructions.trim(),
      isPublic: currentVisibility === 'public',
    };
    try {
      if (id) await updateExercise(id, body);
      else await createExercise(body);
      router.back();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    try {
      await deleteExercise(id);
      router.back();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Suppression impossible.');
      setSaving(false);
    }
  };

  const footer = confirmDelete ? (
    <View style={styles.footer}>
      <Text variant="body2">Supprimer « {currentName} » ? Il disparaît aussi des séances types qui l’utilisent.</Text>
      <FormError message={saveError} />
      <View style={styles.actions}>
        <Button label="Garder" variant="secondary" disabled={saving} onPress={() => setConfirmDelete(false)} style={styles.flex} />
        <Button label={saving ? 'Suppression…' : 'Supprimer'} icon="x" disabled={saving} onPress={remove} style={styles.flex} />
      </View>
    </View>
  ) : (
    <View style={styles.footer}>
      <FormError message={saveError} />
      <Button label={saving ? 'Enregistrement…' : id ? 'Enregistrer' : 'Créer l’exercice'} icon="check" fullWidth disabled={saving} onPress={save} />
      {id ? <Button label="Supprimer l’exercice" variant="danger" size="sm" icon="x" fullWidth onPress={() => setConfirmDelete(true)} /> : null}
    </View>
  );

  return (
    <Screen footer={footer}>
      <BackBar title={title} />

      <Section>
        <Card style={styles.gap}>
          <Text variant="small">Utilisable tout de suite dans l’éditeur muscu.</Text>
          <Field label="Nom" placeholder="Ex. Step-up lesté" value={currentName} onChangeText={setName} />

          <View style={styles.group}>
            <Text variant="caption" color="ink">
              Muscle principal
            </Text>
            <View accessibilityRole="radiogroup" style={styles.pills}>
              {MUSCLE_OPTIONS.map((option) => (
                <ChoicePill key={option.value} role="radio" label={option.label} selected={currentPrimary === option.value} onPress={() => choosePrimary(option.value)} />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <Text variant="caption" color="ink">
              Muscles secondaires
            </Text>
            <View style={styles.pills}>
              {MUSCLE_OPTIONS.filter((option) => option.value !== currentPrimary).map((option) => (
                <ChoicePill key={option.value} label={option.label} selected={currentGroups.includes(option.value)} onPress={() => toggleGroup(option.value)} />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <Text variant="caption" color="ink">
              Équipement
            </Text>
            <View accessibilityRole="radiogroup" style={styles.pills}>
              {EQUIPMENT_OPTIONS.map((option) => (
                <ChoicePill key={option.value} role="radio" label={option.label} selected={currentEquipment === option.value} onPress={() => setEquipment(option.value)} />
              ))}
            </View>
          </View>

          <Field label="Vidéo de démonstration" placeholder="Lien YouTube ou Instagram" autoCapitalize="none" keyboardType="url" value={currentVideo} onChangeText={setVideoUrl} />

          <View>
            <Text variant="caption" color="ink" style={styles.label}>
              Consignes
            </Text>
            <TextInput
              ref={areaRef}
              onFocus={() => bringIntoView(areaRef.current)}
              accessibilityLabel="Consignes de l'exercice"
              placeholder="Placement, points d’attention…"
              placeholderTextColor={colors.text3}
              value={currentInstructions}
              onChangeText={setInstructions}
              multiline
              style={[styles.area, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.ink }]}
            />
          </View>

          <View style={styles.group}>
            <Text variant="caption" color="ink">
              Confidentialité
            </Text>
            <Segmented<'private' | 'public'>
              options={[
                { value: 'private', label: 'Privé' },
                { value: 'public', label: 'Public' },
              ]}
              value={currentVisibility}
              onChange={setVisibility}
            />
            <Text variant="small">
              {currentVisibility === 'public'
                ? 'Tous les coachs Trainwise peuvent le voir et l’utiliser dans leurs séances, photo et vidéo comprises.'
                : 'Vous seul pouvez l’utiliser dans vos séances. Vos athlètes le voient dans les séances que vous leur donnez.'}
            </Text>
          </View>
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 14 },
  group: { gap: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  label: { marginBottom: 8 },
  area: { minHeight: 90, padding: 12, borderWidth: 1, borderRadius: radius.md, fontFamily: fontFamily.regular, fontSize: 14, textAlignVertical: 'top' },
  footer: { gap: 8, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
  actions: { flexDirection: 'row', gap: 8 },
});
