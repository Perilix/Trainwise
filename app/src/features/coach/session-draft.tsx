import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';

import { Button, Card, ChoicePill, Field, FormError, Icon, Section, Text } from '@/components/ui';
import { useBringIntoView } from '@/components/ui/keyboard-scroll';
import { SPORT_LABELS, sportIcon } from '@/features/athlete/other-sports';
import type { NewPlannedSession, Sport } from '@/features/athlete/types';
import { ExpectedFeelingPicker } from '@/features/sessions/expected-feeling';
import { formatDayShort, parseDecimal } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

const SPORTS: Sport[] = ['running', 'bike', 'swim', 'strength'];

/** Selon le sport : exemple de titre, titres rapides (avec leur type de séance), distance, consignes. */
const COPY: Record<Sport, { title: string; quick: [string, string][]; distance: string; desc: string; type: string }> = {
  running: {
    title: 'Fractionné 10 × 400 m',
    quick: [['Endurance', 'endurance'], ['Fractionné', 'fractionne'], ['Seuil', 'tempo'], ['Sortie longue', 'sortie_longue'], ['Côtes', 'cotes']],
    distance: '10',
    desc: 'Ex. footing en aisance, 4 lignes droites à la fin',
    type: 'endurance',
  },
  bike: {
    title: 'Sortie endurance 2 h',
    quick: [['Endurance', 'bike'], ['Seuil', 'bike'], ['PMA', 'bike'], ['Sortie longue', 'bike'], ['Home trainer', 'bike']],
    distance: '60',
    desc: 'Ex. zone 2 tout du long, cadence autour de 90',
    type: 'bike',
  },
  swim: {
    title: '10 × 100 m crawl',
    quick: [['Technique', 'swim'], ['Endurance', 'swim'], ['Fractionné', 'swim'], ['Eau libre', 'swim']],
    distance: '1500',
    desc: 'Ex. 400 m échauffement, 10 × 100 m récup 20 s',
    type: 'swim',
  },
  strength: {
    title: 'Musculation haut du corps',
    quick: [['Haut du corps', 'upper_body'], ['Bas du corps', 'lower_body'], ['Full body', 'full_body'], ['Gainage', 'core']],
    distance: '',
    desc: 'Ex. 4 × 10 squats, 3 × 12 pompes',
    type: 'full_body',
  },
};

const PACE_PATTERN = /^\d{1,2}:[0-5]\d$/;

