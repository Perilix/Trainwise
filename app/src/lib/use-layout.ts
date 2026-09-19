import { useWindowDimensions } from 'react-native';

import { layout } from '@/theme/tokens';

/**
 * Vrai à partir de la largeur où la barre latérale remplace la barre d'onglets
 * (cf. docs/design-system.md § 7). Suit les redimensionnements de la fenêtre.
 */
export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return width >= layout.desktopBreakpoint;
}
