import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';

import { TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from './tab-bar';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  // Écran posé sous la barre d'onglets flottante : réserve la place qu'elle occupe.
  tabs?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  // Barre d'action fixée en bas (ex. « Enregistrer la séance »).
  footer?: ReactNode;
};

export function Screen({ children, scroll = true, tabs, edges = ['top'], contentStyle, footer }: Props) {
  const { colors } = useTheme();
  const bottom = tabs ? TAB_BAR_HEIGHT + TAB_BAR_MARGIN * 2 + 24 : 28;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={[{ paddingBottom: bottom }, contentStyle]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, paddingBottom: tabs ? bottom : 0 }, contentStyle]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}
