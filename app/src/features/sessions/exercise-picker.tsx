import { useState } from 'react';
import { FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackBar, ChoicePill, Field, Icon, Screen, StateView, Text } from '@/components/ui';
import { MUSCLE_LABELS } from '@/features/athlete/session-detail';
import type { ApiExercise } from '@/lib/api-types';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';

import { filterExercises, MUSCLE_FILTERS, useExerciseLibrary } from './exercises';

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'Barre',
  dumbbell: 'Haltères',
  kettlebell: 'Kettlebell',
  machine: 'Machine',
  cable: 'Poulie',
  bodyweight: 'Poids du corps',
  resistance_band: 'Élastique',
};

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onPick: (exercise: ApiExercise) => void;
};

/** Choix d'un exercice dans la bibliothèque, avec recherche et filtre par groupe musculaire. */
export function ExercisePicker({ visible, title, onClose, onPick }: Props) {
  const { colors } = useTheme();
  const { data, loading, error, refetch } = useExerciseLibrary();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const list = data ? filterExercises(data, search, muscle) : [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'} onRequestClose={onClose}>
      {/* La feuille iOS est déjà sous la barre d'état. */}
      <Screen scroll={false} edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}>
        <BackBar title={title} onBack={onClose} />
        <View style={styles.search}>
          <Field icon="search" placeholder="Rechercher un exercice" accessibilityLabel="Rechercher un exercice" autoCorrect={false} value={search} onChangeText={setSearch} />
        </View>
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pills}>
            <ChoicePill role="radio" label="Tous" selected={!muscle} onPress={() => setMuscle(null)} />
            {MUSCLE_FILTERS.map(([value, label]) => (
              <ChoicePill key={value} role="radio" label={label} selected={muscle === value} onPress={() => setMuscle(value)} />
            ))}
          </ScrollView>
        </View>

        {data ? (
          <FlatList
            data={list}
            keyExtractor={(exercise) => exercise._id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text variant="body2" style={styles.empty}>
                {data.length ? 'Aucun exercice ne correspond.' : 'La bibliothèque d’exercices est vide.'}
              </Text>
            }
            renderItem={({ item, index }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Choisir ${item.name}`}
                onPress={() => onPick(item)}
                style={({ pressed }) => [styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }, pressed && { backgroundColor: colors.subtle }]}>
                <View style={[styles.tile, { backgroundColor: colors.subtle }]}>
                  <Icon name="dumbbell" size={18} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text variant="h3">{item.name}</Text>
                  <Text variant="small">
                    {[item.primaryMuscle ? MUSCLE_LABELS[item.primaryMuscle] : null, item.equipment ? EQUIPMENT_LABELS[item.equipment] : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Icon name="plus" size={18} color={colors.text3} />
              </Pressable>
            )}
          />
        ) : (
          <StateView loading={loading} error={error} onRetry={refetch} />
        )}
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { paddingHorizontal: layout.gutter, paddingBottom: 10 },
  pills: { flexDirection: 'row', gap: 6, paddingHorizontal: layout.gutter, paddingBottom: 12 },
  list: { paddingHorizontal: layout.gutter, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderRadius: radius.sm },
  tile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 24, textAlign: 'center' },
});
