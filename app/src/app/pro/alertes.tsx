import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { BackBar, Button, Card, Chip, FormError, Icon, Screen, Section, StateView, Text } from '@/components/ui';
import { useAlertRules, useCoachActions } from '@/features/coach/queries';
import type { ApiAlertRules } from '@/lib/api-types';
import { useTheme } from '@/theme/theme-provider';
import { layout } from '@/theme/tokens';

type Field = keyof ApiAlertRules;

const BOUNDS: Record<Exclude<Field, 'volumeDropEnabled'>, [number, number]> = {
  inactivityOrange: [1, 60],
  inactivityRed: [2, 90],
  skippedOrange: [1, 20],
  skippedRed: [2, 30],
  feelingOrange: [2, 10],
  feelingRed: [1, 9],
  volumeDropPercent: [10, 90],
};

/**
 * Les seuils d'alerte du coach : à partir de quand un athlète passe en orange,
 * puis en rouge. Le calcul ne change pas (inactivité, séances sautées,
 * ressenti, baisse de volume) — ce sont les bornes qui deviennent les siennes,
 * et elles valent aussi bien ici que sur le web.
 *
 * Régler ces seuils fait partie du plan Studio : sans lui, l'écran montre les
 * valeurs en vigueur sans permettre de les changer.
 */
export default function CoachAlertsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data, loading, refetch } = useAlertRules();
  const { saveAlertRules } = useCoachActions();

  const [edited, setEdited] = useState<ApiAlertRules | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = data?.editable ?? false;
  // Tant que le coach n'a rien touché, on affiche ce que le serveur a renvoyé.
  const draft = edited ?? data?.rules ?? null;

  const set = (field: Field, value: number | boolean) => {
    if (!draft) return;
    setEdited({ ...draft, [field]: value });
    setError(null);
  };

  const step = (field: Exclude<Field, 'volumeDropEnabled'>, delta: number) => {
    if (!draft) return;
    const [min, max] = BOUNDS[field];
    set(field, Math.min(max, Math.max(min, draft[field] + delta)));
  };

  const dirty = Boolean(edited && data && JSON.stringify(edited) !== JSON.stringify(data.rules));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      // Le serveur peut corriger un seuil incohérent : on affiche ce qu'il retient.
      const state = await saveAlertRules(draft);
      setEdited({ ...state.rules });
      refetch();
      router.back();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  };

  if (loading && !draft) {
    return (
      <Screen>
        <BackBar title="Alertes" />
        <StateView loading error={null} />
      </Screen>
    );
  }

  if (!draft) {
    return (
      <Screen>
        <BackBar title="Alertes" />
        <StateView loading={false} error="Seuils indisponibles." onRetry={refetch} />
      </Screen>
    );
  }

  const stepper = (field: Exclude<Field, 'volumeDropEnabled'>, tone: 'orange' | 'red', suffix: string, disabled = false) => (
    <View style={styles.stepper}>
      <View style={[styles.dot, { backgroundColor: tone === 'orange' ? colors.warning : colors.danger }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Diminuer"
        disabled={!editable || disabled}
        onPress={() => step(field, -1)}
        style={[styles.round, { borderColor: colors.borderStrong, opacity: !editable || disabled ? 0.4 : 1 }]}>
        <Icon name="minus" size={16} color={colors.ink} strokeWidth={2} />
      </Pressable>
      <Text variant="h3" style={styles.value}>
        {draft[field]}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Augmenter"
        disabled={!editable || disabled}
        onPress={() => step(field, 1)}
        style={[styles.round, { borderColor: colors.borderStrong, opacity: !editable || disabled ? 0.4 : 1 }]}>
        <Icon name="plus" size={16} color={colors.ink} strokeWidth={2} />
      </Pressable>
      <Text variant="caption" style={styles.suffix}>
        {suffix}
      </Text>
    </View>
  );

  return (
    <Screen
      footer={
        editable ? (
          <View style={styles.footer}>
            <FormError message={error} />
            <Button label={saving ? 'Enregistrement…' : 'Enregistrer'} icon="check" fullWidth disabled={!dirty || saving} onPress={save} />
          </View>
        ) : undefined
      }>
      <BackBar title="Alertes" />

      <Section style={styles.tight}>
        <Card>
          <View style={styles.head}>
            <Icon name="bell" size={20} color={colors.text2} />
            <View style={styles.flex}>
              <Text variant="sectionTitle">Quand un athlète décroche</Text>
              <Text variant="small">Ces seuils décident de la couleur de sa pastille.</Text>
            </View>
            {!editable ? <Chip label="Studio" tone="accent" /> : null}
          </View>
        </Card>
      </Section>

      <Section style={styles.tight}>
        <Card style={styles.rule}>
          <Text variant="sectionTitle">Sans activité</Text>
          <Text variant="small">Ni sortie, ni séance de muscu enregistrée.</Text>
          {stepper('inactivityOrange', 'orange', 'jours')}
          {stepper('inactivityRed', 'red', 'jours')}
        </Card>
      </Section>

      <Section style={styles.tight}>
        <Card style={styles.rule}>
          <Text variant="sectionTitle">Séances sautées</Text>
          <Text variant="small">Sur les 28 derniers jours.</Text>
          {stepper('skippedOrange', 'orange', 'séances')}
          {stepper('skippedRed', 'red', 'séances')}
        </Card>
      </Section>

      <Section style={styles.tight}>
        <Card style={styles.rule}>
          <Text variant="sectionTitle">Ressenti moyen</Text>
          <Text variant="small">La note donnée après les sorties, sur 10. En dessous du seuil, l’athlète bascule.</Text>
          {stepper('feelingOrange', 'orange', 'sur 10')}
          {stepper('feelingRed', 'red', 'sur 10')}
        </Card>
      </Section>

      <Section style={styles.tight}>
        <Card style={styles.rule}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text variant="sectionTitle">Baisse de volume</Text>
              <Text variant="small">La semaine écoulée comparée aux trois précédentes.</Text>
            </View>
            <Switch
              value={draft.volumeDropEnabled}
              disabled={!editable}
              onValueChange={(value) => set('volumeDropEnabled', value)}
              trackColor={{ true: colors.brand, false: colors.subtle }}
            />
          </View>
          {stepper('volumeDropPercent', 'orange', '% du volume habituel', !draft.volumeDropEnabled)}
        </Card>
      </Section>

      <Section>
        {editable ? (
          <Text variant="caption">Le rouge reste toujours plus sévère que l’orange : le serveur corrige si besoin.</Text>
        ) : (
          <Card style={[styles.upsell, { backgroundColor: colors.accentSoft }]}>
            <Icon name="lock" size={18} color={colors.accentInk} />
            <Text variant="small" color="accentInk" style={styles.flex}>
              Fixer vos propres seuils fait partie du plan Studio. Les valeurs affichées sont celles qui s’appliquent.
            </Text>
          </Card>
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tight: { paddingBottom: 12 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rule: { gap: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  round: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 34, textAlign: 'center' },
  suffix: { flex: 1 },
  upsell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footer: { gap: 8, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
});
