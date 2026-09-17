import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ChoicePill, Field, FormError, Text } from '@/components/ui';
import { useAthleteActions } from '@/features/athlete/queries';
import { useSession } from '@/features/auth/session';

import { APP_TOUR } from './onboarding';
import { parseDecimal, toIsoDay } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';

import { GuidedTour, TOUR_STEPS } from './guided-tour';

const LEVELS = [
  { value: 'debutant', label: 'Débutant', hint: 'Je cours occasionnellement ou je débute' },
  { value: 'intermediaire', label: 'Intermédiaire', hint: 'Je cours régulièrement depuis 1-2 ans' },
  { value: 'confirme', label: 'Confirmé', hint: 'Je m’entraîne sérieusement et régulièrement' },
  { value: 'expert', label: 'Expert', hint: 'Compétiteur ou coureur très expérimenté' },
] as const;

const SPORTS = [
  { value: 'running', label: 'Running', hint: 'Course, trail, marathon…' },
  { value: 'fitness', label: 'Muscu / Fitness', hint: 'Renfo, hypertrophie, calisthénie…' },
];

const STRENGTH_GOALS = [
  { value: 'force', label: 'Force' },
  { value: 'hypertrophie', label: 'Hypertrophie' },
  { value: 'endurance_musculaire', label: 'Endurance musculaire' },
  { value: 'remise_en_forme', label: 'Remise en forme' },
  { value: 'fonctionnel', label: 'Fonctionnel' },
  { value: 'calisthenie', label: 'Calisthénie' },
];

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const TIMES = [
  { value: 'matin', label: 'Matin' },
  { value: 'midi', label: 'Midi' },
  { value: 'soir', label: 'Soir' },
  { value: 'flexible', label: 'Peu importe' },
];

const FREQUENCIES = [1, 2, 3, 4, 5, 6];

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

const ALL_STEPS = ['welcome', 'sport', 'level', 'frequency', 'strength', 'days', 'body', 'goal', 'done'] as const;
type Step = (typeof ALL_STEPS)[number];

/**
 * Mise en route au premier lancement : ce qu'il faut savoir de l'athlète pour
 * calculer ses allures, puis la visite guidée de l'app.
 */
