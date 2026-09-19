import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, BackBar, Button, Card, Field, FormError, Icon, Screen, Section, StateView, Text } from '@/components/ui';
import { GROUP_COLORS, tintOf } from '@/features/coach/group-colors';
import { useCoachActions, useCoachGroups, useCoachHome } from '@/features/coach/queries';
import type { GroupColor } from '@/lib/api-types';
import { emitAppEvent } from '@/lib/app-events';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';

/**
 * Créer ou modifier un groupe d'athlètes.
 *
 * Sur mobile, le web ouvre une fenêtre — ici c'est un écran à part entière :
 * la liste des athlètes à cocher ne tiendrait pas dans une modale.
 */
export default function CoachGroupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const { data: groups, loading } = useCoachGroups();
  const { data: home } = useCoachHome();
  const { createGroup, updateGroup, deleteGroup } = useCoachActions();

  const existing = id ? groups?.find((group) => group.id === id) : undefined;
  const editing = Boolean(id);

  const [name, setName] = useState(() => existing?.name ?? '');
  const [color, setColor] = useState<GroupColor>(() => existing?.color ?? 'bleu');
  const [raceName, setRaceName] = useState(() => existing?.race?.name ?? '');
  const [picked, setPicked] = useState<string[]>(() => existing?.athletes.map((athlete) => athlete.id) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const athletes = home?.athletes ?? [];

  if (editing && loading && !existing) {
    return (
      <Screen>
        <BackBar title="Groupe" />
        <StateView loading error={null} />
      </Screen>
    );
  }

  const toggle = (athleteId: string) =>
    setPicked((list) => (list.includes(athleteId) ? list.filter((item) => item !== athleteId) : [...list, athleteId]));

  const save = async () => {
    if (!name.trim()) {
      setError('Le nom du groupe est requis.');
      return;
    }
    setSaving(true);
    setError(null);
    const body = { name: name.trim(), color, athletes: picked, raceName: raceName.trim() || undefined };
    try {
      if (editing && id) await updateGroup(id, body);
      else await createGroup(body);
      emitAppEvent('athletes:changed');
      router.back();
    } catch (reason) {
      // 402 : le plan du coach n'inclut pas (ou plus) de groupe supplémentaire.
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  };

  const remove = () => {
    if (!id) return;
    Alert.alert('Supprimer ce groupe ?', 'Les athlètes restent suivis : seul le groupe disparaît.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteGroup(id);
            emitAppEvent('athletes:changed');
            router.back();
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Suppression impossible.');
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <FormError message={error} />
          <Button
            label={saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le groupe'}
            icon="check"
            fullWidth
            disabled={saving || !name.trim()}
            onPress={save}
          />
        </View>
      }>
      <BackBar title={editing ? 'Modifier le groupe' : 'Nouveau groupe'} />

      <Section style={styles.tight}>
        <Card style={styles.gap}>
          <Field label="Nom du groupe" placeholder="Marathon de Lyon" value={name} onChangeText={setName} />

          <View>
            <Text variant="caption" color="ink" style={styles.label}>
              Couleur
            </Text>
            <View style={styles.swatches}>
              {GROUP_COLORS.map((choice) => {
                const tint = tintOf(choice.id);
                const on = color === choice.id;
                return (
                  <Pressable
                    key={choice.id}
                    accessibilityRole="button"
                    accessibilityLabel={choice.label}
                    accessibilityState={{ selected: on }}
                    onPress={() => setColor(choice.id)}
                    style={[styles.swatch, { backgroundColor: tint.soft, borderColor: on ? tint.ink : 'transparent' }]}>
                    {on ? <Icon name="check" size={16} color={tint.ink} strokeWidth={2.5} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Field label="Course visée — facultatif" placeholder="Marathon de Lyon" value={raceName} onChangeText={setRaceName} />
        </Card>
      </Section>

      <Section>
        <View style={styles.pickerHead}>
          <Text variant="sectionTitle" style={styles.flex}>
            Athlètes
          </Text>
          <Text variant="caption" tabular>
            {picked.length} sélectionné{picked.length > 1 ? 's' : ''} sur {athletes.length}
          </Text>
        </View>

        {athletes.length ? (
          <Card padding={0} style={styles.list}>
            {athletes.map((athlete, index) => {
              const on = picked.includes(athlete.id);
              return (
                <Pressable
                  key={athlete.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => toggle(athlete.id)}
                  style={[styles.pick, index > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : null]}>
                  <View
                    style={[
                      styles.box,
                      { borderColor: on ? colors.brand : colors.borderStrong, backgroundColor: on ? colors.brand : 'transparent' },
                    ]}>
                    {on ? <Icon name="check" size={13} color="#fff" strokeWidth={3} /> : null}
                  </View>
                  <Avatar initials={athlete.initials} size={32} />
                  <Text variant="body" style={styles.flex} numberOfLines={1}>
                    {athlete.name}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        ) : (
          <Card>
            <Text variant="body2">Aucun athlète à rassembler pour l’instant.</Text>
          </Card>
        )}
      </Section>

      {editing ? (
        <Section>
          <Button label="Supprimer le groupe" variant="danger" icon="x" fullWidth disabled={saving} onPress={remove} />
        </Section>
      ) : null}

      <Section>
        <Text variant="caption">Un athlète peut appartenir à plusieurs groupes. Un groupe est une étiquette, pas un dossier.</Text>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tight: { paddingBottom: 12 },
  flex: { flex: 1 },
  gap: { gap: 14 },
  label: { marginBottom: 6 },
  swatches: { flexDirection: 'row', gap: 10 },
  swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pickerHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  list: { overflow: 'hidden' },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  box: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  footer: { gap: 8, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
});
