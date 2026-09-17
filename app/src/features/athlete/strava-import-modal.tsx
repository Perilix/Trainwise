import { BlurView } from 'expo-blur';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import type { StravaImportResult } from '@/features/athlete/queries';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

type Props = {
  /** `null` : rien en cours, la fenêtre est masquée. */
  result: StravaImportResult | null;
  onClose: () => void;
};

const plural = (count: number) => `${count} séance${count > 1 ? 's' : ''}`;

/** Suivi de l'import de l'historique Strava, juste après la connexion du compte. */
export function StravaImportModal({ result, onClose }: Props) {
  const { colors, scheme } = useTheme();
  if (!result) return null;

  const running = result.status === 'running';
  const failed = result.status === 'error';

  const title = running ? 'Import de tes séances' : failed ? 'Import interrompu' : 'Strava connecté';
  const body = {
    running: result.imported
      ? `${plural(result.imported)} récupérée${result.imported > 1 ? 's' : ''} pour l’instant. On continue…`
      : 'On récupère ton historique Strava, ça prend quelques instants.',
    done: `${plural(result.imported)} importée${result.imported > 1 ? 's' : ''} depuis ton historique. Les prochaines arriveront toutes seules.`,
    partial: `${plural(result.imported)} importée${result.imported > 1 ? 's' : ''}. Strava limite le nombre de requêtes : le reste de ton historique suivra.`,
    error: 'Ton compte est bien relié, mais l’import de l’historique a échoué. Tes prochaines sorties seront quand même importées.',
  }[result.status];

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={running ? undefined : onClose}>
      <View style={styles.backdrop}>
        {/* L'écran reste visible derrière, flouté : la fenêtre se pose dessus au lieu de le masquer. */}
        <BlurView intensity={40} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 25, 35, 0.35)' }]} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.badge, { backgroundColor: failed ? colors.dangerSoft : colors.stravaSoft }]}>
            {running ? (
              <ActivityIndicator color={colors.strava} />
            ) : (
              <Icon name={failed ? 'warning' : 'check'} size={26} color={failed ? colors.danger : colors.stravaInk} strokeWidth={2.4} />
            )}
          </View>

          <Text variant="h2" style={styles.title}>
            {title}
          </Text>
          <Text variant="body2" style={styles.body}>
            {body}
          </Text>

          {running ? (
            <Text variant="caption" style={styles.hint}>
              Tu peux fermer cette fenêtre, l’import continue de son côté.
            </Text>
          ) : null}

          <Button label={running ? 'Continuer en arrière-plan' : 'Terminé'} variant={running ? 'secondary' : 'primary'} fullWidth style={styles.action} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 28 },
  // La carte reste pleine : du texte sur du verre par-dessus un fond flouté perdrait en lisibilité.
  card: { width: '100%', maxWidth: 340, borderRadius: radius.xl, borderWidth: 1, padding: 24, alignItems: 'center' },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 16, textAlign: 'center' },
  body: { marginTop: 8, textAlign: 'center' },
  hint: { marginTop: 10, textAlign: 'center' },
  action: { marginTop: 20 },
});
