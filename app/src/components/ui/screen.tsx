import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useIsDesktop } from '@/lib/use-layout';
import { useTheme } from '@/theme/theme-provider';
import { layout } from '@/theme/tokens';

import { GlassSurface } from './glass-surface';
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
  /** Écran à deux colonnes : la largeur maximale est alors plus généreuse. */
  wide?: boolean;
};

export function Screen({ children, scroll = true, tabs, edges = ['top'], contentStyle, footer, wide }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const desktop = useIsDesktop();
  // Sur grand écran, la barre d'onglets a laissé place à la barre latérale.
  const bottom = tabs && !desktop ? TAB_BAR_HEIGHT + TAB_BAR_MARGIN * 2 + 24 : 28;
  // Colonne centrée : le contenu ne s'étire pas sur toute la largeur de l'écran.
  // Sans barre d'en-tête sur grand écran, le contenu a besoin de respirer en haut.
  const column = desktop ? { width: '100%' as const, maxWidth: wide ? layout.contentWidth * 1.6 : layout.contentWidth, alignSelf: 'center' as const, paddingTop: 24 } : null;
  // La barre d'action descend jusqu'au bord : elle garde sous elle la place de la barre d'accueil.
  const footerInset = edges.includes('bottom') ? 0 : insets.bottom;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ paddingBottom: bottom }, column, contentStyle]}
          keyboardShouldPersistTaps="handled"
          // Le clavier ne doit pas masquer ce qu'on écrit : la page se décale
          // et amène le champ au-dessus de lui.
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, paddingBottom: tabs ? bottom : 0 }, column, contentStyle]}>{children}</View>
      )}
      {/* La barre d'action flotte : le contenu défile dessous, en transparence.
          Clavier ouvert, elle monte avec lui plutôt que de disparaître dessous. */}
      {footer ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <GlassSurface
            radius={0}
            sheen={false}
            interactive={false}
            style={{ paddingBottom: footerInset, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
            {footer}
          </GlassSurface>
        </KeyboardAvoidingView>
      ) : null}
    </SafeAreaView>
  );
}
