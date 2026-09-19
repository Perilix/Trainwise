import { Linking, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Icon, Text } from '@/components/ui';
import { formatDayShort } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

import { useCoachBilling } from './queries';

/**
 * Le bouton qui renvoie vers la gestion de l'abonnement sur le site.
 *
 * Il parle de *gérer*, jamais de souscrire : c'est la gestion de compte d'un
 * service multiplateforme, pas une incitation à acheter hors achat intégré.
 * La règle anti-incitation d'Apple (App Review Guidelines 3.1.1) a été
 * assouplie aux États-Unis puis en Europe en 2025, mais elle bouge encore.
 * Si un review le refuse, passer cette constante à `false` suffit : la carte
 * garde son état affiché, sans lien.
 */
const SHOW_MANAGE_BUTTON = true;

const MANAGE_URL = 'https://www.trainwise-app.com/coach/abonnement';

/**
 * L'abonnement du coach, en lecture seule.
 *
 * Aucun bouton d'achat : l'abonnement se souscrit et se change sur
 * trainwise-app.com, par Stripe. Un abonnement vendu depuis une app iOS passe
 * obligatoirement par l'achat intégré d'Apple et sa commission ; la carte se
 * contente donc de dire où en est le coach.
 */
export function PlanCard() {
  const { colors } = useTheme();
  const { data } = useCoachBilling();

  if (!data) return null;

  const { subscription, usage, plans } = data;
  const plan = plans.find((item) => item.id === subscription.planId);
  const overLimit = usage.athleteLimit !== null && usage.athletes > usage.athleteLimit;
  const fill = usage.athleteLimit ? Math.min(100, Math.round((usage.athletes / usage.athleteLimit) * 100)) : 12;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Icon name="trophy" size={20} color={colors.text2} />
        <View style={styles.flex}>
          <Text variant="sectionTitle">Abonnement</Text>
          <Text variant="small">{plan?.name ?? 'Découverte'}</Text>
        </View>
        {subscription.status === 'past_due' ? <Chip label="Impayé" tone="danger" /> : <Chip label={plan?.name ?? 'Découverte'} tone="accent" />}
      </View>

      <View style={styles.usage}>
        <View style={styles.usageLine}>
          <Text variant="body2" style={styles.flex}>
            Athlètes suivis
          </Text>
          <Text variant="h3" tabular>
            {usage.athletes}
            {usage.athleteLimit !== null ? ` / ${usage.athleteLimit}` : ''}
          </Text>
        </View>
        <View style={[styles.bar, { backgroundColor: colors.subtle }]}>
          <View style={[styles.fill, { backgroundColor: overLimit ? colors.danger : colors.accent, width: `${fill}%` }]} />
        </View>
      </View>

      <View style={styles.usageLine}>
        <Text variant="body2" style={styles.flex}>
          Groupes
        </Text>
        <Text variant="h3" tabular>
          {usage.groups}
          {usage.groupLimit !== null ? ` / ${usage.groupLimit}` : ''}
        </Text>
      </View>

      <View style={styles.usageLine}>
        <Text variant="body2" style={styles.flex}>
          Alertes sur mesure
        </Text>
        <Text variant="h3">{plan?.customAlerts ? 'Incluses' : 'Non incluses'}</Text>
      </View>

      {subscription.renewsOn ? (
        <Text variant="caption">
          {subscription.cancelAtPeriodEnd ? 'Votre plan prend fin le ' : 'Prochain prélèvement le '}
          {formatDayShort(subscription.renewsOn.slice(0, 10))}
        </Text>
      ) : null}

      {SHOW_MANAGE_BUTTON ? (
        <Button
          label="Gérer mon abonnement"
          variant="secondary"
          icon="plug"
          fullWidth
          onPress={() => Linking.openURL(MANAGE_URL).catch(() => undefined)}
        />
      ) : (
        <Text variant="caption">Votre abonnement se gère depuis le site, sur un ordinateur.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  usage: { gap: 6 },
  usageLine: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  bar: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
