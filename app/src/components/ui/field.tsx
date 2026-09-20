import { useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

import { Icon, type IconName } from './icon';
import { useBringIntoView } from './keyboard-scroll';
import { Text } from './text';

type Props = TextInputProps & {
  label?: string;
  icon?: IconName;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

export function Field({ label, icon, trailing, containerStyle, style, onFocus, onBlur, ...input }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const bringIntoView = useBringIntoView();

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="caption" color="ink">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.box,
          { backgroundColor: colors.surface, borderColor: focused ? colors.accent : colors.borderStrong },
          focused && { boxShadow: `0 0 0 3px ${colors.accentSoft}` },
        ]}>
        {icon ? <Icon name={icon} size={18} color={colors.text3} /> : null}
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          placeholderTextColor={colors.text3}
          {...input}
          onFocus={(event) => {
            setFocused(true);
            // Le clavier arrive : on remonte le champ au-dessus de lui.
            bringIntoView(inputRef.current);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, { color: colors.ink }, webNoOutline, style]}
        />
        {trailing}
      </View>
    </View>
  );
}

// Le contour de focus est dessiné par la boîte : on retire celui du navigateur.
const webNoOutline = Platform.select<TextStyle>({ web: { outlineStyle: 'none' } as unknown as TextStyle, default: {} });

const styles = StyleSheet.create({
  container: { gap: 6 },
  box: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  // minWidth 0 : sur le web, un champ a une largeur intrinsèque qui repousserait l'unité hors de la boîte.
  input: { flex: 1, minWidth: 0, height: '100%', fontFamily: fontFamily.regular, fontSize: 14 },
});
