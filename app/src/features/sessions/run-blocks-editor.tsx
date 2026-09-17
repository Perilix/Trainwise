import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button, Card, ChoicePill, Field, Icon, Segmented, Text, WorkoutProfile } from '@/components/ui';
import { blocksToSegments } from '@/features/athlete/run-blocks';
import { formatDecimal, parseDecimal } from '@/lib/format';
import { formatDuration, intensityColor, totals } from '@/lib/sessions';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

import {
  insertMain,
  isGroup,
  newChild,
  newCooldown,
  newRepeat,
  newStep,
  newWarmup,
  paceMode,
  recoveryLabel,
  ROLE_LABELS,
  stepPercent,
  stepTargetLabel,
  stepValueLabel,
  toPayload,
  withFixedPace,
  withPercent,
  withZone,
  ZONE_CHOICES,
  type EditableBlock,
  type EditableStep,
} from './run-blocks-model';

type Props = {
  blocks: EditableBlock[];
  onChange: (blocks: EditableBlock[]) => void;
  /** VMA de l'athlète : allures des zones et profil d'intensité. */
  vma?: number;
  /** Déroulé réalisé : les nouvelles étapes partent sur une allure tenue, pas une zone. */
  realized?: boolean;
};

/** Éditeur de séance de course par blocs, avec profil d'intensité et totaux en direct. */
export function RunBlocksEditor({ blocks, onChange, vma, realized }: Props) {
  const { width } = useWindowDimensions();
  const { colors, ramp } = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);

  const payload = toPayload(blocks, vma);
  const segments = blocksToSegments(payload, vma);
  const total = totals(segments);
  const hasWarmup = blocks.some((block) => block.role === 'warmup');
  const hasCooldown = blocks.some((block) => block.role === 'cooldown');

  const toggle = (key: string) => setExpanded((current) => (current === key ? null : key));
  const update = (key: string, change: (block: EditableBlock) => EditableBlock) => onChange(blocks.map((block) => (block.key === key ? change(block) : block)));
  const updateChild = (blockKey: string, childKey: string, change: (step: EditableStep) => EditableStep) =>
    update(blockKey, (block) => ({ ...block, children: (block.children ?? []).map((child) => (child.key === childKey ? change(child) : child)) }));

  const remove = (key: string) => {
    onChange(blocks.filter((block) => block.key !== key));
    setExpanded(null);
  };

  const removeChild = (blockKey: string, childKey: string) => {
    const group = blocks.find((block) => block.key === blockKey);
    if (group && (group.children ?? []).length <= 1) return remove(blockKey);
    update(blockKey, (block) => ({ ...block, children: (block.children ?? []).filter((child) => child.key !== childKey) }));
  };

  // Seules les étapes principales se déplacent : l'échauffement reste en tête, le retour au calme en fin.
  const move = (key: string, delta: number) => {
    const index = blocks.findIndex((block) => block.key === key);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= blocks.length || blocks[target].role !== 'main') return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const add = (block: EditableBlock) => {
    onChange(block.role === 'warmup' ? [block, ...blocks] : block.role === 'cooldown' ? [...blocks, block] : insertMain(blocks, block));
    setExpanded(isGroup(block) ? (block.children?.[0]?.key ?? block.key) : block.key);
  };

  const peakPercent = (block: EditableBlock) => {
    const steps = isGroup(block) ? (block.children ?? []) : [block];
    return Math.max(...steps.map((step) => stepPercent(step) ?? (block.role === 'main' ? 85 : 62)));
  };

  const renderStepFields = (step: EditableStep, onStep: (next: EditableStep) => void, options: { meters: boolean; repeatable: boolean; recovery: boolean }) => (
    <View style={styles.fields}>
      <Segmented<'distance' | 'duration'>
        options={[
          { value: 'distance', label: 'Distance' },
          { value: 'duration', label: 'Durée' },
        ]}
        value={step.mode}
        onChange={(mode) =>
          onStep({ ...step, mode, distance: mode === 'distance' ? (step.distance ?? (options.meters ? 0.4 : 1)) : null, duration: mode === 'duration' ? (step.duration ?? 10) : null })
        }
      />
      {step.mode === 'distance' ? (
        options.meters ? (
          <DecimalField key={`${step.key}-m`} label="Distance" unit="m" integer value={step.distance ? step.distance * 1000 : null} onChange={(meters) => onStep({ ...step, distance: meters ? meters / 1000 : null })} />
        ) : (
          <DecimalField key={`${step.key}-km`} label="Distance" unit="km" value={step.distance} onChange={(km) => onStep({ ...step, distance: km })} />
        )
      ) : (
        <DecimalField key={`${step.key}-min`} label="Durée" unit="min" value={step.duration} onChange={(minutes) => onStep({ ...step, duration: minutes })} />
      )}

      <View style={styles.fieldGroup}>
        <Text variant="caption" color="ink">
          Allure
        </Text>
        <Segmented<'zone' | 'fixed'>
          options={[
            { value: 'zone', label: 'Zone VMA' },
            { value: 'fixed', label: 'Allure fixe' },
          ]}
          value={paceMode(step)}
          onChange={(mode) => onStep(mode === 'zone' ? withZone(step, step.paceSource?.zone ?? 'endurance', vma) : withFixedPace(step, step.pace ?? ''))}
        />
      </View>
      {paceMode(step) === 'zone' ? (
        <>
          <View accessibilityRole="radiogroup" style={styles.pills}>
            {ZONE_CHOICES.map(([zone, label]) => (
              <ChoicePill key={zone} role="radio" label={label} selected={step.paceSource?.zone === zone} onPress={() => onStep(withZone(step, zone, vma))} />
            ))}
          </View>
          <Stepper label="% VMA" value={stepPercent(step) ?? 70} min={40} max={130} suffix=" %" onChange={(percent) => onStep(withPercent(step, percent, vma))} />
          <Text variant="small" color={vma ? 'accentInk' : 'warningInk'}>
            {vma ? `VMA ${formatDecimal(vma)} km/h : ${stepTargetLabel(step, vma)}` : 'VMA de l’athlète non renseignée : l’allure sera affichée une fois la VMA saisie.'}
          </Text>
        </>
      ) : (
        <Field
          label="Allure fixe"
          placeholder="4:30"
          keyboardType="numbers-and-punctuation"
          value={step.pace ?? ''}
          onChangeText={(text) => onStep(withFixedPace(step, text))}
          trailing={
            <Text variant="small" color="text3">
              /km
            </Text>
          }
        />
      )}

      {step.role === 'main' ? <Field label="Consigne" placeholder="Ex. relâché, foulée légère" value={step.description ?? ''} onChangeText={(description) => onStep({ ...step, description })} /> : null}

      {options.repeatable ? <Stepper label="Répétitions" value={Math.max(1, step.repetitions ?? 1)} min={1} max={30} suffix=" ×" onChange={(repetitions) => onStep({ ...step, repetitions })} /> : null}

      {options.recovery ? (
        step.recoveryMode ? (
          <View style={[styles.recovery, { borderTopColor: colors.border }]}>
            <View style={styles.rowBetween}>
              <Text variant="h3">Récupération</Text>
              <Button
                label="Retirer"
                variant="danger"
                size="sm"
                onPress={() => onStep({ ...step, recoveryMode: null, recoveryDistance: null, recoveryDuration: null, recoveryDescription: '' })}
              />
            </View>
            <Segmented<'duration' | 'distance'>
              options={[
                { value: 'duration', label: 'Durée' },
                { value: 'distance', label: 'Distance' },
              ]}
              value={step.recoveryMode}
              onChange={(mode) =>
                onStep({
                  ...step,
                  recoveryMode: mode,
                  recoveryDuration: mode === 'duration' ? (step.recoveryDuration ?? '1min30') : null,
                  recoveryDistance: mode === 'distance' ? (step.recoveryDistance ?? 0.2) : null,
                })
              }
            />
            {step.recoveryMode === 'duration' ? (
              <Field label="Durée" placeholder="1min30" autoCapitalize="none" value={step.recoveryDuration ?? ''} onChangeText={(recoveryDuration) => onStep({ ...step, recoveryDuration })} />
            ) : (
              <DecimalField
                key={`${step.key}-rec-m`}
                label="Distance"
                unit="m"
                integer
                value={step.recoveryDistance ? step.recoveryDistance * 1000 : null}
                onChange={(meters) => onStep({ ...step, recoveryDistance: meters ? meters / 1000 : null })}
              />
            )}
            <Field label="Consigne de récupération" placeholder="trot, marche…" value={step.recoveryDescription ?? ''} onChangeText={(recoveryDescription) => onStep({ ...step, recoveryDescription })} />
          </View>
        ) : (
          <Button
            label="Ajouter une récupération"
            variant="ghost"
            size="sm"
            icon="plus"
            onPress={() => onStep({ ...step, recoveryMode: 'duration', recoveryDuration: '1min30' })}
            style={styles.alignStart}
          />
        )
      ) : null}
    </View>
  );

  const renderSummary = (step: EditableStep, repetitions?: number) => (
    <>
      <Text variant="h3" numberOfLines={2}>
        {repetitions && repetitions > 1 ? `${repetitions} × ` : ''}
        {stepValueLabel(step)}
      </Text>
      <Text variant="small" numberOfLines={2}>
        {stepTargetLabel(step, vma)}
      </Text>
      {recoveryLabel(step) ? <Text variant="small">{recoveryLabel(step)}</Text> : null}
    </>
  );

  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text variant="sectionTitle">Blocs de course</Text>
        {total.sec ? (
          <Text variant="small" tabular>
            ≈ {formatDecimal(total.dist / 1000)} km · ≈ {formatDuration(total.sec)}
          </Text>
        ) : null}
      </View>
      {segments.length ? (
        <View style={[styles.profile, { backgroundColor: colors.bg }]}>
          <WorkoutProfile segments={segments} width={width - layout.gutter * 2 - 32 - 20} height={56} />
        </View>
      ) : null}

      <View style={styles.list}>
        {blocks.map((block) => {
          const group = isGroup(block);
          const open = expanded === block.key;
          const isMain = block.role === 'main';
          const title = group ? 'Bloc à répéter' : ROLE_LABELS[block.role];

          return (
            <View key={block.key} style={[styles.block, { backgroundColor: colors.surface, borderColor: group ? colors.accent : colors.border }, group && styles.groupBlock]}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${title}, ${open ? 'replier' : 'modifier'}`} onPress={() => toggle(block.key)} style={styles.header}>
                <View style={[styles.bar, { backgroundColor: intensityColor(peakPercent(block), ramp) }]} />
                <View style={styles.flex}>
                  <Text variant="overline">{title}</Text>
                  {group ? (
                    <Text variant="h3" numberOfLines={2}>
                      {`${Math.max(1, block.repetitions ?? 1)} × ${(block.children ?? []).map((child) => stepValueLabel(child)).join(' + ')}`}
                    </Text>
                  ) : (
                    renderSummary(block, block.repetitions)
                  )}
                </View>
                <Icon name={open ? 'chevronDown' : 'pen'} size={18} color={colors.text3} />
              </Pressable>

              {open ? (
                <View style={[styles.body, { borderTopColor: colors.border }]}>
                  {group ? (
                    <View style={styles.fields}>
                      <Stepper label="Répéter la série" value={Math.max(1, block.repetitions ?? 1)} min={1} max={30} suffix=" ×" onChange={(repetitions) => update(block.key, (current) => ({ ...current, repetitions }))} />
                    </View>
                  ) : (
                    renderStepFields(block, (next) => update(block.key, (current) => ({ ...next, children: current.children })), {
                      // Une étape répétée (10 × 400 m) se pense en mètres.
                      meters: isMain && Math.max(1, block.repetitions ?? 1) > 1,
                      repeatable: isMain,
                      recovery: isMain,
                    })
                  )}

                  <View style={styles.blockActions}>
                    {isMain ? (
                      <>
                        <Button label="Monter" variant="ghost" size="sm" onPress={() => move(block.key, -1)} />
                        <Button label="Descendre" variant="ghost" size="sm" onPress={() => move(block.key, 1)} />
                      </>
                    ) : null}
                    <View style={styles.flex} />
                    <Button label={group ? 'Supprimer le bloc' : 'Supprimer'} variant="danger" size="sm" icon="x" onPress={() => remove(block.key)} />
                  </View>
                </View>
              ) : null}

              {group ? (
                <View style={[styles.children, { backgroundColor: colors.bg }]}>
                  {(block.children ?? []).map((child, childIndex) => {
                    const childOpen = expanded === child.key;
                    return (
                      <View key={child.key} style={[styles.child, childIndex > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded: childOpen }}
                          accessibilityLabel={`Étape ${childIndex + 1} du bloc, ${childOpen ? 'replier' : 'modifier'}`}
                          onPress={() => toggle(child.key)}
                          style={styles.header}>
                          <View style={[styles.bar, { backgroundColor: intensityColor(stepPercent(child) ?? 85, ramp) }]} />
                          <View style={styles.flex}>{renderSummary(child)}</View>
                          <Icon name={childOpen ? 'chevronDown' : 'pen'} size={18} color={colors.text3} />
                        </Pressable>
                        {childOpen ? (
                          <View style={styles.childBody}>
                            {renderStepFields(child, (next) => updateChild(block.key, child.key, () => next), { meters: true, repeatable: false, recovery: true })}
                            <Button label="Retirer l’étape" variant="danger" size="sm" icon="x" onPress={() => removeChild(block.key, child.key)} style={styles.alignEnd} />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                  <Button
                    label="Étape dans le bloc"
                    variant="ghost"
                    size="sm"
                    icon="plus"
                    onPress={() => {
                      const child = newChild(realized);
                      update(block.key, (current) => ({ ...current, children: [...(current.children ?? []), withZone(child, child.paceSource?.zone ?? 'vma', vma)] }));
                      setExpanded(child.key);
                    }}
                    style={styles.alignStart}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.addRow}>
        <Button label="Étape" variant="secondary" size="sm" icon="plus" onPress={() => add(newStep(realized))} />
        <Button label="Bloc à répéter" variant="secondary" size="sm" icon="repeat" onPress={() => add(newRepeat(realized))} />
        {!hasWarmup ? <Button label="Échauffement" variant="secondary" size="sm" icon="plus" onPress={() => add(newWarmup(realized))} /> : null}
        {!hasCooldown ? <Button label="Retour au calme" variant="secondary" size="sm" icon="plus" onPress={() => add(newCooldown(realized))} /> : null}
      </View>
    </Card>
  );
}

type DecimalFieldProps = { label: string; value: number | null | undefined; onChange: (value: number | null) => void; unit?: string; integer?: boolean };

// Saisie numérique gardant le texte tapé (« 1, » en cours de frappe) tout en remontant la valeur.
export function DecimalField({ label, value, onChange, unit, integer }: DecimalFieldProps) {
  const [text, setText] = useState(() => (value ? String(Number(value.toFixed(2))).replace('.', ',') : ''));
  return (
    <Field
      label={label}
      value={text}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      onChangeText={(input) => {
        const clean = input.replace(integer ? /[^0-9]/g : /[^0-9.,]/g, '');
        setText(clean);
        const parsed = parseDecimal(clean);
        onChange(parsed && parsed > 0 ? parsed : null);
      }}
      trailing={
        unit ? (
          <Text variant="small" color="text3">
            {unit}
          </Text>
        ) : undefined
      }
    />
  );
}

type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  step?: number;
  /** Affichage de la valeur (ex. « 1′30″ ») ; remplace le suffixe. */
  format?: (value: number) => string;
  onChange: (value: number) => void;
};

export function Stepper({ label, value, min, max, suffix = '', step = 1, format, onChange }: StepperProps) {
  const { colors } = useTheme();
  const display = format ? format(value) : `${value}${suffix}`;
  return (
    <View style={styles.stepperRow}>
      <Text variant="caption" color="ink">
        {label}
      </Text>
      {/* Pas de regroupement accessible : les boutons − et + doivent rester atteignables au lecteur d'écran. */}
      <View style={[styles.stepper, { borderColor: colors.borderStrong }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Diminuer ${label}`} disabled={value <= min} onPress={() => onChange(Math.max(min, value - step))} style={styles.stepperButton}>
          <Text style={[styles.stepperSign, { color: value <= min ? colors.text3 : colors.ink }]}>−</Text>
        </Pressable>
        <Text variant="h3" tabular accessibilityLabel={`${label} : ${display}`} style={styles.stepperValue}>
          {display}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Augmenter ${label}`} disabled={value >= max} onPress={() => onChange(Math.min(max, value + step))} style={styles.stepperButton}>
          <Icon name="plus" size={16} color={value >= max ? colors.text3 : colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  profile: { marginTop: 12, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 6, borderRadius: radius.md },
  list: { gap: 10, marginTop: 14 },
  block: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  groupBlock: { borderWidth: 1.5 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 10, paddingRight: 12 },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  body: { borderTopWidth: 1, padding: 12, gap: 12 },
  fields: { gap: 12 },
  fieldGroup: { gap: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recovery: { gap: 12, paddingTop: 12, borderTopWidth: 1 },
  blockActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  children: { marginHorizontal: 10, marginBottom: 10, borderRadius: radius.md, paddingHorizontal: 4, paddingBottom: 4 },
  child: {},
  childBody: { paddingHorizontal: 8, paddingBottom: 12, gap: 12 },
  alignStart: { alignSelf: 'flex-start' },
  alignEnd: { alignSelf: 'flex-end' },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', height: 40, borderWidth: 1, borderRadius: radius.sm, overflow: 'hidden' },
  stepperButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepperSign: { fontFamily: fontFamily.semibold, fontSize: 20, lineHeight: 22 },
  stepperValue: { minWidth: 64, textAlign: 'center' },
});
