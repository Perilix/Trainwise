import { useFocusEffect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BackBar, Button, Card, Chip, ChoicePill, Field, Icon, Screen, Section, StateView, Text } from '@/components/ui';
import { MUSCLE_LABELS } from '@/features/athlete/session-detail';
import { useSession } from '@/features/auth/session';
import { EQUIPMENT_LABELS, isMine } from '@/features/sessions/exercise-library';
import { filterExercises, useExerciseLibrary } from '@/features/sessions/exercises';
import type { ApiExercise } from '@/lib/api-types';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

type Origin = 'all' | 'catalog' | 'mine';

const ORIGINS: { value: Origin; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'catalog', label: 'Catalogue' },
  { value: 'mine', label: 'Mes exercices' },
];

/** Exercices de muscu : le catalogue Trainwise et ceux que le coach a créés. */
export default function ExercisesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useSession();
  const { data, loading, error, refetch } = useExerciseLibrary();
  const [origin, setOrigin] = useState<Origin>('all');
  const [search, setSearch] = useState('');

  // Un exercice créé ou modifié sur l'écran suivant doit apparaître au retour.
  useFocusEffect(refetch);

  const mine = (exercise: ApiExercise) => isMine(exercise, user?.id);
  const list = (data ? filterExercises(data, search, null) : [])
    .filter((exercise) => (origin === 'mine' ? mine(exercise) : origin === 'catalog' ? !mine(exercise) : true))
    .sort((a, b) => Number(mine(b)) - Number(mine(a)));
  const mineCount = (data ?? []).filter(mine).length;

  return (
    <Screen>
      <BackBar title="Exercices" />

      <Section style={styles.tight}>
        <View style={styles.actions}>
          <Button label="Nouvel exercice" icon="plus" size="sm" onPress={() => router.push('/pro/exercice')} style={styles.flex} />
          <Button label="Importer une liste" variant="secondary" size="sm" onPress={() => router.push('/pro/exercices-import')} style={styles.flex} />
        </View>
      </Section>

      <Section style={styles.filters}>
        <View accessibilityRole="radiogroup" style={styles.pills}>
          {ORIGINS.map((option) => (
            <ChoicePill
              key={option.value}
              role="radio"
              label={option.value === 'mine' ? `${option.label} (${mineCount})` : option.label}
              selected={origin === option.value}
              onPress={() => setOrigin(option.value)}
            />
          ))}
        </View>
        <Field icon="search" placeholder="Rechercher un exercice" accessibilityLabel="Rechercher un exercice" autoCorrect={false} value={search} onChangeText={setSearch} />
      </Section>

      {data ? (
        <Section>
          {list.length ? (
            <Card padding={0} style={styles.list}>
              {list.map((exercise, index) => {
                const own = mine(exercise);
                const meta = [exercise.primaryMuscle ? MUSCLE_LABELS[exercise.primaryMuscle] : null, exercise.equipment ? EQUIPMENT_LABELS[exercise.equipment] : null].filter(Boolean).join(' · ');
                const content = (
                  <>
                    <View style={[styles.tile, { backgroundColor: own ? colors.accentSoft : colors.subtle }]}>
                      <Icon name="dumbbell" size={18} color={own ? colors.accentInk : colors.primary} />
                    </View>
                    <View style={styles.flex}>
                      <Text variant="h3">{exercise.name}</Text>
                      {meta ? <Text variant="small">{meta}</Text> : null}
                    </View>
                    {own ? (
                      <>
                        <Chip label={exercise.isPublic ? 'Public' : 'Perso'} tone="accent" />
                        <Icon name="pen" size={18} color={colors.text3} />
                      </>
                    ) : exercise.createdBy ? (
                      <Chip label="Partagé" />
                    ) : null}
                  </>
                );
                const style = [styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }];
                return own ? (
                  <Pressable
                    key={exercise._id}
                    accessibilityRole="button"
                    accessibilityLabel={`Modifier ${exercise.name}`}
                    onPress={() => router.push({ pathname: '/pro/exercice', params: { id: exercise._id } })}
                    style={style}>
                    {content}
                  </Pressable>
                ) : (
                  <View key={exercise._id} style={style}>
                    {content}
                  </View>
                );
              })}
            </Card>
          ) : (
            <Card>
              <Text variant="body2">
                {origin === 'mine' && !mineCount
                  ? 'Vous n’avez pas encore d’exercice perso. Créez-les un par un ou collez votre liste avec « Importer une liste ».'
                  : 'Aucun exercice ne correspond.'}
              </Text>
            </Card>
          )}
        </Section>
      ) : (
        <StateView loading={loading} error={error} onRetry={refetch} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tight: { paddingBottom: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  filters: { gap: 10, paddingBottom: 16 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  list: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  tile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