export function OnboardingFlow() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { completeOnboarding, markTourSeen } = useAthleteActions();

  const [index, setIndex] = useState(0);
  const [tour, setTour] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [disciplines, setDisciplines] = useState<string[]>(['running']);
  const [level, setLevel] = useState<string>('');
  const [frequency, setFrequency] = useState(3);
  const [days, setDays] = useState<string[]>([]);
  const [time, setTime] = useState('flexible');
  const [vma, setVma] = useState('');
  const [fcmax, setFcmax] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [raceName, setRaceName] = useState('');
  const [raceDate, setRaceDate] = useState('');
  const [strengthGoal, setStrengthGoal] = useState('');
  const [strengthFrequency, setStrengthFrequency] = useState(2);

  // Les étapes course ne sont posées qu'aux coureurs, l'étape muscu qu'aux pratiquants.
  const steps = ALL_STEPS.filter(
    (key) =>
      (key !== 'level' && key !== 'frequency' && key !== 'goal' && key !== 'strength') ||
      (key === 'strength' ? disciplines.includes('fitness') : disciplines.includes('running')),
  );

  if (tour) return <GuidedTour steps={TOUR_STEPS} onDone={() => markTourSeen(APP_TOUR)} />;

  const step: Step = steps[Math.min(index, steps.length - 1)];

  const save = async (skipped: boolean) => {
    const numbers = { vma: parseDecimal(vma), fcmax: parseDecimal(fcmax), height: parseDecimal(height), weight: parseDecimal(weight) };
    if (!skipped && vma.trim() && numbers.vma === undefined) return setError('La VMA doit être un nombre, en km/h.');

    setSaving(true);
    setError(null);
    try {
      await completeOnboarding(
        skipped
          ? {}
          : {
              disciplines,
              runningLevel: (level || undefined) as never,
              weeklyFrequency: frequency,
              availableDays: days,
              preferredTime: time,
              strengthGoal: disciplines.includes('fitness') ? strengthGoal || undefined : undefined,
              strengthFrequency: disciplines.includes('fitness') ? strengthFrequency : undefined,
              vma: numbers.vma,
              fcmax: numbers.fcmax === undefined ? undefined : Math.round(numbers.fcmax),
              height: numbers.height === undefined ? undefined : Math.round(numbers.height),
              weight: numbers.weight,
            },
        !skipped && raceName.trim() && /^\d{4}-\d{2}-\d{2}$/.test(raceDate)
          ? { name: raceName.trim(), date: new Date(`${raceDate}T09:00:00`).toISOString(), discipline: '10km', priority: 'A' }
          : undefined,
      );
      // L'assistant disparaît avec `hasCompletedOnboarding` : on enchaîne sur la visite.
      if (!skipped) setTour(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  };

  const next = () => (index === steps.length - 1 ? save(false) : setIndex((value) => value + 1));

  const content: Record<Step, { title: string; text: string; body?: React.ReactNode }> = {
    welcome: {
      title: `Bienvenue ${user?.firstName ?? ''} !`,
      text: 'On a besoin de 2 minutes pour personnaliser ton expérience : tes allures, tes séances et ton planning en dépendent. Tout reste modifiable plus tard.',
    },
    sport: {
      title: 'Quels sports pratiques-tu ?',
      text: 'Sélectionne un ou plusieurs sports. On adaptera tes plans en conséquence.',
      body: (
        <View style={styles.pills}>
          {SPORTS.map((sport) => (
            <ChoicePill key={sport.value} label={sport.label} selected={disciplines.includes(sport.value)} onPress={() => setDisciplines((current) => toggle(current, sport.value))} />
          ))}
        </View>
      ),
    },
    level: {
      title: 'Ton niveau en course à pied',
      text: 'On adapte tes plans d’entraînement en fonction de ton expérience.',
      body: (
        <View accessibilityRole="radiogroup" style={styles.pills}>
          {LEVELS.map((option) => (
            <ChoicePill key={option.value} role="radio" label={option.label} selected={level === option.value} onPress={() => setLevel(option.value)} />
          ))}
        </View>
      ),
    },
    frequency: {
      title: 'Fréquence running',
      text: 'Combien de sorties par semaine ? Ce que tu tiens vraiment, pas ce que tu voudrais tenir.',
      body: (
        <View accessibilityRole="radiogroup" style={styles.pills}>
          {FREQUENCIES.map((count) => (
            <ChoicePill key={count} role="radio" label={`${count}`} selected={frequency === count} onPress={() => setFrequency(count)} />
          ))}
        </View>
      ),
    },
    days: {
      title: 'Tes disponibilités',
      text: 'Quand peux-tu t’entraîner ? Ton coach s’en sert pour poser tes séances au bon moment. (optionnel mais recommandé)',
      body: (
        <>
          <View style={styles.pills}>
            {DAYS.map((day, dayIndex) => (
              <ChoicePill key={day} label={DAY_LABELS[dayIndex]} selected={days.includes(day)} onPress={() => setDays((current) => toggle(current, day))} />
            ))}
          </View>
          <Text variant="caption" style={styles.label}>
            Plutôt à quel moment ?
          </Text>
          <View accessibilityRole="radiogroup" style={styles.pills}>
            {TIMES.map((option) => (
              <ChoicePill key={option.value} role="radio" label={option.label} selected={time === option.value} onPress={() => setTime(option.value)} />
            ))}
          </View>
        </>
      ),
    },
    body: {
      title: 'Tes données physiques',
      text: 'Ces infos permettent de calibrer l’intensité de tes séances. (optionnel)',
      body: (
        <>
          <View style={styles.row}>
            <Field label="VMA (km/h)" placeholder="16,5" keyboardType="decimal-pad" value={vma} onChangeText={setVma} containerStyle={styles.flex} />
            <Field label="FC max" placeholder="191" keyboardType="number-pad" value={fcmax} onChangeText={setFcmax} containerStyle={styles.flex} />
          </View>
          <View style={styles.row}>
            <Field label="Taille (cm)" placeholder="178" keyboardType="number-pad" value={height} onChangeText={setHeight} containerStyle={styles.flex} />
            <Field label="Poids (kg)" placeholder="71" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} containerStyle={styles.flex} />
          </View>
          <Text variant="caption">Tu ne connais pas ta FCmax ? Estimation rapide : 220 − ton âge.</Text>
        </>
      ),
    },
    goal: {
      title: 'Tes compétitions',
      text: 'Ajoute la course que tu prépares : elle apparaîtra avec son compte à rebours. (optionnel, modifiable plus tard)',
      body: (
        <>
          <Field label="Nom de la course" placeholder="Marathon de Lyon" value={raceName} onChangeText={setRaceName} />
          <Field label="Date" placeholder={toIsoDay(new Date())} autoCapitalize="none" value={raceDate} onChangeText={setRaceDate} />
        </>
      ),
    },
    done: {
      title: 'C’est parti !',
      text: 'Ton profil est configuré. On fait le tour de l’app en six écrans ?',
    },
    strength: {
      title: 'Ton objectif muscu',
      text: 'On structure ton programme selon ton objectif principal.',
      body: (
        <>
          <View accessibilityRole="radiogroup" style={styles.pills}>
            {STRENGTH_GOALS.map((option) => (
              <ChoicePill key={option.value} role="radio" label={option.label} selected={strengthGoal === option.value} onPress={() => setStrengthGoal(option.value)} />
            ))}
          </View>
          <Text variant="caption" style={styles.label}>
            Séances de muscu par semaine
          </Text>
          <View accessibilityRole="radiogroup" style={styles.pills}>
            {FREQUENCIES.map((count) => (
              <ChoicePill key={count} role="radio" label={`${count}`} selected={strengthFrequency === count} onPress={() => setStrengthFrequency(count)} />
            ))}
          </View>
        </>
      ),
    },
  };

  const current = content[step];

  return (
    <Modal visible transparent={false} animationType="slide" statusBarTranslucent onRequestClose={() => save(true)}>
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.progress}>
          {steps.map((key, stepIndex) => (
            <View key={key} style={[styles.progressBar, { backgroundColor: stepIndex <= index ? colors.accent : colors.subtle }]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="display">{current.title}</Text>
          <Text variant="body2" style={styles.intro}>
            {current.text}
          </Text>
          {current.body ? <View style={styles.form}>{current.body}</View> : null}
        </ScrollView>

        <FormError message={error} style={styles.error} />

        <View style={styles.actions}>
          {index > 0 ? <Button label="Retour" variant="secondary" disabled={saving} onPress={() => setIndex((value) => value - 1)} style={styles.flex} /> : null}
          <Button
            label={step === 'done' ? (saving ? 'Sauvegarde…' : 'Explorer Trainwise') : index === 0 ? 'Commencer' : 'Continuer'}
            icon={step === 'done' ? 'check' : 'arrowRight'}
            iconPosition={step === 'done' ? 'leading' : 'trailing'}
            disabled={saving}
            onPress={next}
            style={styles.flex}
          />
        </View>
        {step === 'done' ? null : <Button label={index === 0 ? 'Configurer plus tard' : 'Passer'} variant="ghost" size="sm" disabled={saving} onPress={() => save(true)} />}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: layout.gutter },
  progress: { flexDirection: 'row', gap: 4, marginBottom: 24 },
  progressBar: { flex: 1, height: 4, borderRadius: radius.pill },
  content: { paddingBottom: 24 },
  intro: { marginTop: 8 },
  form: { marginTop: 24, gap: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { marginTop: 8 },
  row: { flexDirection: 'row', gap: 12 },
  error: { marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 8 },
});
