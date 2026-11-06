import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, IconButton } from '@/components/ui';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

type Props = {
  /** Ce qu'on supprime, pour le lecteur d'écran (« le bloc », « l'étape »). */
  subject: string;
  onDelete: () => void;
  onValidate: () => void;
  /** Absents : l'élément ne se déplace pas (pas de chevrons). */
  onUp?: () => void;
  onDown?: () => void;
  canUp?: boolean;
  canDown?: boolean;
};

/**
 * Barre d'une étape ouverte, alignée à droite : monter / descendre, supprimer, puis
 * valider tout au bout. Des icônes plutôt que des libellés, qui débordaient du bloc.
 */
export function StepActions({ subject, onDelete, onValidate, onUp, onDown, canUp = true, canDown = true }: Props) {
  const { colors } = useTheme();
  const movable = Boolean(onUp || onDown);

  return (
    <View style={styles.row}>
      {movable ? (
        <View style={styles.moves}>
          <IconButton
            icon="chevronUp"
            bordered
            size={40}
            color={canUp ? colors.ink : colors.text3}
            accessibilityLabel={`Monter ${subject}`}
            onPress={canUp ? onUp : undefined}
          />
          <IconButton
            icon="chevronDown"
            bordered
            size={40}
            color={canDown ? colors.ink : colors.text3}
            accessibilityLabel={`Descendre ${subject}`}
            onPress={canDown ? onDown : undefined}
          />
        </View>
      ) : null}
      <IconButton icon="trash" bordered size={40} color={colors.danger} accessibilityLabel={`Supprimer ${subject}`} onPress={onDelete} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Valider ${subject}`}
        onPress={onValidate}
        hitSlop={2}
        style={({ pressed }) => [styles.validate, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
        <Icon name="check" size={20} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingTop: 4 },
  // Un peu plus d'air entre les flèches et la poubelle : on ne supprime pas en voulant déplacer.
  moves: { flexDirection: 'row', gap: 8, marginRight: 8 },
  validate: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.94 }] },
});
