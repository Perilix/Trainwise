import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button, Card, ChoicePill, Field, Icon, Segmented, Text, WorkoutProfile } from '@/components/ui';
import {
  EQUIPMENT_LABELS,
  STROKE_LABELS,
  formatMeters,
  formatSwimPace,
  intensityLevel,
  parseSwimPace,
  recoveryText,
  relativeIntensity,
  resolvedTarget,
  sportSegments,
  targetLabel,
  zoneOf,
  zonesFor,
  type EnduranceSport,
} from '@/features/athlete/sport-blocks';
import type { ApiSportReference, ApiSportStep } from '@/lib/api-types';
import { formatDuration, totals } from '@/lib/sessions';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';

import { DecimalField, Stepper } from './run-blocks-editor';
import { StepActions } from './step-actions';
import {
  newSportChild,
  newSportCooldown,
  newSportRepeat,
  newSportStep,
  newSportWarmup,
  restInput,
  toSportPayload,
  type EditableSportBlock,
  type EditableSportStep,
} from './sport-blocks-model';

type Props = {
  sport: EnduranceSport;
  blocks: EditableSportBlock[];
  onChange: (blocks: EditableSportBlock[]) => void;
  /** FTP ou CSS d'aperçu : watts et allures affichés pendant la saisie. */
  reference: ApiSportReference;
};

const ROLE_LABELS = { warmup: 'Échauffement', main: 'Corps de séance', cooldown: 'Retour au calme' } as const;

const BIKE_MODES: { value: 'ftp' | 'watts' | 'hr' | 'rpe'; label: string; unit: string }[] = [
  { value: 'ftp', label: '% FTP', unit: '% FTP' },
  { value: 'watts', label: 'Watts', unit: 'W' },
  { value: 'hr', label: '% FC max', unit: '% FC max' },
  { value: 'rpe', label: 'Ressenti', unit: '/ 10' },
];

const POSITIONS: { value: '' | 'assis' | 'danseuse'; label: string }[] = [
  { value: '', label: 'Libre' },
  { value: 'assis', label: 'Assis' },
  { value: 'danseuse', label: 'En danseuse' },
];

const isGroup = (block: EditableSportBlock) => Boolean(block.children?.length);

/**
 * Éditeur de séance de vélo ou de natation par blocs : une étape ouverte à la fois,
 * les autres se lisent en une ligne. Même grammaire que l'éditeur de course.
 */
