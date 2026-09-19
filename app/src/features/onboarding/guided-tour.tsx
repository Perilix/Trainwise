import { useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TAB_BAR_HEIGHT, TAB_BAR_MARGIN, Text } from '@/components/ui';
import { useTheme } from '@/theme/theme-provider';
import { layout, radius } from '@/theme/tokens';

/** Zone mise en avant : un onglet, un bouton de l'en-tête, ou rien (carte centrée). */
export type TourSpot = { kind: 'tab'; index: number; count: number } | { kind: 'appBar'; side: 'left' | 'right' } | { kind: 'none' };

export type TourStep = { title: string; text: string; spot: TourSpot };

/** Ce à quoi sert chaque partie de l'app, une fois la mise en route faite. */
export const TOUR_STEPS: TourStep[] = [
  { spot: { kind: 'appBar', side: 'left' }, title: 'Ton profil', text: 'Tes initiales en haut à gauche ouvrent ton profil : niveau, VMA, compétitions et connecteurs.' },
  { spot: { kind: 'appBar', side: 'right' }, title: 'Tes notifications', text: 'Les séances que ton coach planifie, tes rappels du jour et tes records arrivent ici.' },
  { spot: { kind: 'tab', index: 0, count: 4 }, title: 'Ton accueil', text: 'La séance du jour, ta semaine en un coup d’œil et tes derniers entraînements.' },
  { spot: { kind: 'tab', index: 1, count: 4 }, title: 'Ton coach', text: 'Vos échanges. Il peut t’envoyer une séance dans la conversation, avec son déroulé.' },
  { spot: { kind: 'tab', index: 2, count: 4 }, title: 'Ton planning', text: 'Le calendrier de tes séances. Touche un jour pour voir ce qui est prévu, ou ce que tu as fait.' },
  { spot: { kind: 'tab', index: 3, count: 4 }, title: 'Tes sorties', text: 'Tout ton historique : volumes par période, et le détail de chaque sortie avec son tracé.' },
];

type Props = {
  steps: TourStep[];
  onDone: () => void;
};

const APP_BAR_HEIGHT = 64;
const BUTTON = 44;
const PADDING = 8;

/**
 * Visite guidée : un halo sur l'élément dont on parle, une carte qui l'explique.
 * Les repères sont calculés, pas mesurés : la barre d'onglets et l'en-tête sont
 * les nôtres et leur géométrie est fixée par les jetons.
 */
export function GuidedTour({ steps, onDone }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const step = steps[index];
  if (!step) return null;

  const last = index === steps.length - 1;
  const barBottom = Math.max(insets.bottom, 16);

  // Rectangle mis en avant, en coordonnées écran. La barre d'onglets et l'en-tête
  // sont les nôtres : leur géométrie vient des jetons, rien n'est mesuré.
  const spot = (() => {
    if (step.spot.kind === 'tab') {
      const itemWidth = (width - (TAB_BAR_MARGIN + 7) * 2) / step.spot.count;
      return {
        top: height - barBottom - TAB_BAR_HEIGHT + 7 - PADDING,
        left: TAB_BAR_MARGIN + 7 + itemWidth * step.spot.index - PADDING,
        width: itemWidth + PADDING * 2,
        height: TAB_BAR_HEIGHT - 14 + PADDING * 2,
      };
    }
    if (step.spot.kind === 'appBar') {
      return {
        top: insets.top + (APP_BAR_HEIGHT - BUTTON) / 2 - PADDING,
        left: step.spot.side === 'left' ? layout.gutter - PADDING : width - layout.gutter - BUTTON - PADDING,
        width: BUTTON + PADDING * 2,
        height: BUTTON + PADDING * 2,
      };
    }
    return null;
  })();

  // La carte se place du côté opposé au halo, pour ne jamais le masquer.
  const cardPosition = step.spot.kind === 'tab' ? { bottom: barBottom + TAB_BAR_HEIGHT + 24 } : { top: insets.top + APP_BAR_HEIGHT + 24 };
  const veil = { backgroundColor: 'rgba(5, 25, 35, 0.66)' };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDone}>
      <View style={styles.backdrop}>
        {/* Le voile s'arrête au bord du rectangle : l'élément dont on parle reste net. */}
        {spot ? (
          <>
            <View pointerEvents="none" style={[styles.veil, veil, { top: 0, left: 0, right: 0, height: spot.top }]} />
            <View pointerEvents="none" style={[styles.veil, veil, { top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }]} />
            <View pointerEvents="none" style={[styles.veil, veil, { top: spot.top, left: 0, width: spot.left, height: spot.height }]} />
            <View pointerEvents="none" style={[styles.veil, veil, { top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height }]} />
            <View pointerEvents="none" style={[styles.ring, { top: spot.top, left: spot.left, width: spot.width, height: spot.height, borderColor: colors.accent }]} />
          </>
        ) : (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, veil]} />
        )}

        <View style={[styles.card, cardPosition, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="overline" style={{ color: colors.accentInk }}>
            {index + 1} / {steps.length}
          </Text>
          <Text variant="h2" style={styles.title}>
            {step.title}
          </Text>
          <Text variant="body2">{step.text}</Text>

          <View style={styles.actions}>
            {last ? null : <Button label="Passer" variant="secondary" size="sm" onPress={onDone} style={styles.flex} />}
            <Button
              label={last ? 'Compris' : 'Suivant'}
              icon={last ? 'check' : 'arrowRight'}
              iconPosition={last ? 'leading' : 'trailing'}
              onPress={() => (last ? onDone() : setIndex((value) => value + 1))}
              style={styles.flex}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1 },
  veil: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 2, borderRadius: radius.pill },
  card: { position: 'absolute', left: layout.gutter, right: layout.gutter, gap: 6, padding: 20, borderRadius: radius.xl, borderWidth: 1 },
  title: { marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
});
