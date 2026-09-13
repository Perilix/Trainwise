import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { layout } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

// Bloc d'écran : marge latérale de 20 px et 24 px entre sections.
export function Section({ children, style }: Props) {
  return <View style={[{ paddingHorizontal: layout.gutter, paddingBottom: 24 }, style]}>{children}</View>;
}