export function SportBlocksEditor({ sport, blocks, onChange, reference }: Props) {
  const { width } = useWindowDimensions();
  const { colors, ramp } = useTheme();
  const [expanded, setExpanded] = useState<string | null>(() => blocks.find(isGroup)?.children?.[0]?.key ?? null);
  const bike = sport === 'bike';

  const payload = toSportPayload(blocks);
  const segments = sportSegments(payload, sport, reference);
  const total = totals(segments);
  const hasWarmup = blocks.some((block) => block.role === 'warmup');
  const hasCooldown = blocks.some((block) => block.role === 'cooldown');

  const toggle = (key: string) => setExpanded((current) => (current === key ? null : key));
  const update = (key: string, change: (block: EditableSportBlock) => EditableSportBlock) => onChange(blocks.map((block) => (block.key === key ? change(block) : block)));
  const updateChild = (blockKey: string, childKey: string, change: (step: EditableSportStep) => EditableSportStep) =>
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

  // Tout bloc se déplace, retour au calme compris : c'est le coach qui décide de l'ordre.
  const move = (key: string, delta: number) => {
    const index = blocks.findIndex((block) => block.key === key);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const moveChild = (blockKey: string, childKey: string, delta: number) =>
    update(blockKey, (block) => {
      const children = [...(block.children ?? [])];
      const index = children.findIndex((child) => child.key === childKey);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= children.length) return block;
      [children[index], children[target]] = [children[target], children[index]];
      return { ...block, children };
    });

  const add = (block: EditableSportBlock) => {
    if (block.role === 'warmup') onChange([block, ...blocks]);
    else if (block.role === 'cooldown') onChange([...blocks, block]);
    else {
      const cooldown = blocks.findIndex((item) => item.role === 'cooldown');
      onChange(cooldown === -1 ? [...blocks, block] : [...blocks.slice(0, cooldown), block, ...blocks.slice(cooldown)]);
    }
    setExpanded(isGroup(block) ? (block.children?.[0]?.key ?? block.key) : block.key);
  };

  const shade = (step: ApiSportStep) => ramp[intensityLevel(relativeIntensity(step, sport, reference), sport, step.role) - 1];

  const volume = (step: ApiSportStep) => {
    if (bike) return step.duration ? formatDuration(step.duration) : '—';
    const stroke = step.stroke ? STROKE_LABELS[step.stroke]?.toLowerCase() : '';
    return [step.distance ? formatMeters(step.distance) : '—', stroke].filter(Boolean).join(' ');
  };

  const summary = (step: ApiSportStep, inGroup: boolean) => {
    const zone = step.intensityMode === 'ftp' || step.intensityMode === 'css' ? zoneOf(relativeIntensity(step, sport, reference), sport)?.label : null;
    return [
      zone,
      resolvedTarget(step, reference) ?? targetLabel(step),
      step.cadence?.trim() ? `${step.cadence.trim()} tr/min` : null,
      !bike && step.equipment?.length ? step.equipment.map((item) => EQUIPMENT_LABELS[item] ?? item).join(', ') : null,
      inGroup ? recoveryText(step) : null,
    ]
      .filter(Boolean)
      .join(' · ');
  };

  const renderStepFields = (step: EditableSportStep, onStep: (next: EditableSportStep) => void, options: { recovery: boolean }) => {
    const zones = zonesFor(sport);
    const zoneKey = zones.find((zone) => zone.low === step.intensityLow && zone.high === step.intensityHigh)?.key;
    const mode = BIKE_MODES.find((item) => item.value === step.intensityMode);
    const resolved = resolvedTarget(step, reference);

    const bounds = (labelLow: string, labelHigh: string, unit: string) => (
      <View style={styles.pair}>
        <View style={styles.flex}>
          <DecimalField key={`${step.key}-low-${step.intensityMode}`} label={labelLow} unit={unit} value={step.intensityLow} onChange={(intensityLow) => onStep({ ...step, intensityLow })} />
        </View>
        <View style={styles.flex}>
          <DecimalField key={`${step.key}-high-${step.intensityMode}`} label={labelHigh} unit={unit} value={step.intensityHigh} onChange={(intensityHigh) => onStep({ ...step, intensityHigh })} />
        </View>
      </View>
    );

    const setMode = (next: NonNullable<ApiSportStep['intensityMode']>) => {
      const defaults: Record<NonNullable<ApiSportStep['intensityMode']>, [number, number]> = {
        ftp: [88, 94],
        watts: [Math.round((reference.ftp ?? 220) * 0.9), Math.round((reference.ftp ?? 220) * 0.95)],
        hr: [80, 85],
        rpe: [6, 7],
        css: [97, 103],
        pace: [Math.round((reference.css ?? 110) * 0.97), Math.round((reference.css ?? 110) * 1.03)],
      };
      onStep({ ...step, intensityMode: next, intensityLow: defaults[next][0], intensityHigh: defaults[next][1] });
    };

    return (
      <View style={styles.fields}>
        {bike ? (
          <>
            <DecimalField
              key={`${step.key}-min`}
              label="Durée"
              unit="min"
              value={step.duration ? step.duration / 60 : null}
              onChange={(minutes) => onStep({ ...step, duration: minutes ? Math.round(minutes * 60) : null })}
            />
            <View style={styles.fieldGroup}>
              <Text variant="caption" color="ink">
                Intensité
              </Text>
              <Segmented<'stable' | 'ramp'>
                options={[
                  { value: 'stable', label: 'Stable' },
                  { value: 'ramp', label: 'Progressive' },
                ]}
                value={step.ramp ? 'ramp' : 'stable'}
                onChange={(value) => {
                  if (value === 'stable') return onStep({ ...step, ramp: false });
                  const low = step.intensityLow ?? 50;
                  onStep({ ...step, ramp: true, intensityLow: low, intensityHigh: step.intensityHigh && step.intensityHigh > low ? step.intensityHigh : low + 20 });
                }}
              />
              {step.ramp ? <Text variant="small">L’intensité monte régulièrement de la première valeur à la seconde, idéal pour un échauffement.</Text> : null}
            </View>
            <View style={styles.fieldGroup}>
              <Text variant="caption" color="ink">
                Cible
              </Text>
              <View accessibilityRole="radiogroup" style={styles.pills}>
                {BIKE_MODES.map((item) => (
                  <ChoicePill key={item.value} role="radio" label={item.label} selected={step.intensityMode === item.value} onPress={() => setMode(item.value)} />
                ))}
              </View>
            </View>
            {step.intensityMode === 'ftp' && !step.ramp ? (
              <View style={styles.fieldGroup}>
                <Text variant="caption" color="ink">
                  Zone
                </Text>
                <View accessibilityRole="radiogroup" style={styles.pills}>
                  {zones.map((zone) => (
                    <ChoicePill key={zone.key} role="radio" label={zone.label} selected={zone.key === zoneKey} onPress={() => onStep({ ...step, intensityLow: zone.low, intensityHigh: zone.high })} />
                  ))}
                </View>
              </View>
            ) : null}
            {bounds(step.ramp ? 'De' : 'Min', step.ramp ? 'À' : 'Max', mode?.unit ?? '% FTP')}
            <Field label="Cadence" placeholder="Libre" keyboardType="numbers-and-punctuation" value={step.cadence ?? ''} onChangeText={(cadence) => onStep({ ...step, cadence })} trailing={<Text variant="small" color="text3">tr/min</Text>} />
            <View style={styles.fieldGroup}>
              <Text variant="caption" color="ink">
                Position
              </Text>
              <View accessibilityRole="radiogroup" style={styles.pills}>
                {POSITIONS.map((item) => (
                  <ChoicePill key={item.value || 'libre'} role="radio" label={item.label} selected={(step.position ?? '') === item.value} onPress={() => onStep({ ...step, position: item.value })} />
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            <DecimalField key={`${step.key}-m`} label="Distance" unit="m" integer value={step.distance} onChange={(distance) => onStep({ ...step, distance: distance ? Math.round(distance) : null })} />
            <View style={styles.fieldGroup}>
              <Text variant="caption" color="ink">
                Nage
              </Text>
              <View accessibilityRole="radiogroup" style={styles.pills}>
                {Object.entries(STROKE_LABELS).map(([value, label]) => (
                  <ChoicePill key={value} role="radio" label={label} selected={(step.stroke ?? 'crawl') === value} onPress={() => onStep({ ...step, stroke: value })} />
                ))}
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text variant="caption" color="ink">
                Allure
              </Text>
              <Segmented<'css' | 'pace'>
                options={[
                  { value: 'css', label: 'Zone CSS' },
                  { value: 'pace', label: 'Allure fixe' },
                ]}
                value={step.intensityMode === 'pace' ? 'pace' : 'css'}
                onChange={setMode}
              />
            </View>
            {step.intensityMode === 'pace' ? (
              <View style={styles.pair}>
                <View style={styles.flex}>
                  <PaceField key={`${step.key}-fast`} label="Plus rapide" seconds={step.intensityLow} onChange={(intensityLow) => onStep({ ...step, intensityLow })} />
                </View>
                <View style={styles.flex}>
                  <PaceField key={`${step.key}-slow`} label="Plus lente" seconds={step.intensityHigh} onChange={(intensityHigh) => onStep({ ...step, intensityHigh })} />
                </View>
              </View>
            ) : (
              <>
                <View accessibilityRole="radiogroup" style={styles.pills}>
                  {zones.map((zone) => (
                    <ChoicePill key={zone.key} role="radio" label={zone.label} selected={zone.key === zoneKey} onPress={() => onStep({ ...step, intensityLow: zone.low, intensityHigh: zone.high })} />
                  ))}
                </View>
                {bounds('Min', 'Max', '% CSS')}
              </>
            )}
            <View style={styles.fieldGroup}>
              <Text variant="caption" color="ink">
                Matériel
              </Text>
              <View style={styles.pills}>
                {Object.entries(EQUIPMENT_LABELS).map(([value, label]) => {
                  const on = (step.equipment ?? []).includes(value);
                  return (
                    <ChoicePill
                      key={value}
                      label={on ? `✓ ${label}` : `+ ${label}`}
                      selected={on}
                      onPress={() => onStep({ ...step, equipment: on ? (step.equipment ?? []).filter((item) => item !== value) : [...(step.equipment ?? []), value] })}
                    />
                  );
                })}
              </View>
            </View>
          </>
        )}

        <Field label="Intitulé (facultatif)" placeholder={bike ? 'Ex. côte, sprint' : 'Ex. bras seuls, éducatifs'} value={step.label ?? ''} onChangeText={(label) => onStep({ ...step, label })} />
        <Field label="Consigne" placeholder={bike ? 'Ex. rester assis, régulier' : 'Ex. virages propres'} value={step.description ?? ''} onChangeText={(description) => onStep({ ...step, description })} />

        {resolved ? (
          <Text variant="small" color="accentInk">
            {bike ? `FTP ${reference.ftp} W : ${resolved}` : `CSS ${formatSwimPace(reference.css ?? 0)} : ${resolved}`}
          </Text>
        ) : null}

        {options.recovery ? (
          step.recoveryMode ? (
            <View style={[styles.recovery, { borderTopColor: colors.border }]}>
              <View style={styles.rowBetween}>
                <Text variant="h3">Récupération</Text>
                <Button label="Retirer" variant="danger" size="sm" onPress={() => onStep({ ...step, recoveryMode: null, recoverySeconds: null, recoveryDescription: '' })} />
              </View>
              {bike ? (
                <>
                  <DecimalField
                    key={`${step.key}-rec`}
                    label="Durée"
                    unit="min"
                    value={step.recoverySeconds ? step.recoverySeconds / 60 : null}
                    onChange={(minutes) => onStep({ ...step, recoverySeconds: minutes ? Math.round(minutes * 60) : null })}
                  />
                  <DecimalField key={`${step.key}-rec-ftp`} label="Intensité" unit="% FTP" integer value={step.recoveryIntensity} onChange={(recoveryIntensity) => onStep({ ...step, recoveryIntensity })} />
                </>
              ) : (
                <>
                  <Segmented<'rest' | 'sendoff'>
                    options={[
                      { value: 'rest', label: 'Repos' },
                      { value: 'sendoff', label: 'Départ fixe' },
                    ]}
                    value={step.recoveryMode === 'sendoff' ? 'sendoff' : 'rest'}
                    onChange={(recoveryMode) => onStep({ ...step, recoveryMode, recoverySeconds: recoveryMode === 'sendoff' ? 110 : 15 })}
                  />
                  <PaceField
                    key={`${step.key}-rest-${step.recoveryMode}`}
                    label={step.recoveryMode === 'sendoff' ? 'Départ toutes les' : 'Repos'}
                    seconds={step.recoverySeconds}
                    plainSeconds={step.recoveryMode === 'rest'}
                    onChange={(recoverySeconds) => onStep({ ...step, recoverySeconds })}
                  />
                </>
              )}
              <Field label="Consigne de récupération" placeholder={bike ? 'Tourner les jambes' : 'Au mur'} value={step.recoveryDescription ?? ''} onChangeText={(recoveryDescription) => onStep({ ...step, recoveryDescription })} />
            </View>
          ) : (
            <Button
              label="Ajouter une récupération"
              variant="ghost"
              size="sm"
              icon="plus"
              onPress={() => onStep(bike ? { ...step, recoveryMode: 'duration', recoverySeconds: 180, recoveryIntensity: 55 } : { ...step, recoveryMode: 'rest', recoverySeconds: 15 })}
              style={styles.alignStart}
            />
          )
        ) : null}
      </View>
    );
  };

  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text variant="sectionTitle">{bike ? 'Blocs vélo' : 'Séries'}</Text>
        {total.sec ? (
          <Text variant="small" tabular>
            {bike ? '' : `${formatMeters(total.dist)} · `}≈ {formatDuration(total.sec)}
          </Text>
        ) : null}
      </View>
      {segments.length ? (
        <View style={[styles.profile, { backgroundColor: colors.bg }]}>
          <WorkoutProfile segments={segments} width={width - layout.gutter * 2 - 32 - 20} height={56} />
        </View>
      ) : null}

      <View style={styles.list}>
        {blocks.map((block, blockIndex) => {
          const group = isGroup(block);
          const open = expanded === block.key;
          const title = group ? (block.label?.trim() || 'Bloc à répéter') : block.label?.trim() || ROLE_LABELS[block.role];

          return (
            // Bleu = bloc à répéter ; une étape ouverte prend un cadre neutre plus marqué.
            <View key={block.key} style={[styles.block, { backgroundColor: colors.surface, borderColor: group ? colors.accent : open ? colors.borderStrong : colors.border }, group && styles.groupBlock]}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${title}, ${open ? 'replier' : 'modifier'}`} onPress={() => toggle(block.key)} style={styles.header}>
                <View style={[styles.bar, { backgroundColor: shade(group ? (block.children?.[0] ?? block) : block) }]} />
                <View style={styles.flex}>
                  <Text variant="overline">{title}</Text>
                  {group ? (
                    <Text variant="h3" numberOfLines={2}>
                      {`${Math.max(1, block.repetitions ?? 1)} × ${(block.children ?? []).map(volume).join(' + ')}`}
                    </Text>
                  ) : (
                    <>
                      <Text variant="h3">{volume(block)}</Text>
                      <Text variant="small" numberOfLines={2}>
                        {summary(block, false)}
                      </Text>
                    </>
                  )}
                </View>
                <Icon name={open ? 'chevronDown' : 'pen'} size={18} color={colors.text3} />
              </Pressable>

              {open ? (
                <View style={[styles.body, { borderTopColor: colors.border }]}>
                  {group ? (
                    <View style={styles.fields}>
                      <Stepper label="Répéter la série" value={Math.max(1, block.repetitions ?? 1)} min={1} max={60} suffix=" ×" onChange={(repetitions) => update(block.key, (current) => ({ ...current, repetitions }))} />
                      <Field label="Intitulé du bloc (facultatif)" placeholder={bike ? 'Ex. seuil' : 'Ex. éducatifs'} value={block.label ?? ''} onChangeText={(label) => update(block.key, (current) => ({ ...current, label }))} />
                    </View>
                  ) : (
                    <>
                      <Segmented<EditableSportBlock['role']>
                        options={[
                          { value: 'warmup', label: 'Échauff.' },
                          { value: 'main', label: 'Corps' },
                          { value: 'cooldown', label: 'Retour calme' },
                        ]}
                        value={block.role}
                        onChange={(role) => update(block.key, (current) => ({ ...current, role }))}
                      />
                      {renderStepFields(block, (next) => update(block.key, (current) => ({ ...next, children: current.children })), { recovery: false })}
                    </>
                  )}

                  <StepActions
                    subject={group ? 'le bloc' : 'l’étape'}
                    onDelete={() => remove(block.key)}
                    onValidate={() => setExpanded(null)}
                    onUp={() => move(block.key, -1)}
                    onDown={() => move(block.key, 1)}
                    canUp={blockIndex > 0}
                    canDown={blockIndex < blocks.length - 1}
                  />
                </View>
              ) : null}

              {group ? (
                <View style={[styles.children, { backgroundColor: colors.bg }]}>
                  {(block.children ?? []).map((child, childIndex) => {
                    const childOpen = expanded === child.key;
                    return (
                      <View key={child.key} style={childIndex > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded: childOpen }}
                          accessibilityLabel={`Étape ${childIndex + 1} du bloc, ${childOpen ? 'replier' : 'modifier'}`}
                          onPress={() => toggle(child.key)}
                          style={styles.header}>
                          <View style={[styles.bar, { backgroundColor: shade(child) }]} />
                          <View style={styles.flex}>
                            <Text variant="h3">{child.label?.trim() ? `${child.label.trim()} · ${volume(child)}` : volume(child)}</Text>
                            <Text variant="small" numberOfLines={3}>
                              {summary(child, true)}
                            </Text>
                          </View>
                          <Icon name={childOpen ? 'chevronDown' : 'pen'} size={18} color={colors.text3} />
                        </Pressable>
                        {childOpen ? (
                          <View style={styles.childBody}>
                            {renderStepFields(child, (next) => updateChild(block.key, child.key, () => next), { recovery: true })}
                            <StepActions
                              subject="l’étape"
                              onDelete={() => removeChild(block.key, child.key)}
                              onValidate={() => setExpanded(null)}
                              onUp={() => moveChild(block.key, child.key, -1)}
                              onDown={() => moveChild(block.key, child.key, 1)}
                              canUp={childIndex > 0}
                              canDown={childIndex < (block.children?.length ?? 0) - 1}
                            />
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
                      const last = block.children?.[block.children.length - 1];
                      const child = last ? { ...last, key: `${block.key}-${Date.now()}` } : newSportChild(sport);
                      update(block.key, (current) => ({ ...current, children: [...(current.children ?? []), child] }));
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
        <Button label={bike ? 'Étape' : 'Série'} variant="secondary" size="sm" icon="plus" onPress={() => add(newSportStep(sport))} />
        <Button label="Bloc à répéter" variant="secondary" size="sm" icon="repeat" onPress={() => add(newSportRepeat(sport))} />
        {!hasWarmup ? <Button label="Échauffement" variant="secondary" size="sm" icon="plus" onPress={() => add(newSportWarmup(sport))} /> : null}
        {!hasCooldown ? <Button label="Retour au calme" variant="secondary" size="sm" icon="plus" onPress={() => add(newSportCooldown(sport))} /> : null}
      </View>
    </Card>
  );
}

type PaceFieldProps = {
  label: string;
  seconds: number | null | undefined;
  onChange: (seconds: number | null) => void;
  /** Repos court : « 15 » se lit en secondes et s'affiche tel quel. */
  plainSeconds?: boolean;
};

/** Allure ou temps de natation saisi « 1'45 » (ou « 15 » secondes pour un repos). */
function PaceField({ label, seconds, onChange, plainSeconds }: PaceFieldProps) {
  const [text, setText] = useState(() => (plainSeconds ? restInput(seconds, false) : seconds ? formatSwimPace(seconds) : ''));
  return (
    <Field
      label={label}
      value={text}
      placeholder={plainSeconds ? '15' : "1'45"}
      keyboardType="numbers-and-punctuation"
      onChangeText={(input) => {
        setText(input);
        onChange(parseSwimPace(input) ?? null);
      }}
      trailing={
        <Text variant="small" color="text3">
          {plainSeconds && (seconds ?? 0) < 60 ? 's' : '/100 m'}
        </Text>
      }
    />
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
  pair: { flexDirection: 'row', gap: 10 },
  recovery: { gap: 12, paddingTop: 12, borderTopWidth: 1 },
  blockActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  children: { marginHorizontal: 10, marginBottom: 10, borderRadius: radius.md, paddingHorizontal: 4, paddingBottom: 4 },
  childBody: { paddingHorizontal: 8, paddingBottom: 12, gap: 12 },
  alignStart: { alignSelf: 'flex-start' },
  alignEnd: { alignSelf: 'flex-end' },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
});