/** Brouillon d'une séance que le coach pose dans le planning : partagé entre le formulaire et la barre du bas. */
export function useSessionDraft(date: string, onSubmit: (payload: NewPlannedSession) => Promise<void>) {
  const [sport, setSport] = useState<Sport>('running');
  const [title, setTitle] = useState('');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [pace, setPace] = useState('');
  const [description, setDescription] = useState('');
  const [feeling, setFeeling] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeSport = (next: Sport) => {
    // Un titre rapide d'un autre sport (« Technique » passé en vélo) n'a plus de sens.
    const quickElsewhere = SPORTS.some((item) => COPY[item].quick.some(([label]) => label === title));
    if (quickElsewhere && !COPY[next].quick.some(([label]) => label === title)) setTitle('');
    setSport(next);
    setError(null);
  };

  const hasDistance = sport !== 'strength';
  const km = parseDecimal(distance);
  // La natation se saisit en mètres, l'API stocke des km.
  const distanceKm = hasDistance && km && km > 0 ? (sport === 'swim' ? km / 1000 : km) : undefined;
  const minutes = parseDecimal(duration);

  const summary = [
    formatDayShort(date),
    SPORT_LABELS[sport],
    distanceKm ? `${distance.trim()} ${sport === 'swim' ? 'm' : 'km'}` : null,
    minutes && minutes > 0 ? `${Math.round(minutes)} min` : null,
    feeling ? `${feeling}/10` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const submit = async () => {
    if ((hasDistance && distance.trim() && !(km && km > 0)) || (duration.trim() && !(minutes && minutes > 0))) {
      setError('La distance et la durée doivent être des nombres positifs.');
      return;
    }
    if (sport === 'running' && pace.trim() && !PACE_PATTERN.test(pace.trim())) {
      setError('Allure au format min:s, par exemple 5:30.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        date,
        activityType: sport,
        sessionType: COPY[sport].quick.find(([label]) => label === title)?.[1] ?? COPY[sport].type,
        title: title.trim() || undefined,
        targetDistance: distanceKm,
        targetDuration: minutes && minutes > 0 ? Math.round(minutes) : undefined,
        targetPace: sport === 'running' && pace.trim() ? pace.trim() : undefined,
        description: description.trim() || undefined,
        expectedFeeling: feeling,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ajout impossible.');
      setSaving(false);
    }
  };

  return {
    sport, changeSport, title, setTitle, distance, setDistance, duration, setDuration, pace, setPace,
    description, setDescription, feeling, setFeeling, saving, error, summary, submit,
  };
}

type Draft = ReturnType<typeof useSessionDraft>;

/** Le sport de la séance, en premier : le reste du formulaire s'y adapte. */
export function SessionSportPicker({ draft }: { draft: Draft }) {
  const { colors } = useTheme();
  return (
    <Section style={styles.block}>
      <Text variant="sectionTitle">Sport</Text>
      <View accessibilityRole="radiogroup" style={styles.sports}>
        {SPORTS.map((sport) => {
          const selected = sport === draft.sport;
          return (
            <Pressable
              key={sport}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => draft.changeSport(sport)}
              style={[
                styles.sport,
                selected
                  ? { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.accentSoft }
                  : { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
              ]}>
              <Icon name={sportIcon(sport)} size={22} color={selected ? colors.primary : colors.text2} strokeWidth={1.9} />
              <Text variant="h3" style={{ color: selected ? colors.primary : colors.text2 }}>
                {SPORT_LABELS[sport]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Section>
  );
}

/** Titre, objectifs, consignes et difficulté d'une nouvelle séance. */
export function SessionDraftForm({ draft }: { draft: Draft }) {
  const { colors } = useTheme();
  const areaRef = useRef<TextInputInstance>(null);
  const bringIntoView = useBringIntoView();
  const copy = COPY[draft.sport];
  const unit = (label: string) => (
    <Text variant="small" color="text3">
      {label}
    </Text>
  );

  return (
    <>
      <Section style={styles.block}>
        <Text variant="sectionTitle">Séance</Text>
        <Card style={styles.card}>
          <View style={styles.titleBlock}>
            <Field label="Titre" placeholder={copy.title} value={draft.title} onChangeText={draft.setTitle} />
            <View accessibilityRole="radiogroup" style={styles.pills}>
              {copy.quick.map(([label]) => (
                <ChoicePill key={label} role="radio" label={label} selected={draft.title === label} onPress={() => draft.setTitle(draft.title === label ? '' : label)} />
              ))}
            </View>
          </View>
          <View style={styles.row}>
            {draft.sport !== 'strength' ? (
              <Field
                label="Distance"
                placeholder={copy.distance}
                keyboardType="decimal-pad"
                value={draft.distance}
                onChangeText={draft.setDistance}
                trailing={unit(draft.sport === 'swim' ? 'm' : 'km')}
                containerStyle={styles.flex}
              />
            ) : null}
            <Field label="Durée" placeholder="45" keyboardType="number-pad" value={draft.duration} onChangeText={draft.setDuration} trailing={unit('min')} containerStyle={styles.flex} />
            {draft.sport === 'running' ? (
              <Field
                label="Allure"
                placeholder="5:30"
                keyboardType="numbers-and-punctuation"
                value={draft.pace}
                onChangeText={draft.setPace}
                trailing={unit('/km')}
                containerStyle={styles.flex}
              />
            ) : null}
          </View>
          <View>
            <Text variant="caption" style={styles.fieldLabel}>
              Consignes
            </Text>
            <TextInput
              ref={areaRef}
              onFocus={() => bringIntoView(areaRef.current)}
              accessibilityLabel="Consignes de la séance"
              placeholder={copy.desc}
              placeholderTextColor={colors.text3}
              value={draft.description}
              onChangeText={draft.setDescription}
              multiline
              style={[styles.description, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.ink }]}
            />
          </View>
        </Card>
      </Section>

      <Section style={styles.block}>
        <Text variant="sectionTitle">Difficulté attendue</Text>
        <Card>
          <ExpectedFeelingPicker value={draft.feeling} onChange={draft.setFeeling} />
        </Card>
      </Section>
    </>
  );
}

/** Barre du bas : le résumé de la séance et le bouton d'ajout. */
export function SessionDraftFooter({ draft }: { draft: Draft }) {
  return (
    <View style={styles.footer}>
      <FormError message={draft.error} />
      <Text variant="small" tabular style={styles.summary}>
        {draft.summary}
      </Text>
      <Button label={draft.saving ? 'Ajout…' : 'Ajouter au planning'} icon="plus" shape="pill" fullWidth disabled={draft.saving} onPress={draft.submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: 12, paddingBottom: 22 },
  sports: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sport: { flexBasis: '48%', flexGrow: 1, height: 56, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  card: { gap: 14 },
  titleBlock: { gap: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', gap: 10 },
  fieldLabel: { marginBottom: 6 },
  description: { minHeight: 96, padding: 12, borderWidth: 1, borderRadius: radius.md, fontFamily: fontFamily.regular, fontSize: 14, textAlignVertical: 'top' },
  footer: { gap: 10, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
  summary: { textAlign: 'center' },
});
