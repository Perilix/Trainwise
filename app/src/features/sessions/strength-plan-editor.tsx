import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Field, Icon, Text } from '@/components/ui';
import type { ApiExercise } from '@/lib/api-types';
import { formatDuration } from '@/lib/sessions';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

import { ExercisePicker } from './exercise-picker';
import { DecimalField, Stepper } from './run-blocks-editor';
import {
  exerciseFromLibrary,
  exerciseMeta,
  newCircuit,
  newPair,
  newSuperset,
  swapExercise,
  type EditableCircuit,
  type EditableExercise,
  type EditablePair,
  type EditableStrengthPlan,
  type EditableSuperset,
  type ExerciseSlot,
} from './strength-plan-model';

type Props = { plan: EditableStrengthPlan; onChange: (plan: EditableStrengthPlan) => void };

// Où l'exercice choisi dans la bibliothèque doit atterrir.
type PickerTarget =
  | { kind: 'single' }
  | { kind: 'circuit' }
  | { kind: 'superset'; pairKey: string; slot: 'a' | 'b' }
  | { kind: 'swap'; slot: ExerciseSlot; apply: (exercise: ApiExercise) => void };

/** Éditeur du plan de musculation : exercices simples, super-set et circuit. */
export function StrengthPlanEditor({ plan, onChange }: Props) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [target, setTarget] = useState<PickerTarget | null>(null);

  const toggle = (key: string) => setExpanded((current) => (current === key ? null : key));

  const setExercises = (exercises: EditableExercise[]) => onChange({ ...plan, exercises });
  const setSuperset = (superset: EditableSuperset | null) => onChange({ ...plan, superset });
  const setCircuit = (circuit: EditableCircuit | null) => onChange({ ...plan, circuit });

  const updatePair = (pairKey: string, change: (pair: EditablePair) => EditablePair) =>
    setSuperset(plan.superset ? { ...plan.superset, pairs: plan.superset.pairs.map((pair) => (pair.key === pairKey ? change(pair) : pair)) } : null);

  const pick = (exercise: ApiExercise) => {
    if (!target) return;
    if (target.kind === 'swap') target.apply(exercise);
    else if (target.kind === 'single') {
      const item = exerciseFromLibrary(exercise, 'single');
      setExercises([...plan.exercises, item]);
      setExpanded(item.key);
    } else if (target.kind === 'circuit') {
      const circuit = plan.circuit ?? newCircuit();
      const item = exerciseFromLibrary(exercise, 'circuit');
      setCircuit({ ...circuit, exercises: [...circuit.exercises, item] });
      setExpanded(item.key);
    } else {
      const item = exerciseFromLibrary(exercise, 'superset');
      updatePair(target.pairKey, (pair) => ({ ...pair, [target.slot]: item }));
      setExpanded(item.key);
    }
    setTarget(null);
  };

  const move = (list: EditableExercise[], index: number, delta: number, apply: (next: EditableExercise[]) => void) => {
    const to = index + delta;
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    [next[index], next[to]] = [next[to], next[index]];
    apply(next);
  };

  const renderExercise = (
    item: EditableExercise,
    slot: ExerciseSlot,
    options: { first: boolean; prefix?: string; onChange: (next: EditableExercise) => void; onRemove: () => void; onMove?: (delta: number) => void },
  ) => {
    const open = expanded === item.key;
    return (
      <View key={item.key} style={[styles.exercise, !options.first && { borderTopWidth: 1, borderTopColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${item.name}, ${open ? 'replier' : 'modifier'}`}
          onPress={() => toggle(item.key)}
          style={styles.header}>
          <View style={[styles.tile, { backgroundColor: colors.subtle }]}>
            {options.prefix ? <Text variant="h3">{options.prefix}</Text> : <Icon name="dumbbell" size={18} color={colors.primary} />}
          </View>
          <View style={styles.flex}>
            <Text variant="h3" numberOfLines={2}>
              {item.name}
            </Text>
            <Text variant="small" tabular numberOfLines={2}>
              {[item.muscle, exerciseMeta(item, slot)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Icon name={open ? 'chevronDown' : 'pen'} size={18} color={colors.text3} />
        </Pressable>

        {open ? (
          <View style={styles.fields}>
            {slot === 'single' ? <Stepper label="Séries" value={item.sets} min={1} max={12} suffix=" ×" onChange={(sets) => options.onChange({ ...item, sets })} /> : null}
            <Field label="Répétitions" placeholder="8-12, 40 s…" autoCapitalize="none" value={item.reps} onChangeText={(reps) => options.onChange({ ...item, reps })} />
            <DecimalField label="Charge" unit="kg" value={item.weight} onChange={(weight) => options.onChange({ ...item, weight })} />
            {slot === 'single' ? (
              <Field label="Récupération" placeholder="90 s, 1min30…" autoCapitalize="none" value={item.rest} onChangeText={(rest) => options.onChange({ ...item, rest })} />
            ) : null}
            <Field label="Consigne" placeholder="Ex. par jambe, tempo lent" value={item.notes} onChangeText={(notes) => options.onChange({ ...item, notes })} />
            <View style={styles.actions}>
              {options.onMove ? (
                <>
                  <Button label="Monter" variant="ghost" size="sm" onPress={() => options.onMove?.(-1)} />
                  <Button label="Descendre" variant="ghost" size="sm" onPress={() => options.onMove?.(1)} />
                </>
              ) : null}
              <Button
                label="Changer"
                variant="ghost"
                size="sm"
                icon="repeat"
                onPress={() => setTarget({ kind: 'swap', slot, apply: (exercise) => options.onChange(swapExercise(item, exercise)) })}
              />
              <View style={styles.flex} />
              <Button label="Retirer" variant="danger" size="sm" icon="x" onPress={options.onRemove} />
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <>
      <Card>
        <View style={styles.cardHeader}>
          <Text variant="sectionTitle">Exercices</Text>
          <Button label="Ajouter" size="sm" icon="plus" onPress={() => setTarget({ kind: 'single' })} />
        </View>
        {plan.exercises.length ? (
          plan.exercises.map((item, index) =>
            renderExercise(item, 'single', {
              first: index === 0,
              onChange: (next) => setExercises(plan.exercises.map((current) => (current.key === item.key ? next : current))),
              onRemove: () => setExercises(plan.exercises.filter((current) => current.key !== item.key)),
              onMove: (delta) => move(plan.exercises, index, delta, setExercises),
            }),
          )
        ) : (
          <Text variant="small" style={styles.empty}>
            Aucun exercice pour l’instant. Ajoutez-en depuis la bibliothèque.
          </Text>
        )}
      </Card>

      {plan.superset ? (
        <Card style={styles.block}>
          <View style={styles.cardHeader}>
            <Text variant="sectionTitle">Super-set</Text>
            <Button label="Retirer le bloc" variant="danger" size="sm" icon="x" onPress={() => setSuperset(null)} />
          </View>
          <View style={styles.fields}>
            <Field label="Nom du bloc" value={plan.superset.name} onChangeText={(name) => setSuperset({ ...plan.superset!, name })} />
            <Stepper label="Séries" value={plan.superset.sets} min={1} max={12} suffix=" ×" onChange={(sets) => setSuperset({ ...plan.superset!, sets })} />
            <Stepper label="Repos entre séries" value={plan.superset.restSec} min={0} max={300} step={15} format={(value) => (value ? formatDuration(value) : 'aucun')} onChange={(restSec) => setSuperset({ ...plan.superset!, restSec })} />
          </View>
          {plan.superset.pairs.map((pair, pairIndex) => (
            <View key={pair.key} style={[styles.pair, { borderTopColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text variant="overline">Paire {pairIndex + 1}</Text>
                <Button label="Retirer la paire" variant="ghost" size="sm" onPress={() => setSuperset({ ...plan.superset!, pairs: plan.superset!.pairs.filter((current) => current.key !== pair.key) })} />
              </View>
              {(['a', 'b'] as const).map((slot) => {
                const item = pair[slot];
                const prefix = `${pairIndex + 1}${slot.toUpperCase()}`;
                return item ? (
                  renderExercise(item, 'superset', {
                    first: slot === 'a',
                    prefix,
                    onChange: (next) => updatePair(pair.key, (current) => ({ ...current, [slot]: next })),
                    onRemove: () => updatePair(pair.key, (current) => ({ ...current, [slot]: null })),
                  })
                ) : (
                  <Button
                    key={slot}
                    label={`Choisir l’exercice ${prefix}`}
                    variant="secondary"
                    size="sm"
                    icon="plus"
                    onPress={() => setTarget({ kind: 'superset', pairKey: pair.key, slot })}
                    style={styles.slotButton}
                  />
                );
              })}
            </View>
          ))}
          <Button label="Ajouter une paire" variant="ghost" size="sm" icon="plus" onPress={() => setSuperset({ ...plan.superset!, pairs: [...plan.superset!.pairs, newPair()] })} style={styles.alignStart} />
        </Card>
      ) : null}

      {plan.circuit ? (
        <Card style={styles.block}>
          <View style={styles.cardHeader}>
            <Text variant="sectionTitle">Circuit</Text>
            <Button label="Retirer le bloc" variant="danger" size="sm" icon="x" onPress={() => setCircuit(null)} />
          </View>
          <View style={styles.fields}>
            <Field label="Nom du bloc" value={plan.circuit.name} onChangeText={(name) => setCircuit({ ...plan.circuit!, name })} />
            <Stepper label="Tours" value={plan.circuit.rounds} min={1} max={15} suffix=" ×" onChange={(rounds) => setCircuit({ ...plan.circuit!, rounds })} />
            <Stepper label="Repos entre tours" value={plan.circuit.restSec} min={0} max={300} step={15} format={(value) => (value ? formatDuration(value) : 'aucun')} onChange={(restSec) => setCircuit({ ...plan.circuit!, restSec })} />
          </View>
          <View style={styles.circuitList}>
            {plan.circuit.exercises.map((item, index) =>
              renderExercise(item, 'circuit', {
                first: index === 0,
                onChange: (next) => setCircuit({ ...plan.circuit!, exercises: plan.circuit!.exercises.map((current) => (current.key === item.key ? next : current)) }),
                onRemove: () => setCircuit({ ...plan.circuit!, exercises: plan.circuit!.exercises.filter((current) => current.key !== item.key) }),
                onMove: (delta) => move(plan.circuit!.exercises, index, delta, (exercises) => setCircuit({ ...plan.circuit!, exercises })),
              }),
            )}
          </View>
          <Button label="Ajouter un exercice" variant="ghost" size="sm" icon="plus" onPress={() => setTarget({ kind: 'circuit' })} style={styles.alignStart} />
        </Card>
      ) : null}

      <View style={styles.addRow}>
        {!plan.superset ? <Button label="Bloc super-set" variant="secondary" size="sm" icon="plus" onPress={() => setSuperset(newSuperset())} /> : null}
        {!plan.circuit ? <Button label="Bloc circuit" variant="secondary" size="sm" icon="plus" onPress={() => setCircuit(newCircuit())} /> : null}
      </View>

      <ExercisePicker
        visible={target !== null}
        title={target?.kind === 'swap' ? 'Changer l’exercice' : 'Choisir un exercice'}
        onClose={() => setTarget(null)}
        onPick={pick}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  block: { marginTop: 12 },
  fields: { gap: 12, marginTop: 12 },
  exercise: { paddingVertical: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  tile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  pair: { borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
  slotButton: { alignSelf: 'flex-start', marginTop: 8 },
  circuitList: { marginTop: 4 },
  alignStart: { alignSelf: 'flex-start', marginTop: 10 },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  empty: { marginTop: 10 },
});
