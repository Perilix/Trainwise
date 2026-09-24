import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

import { Icon } from './icon';
import { TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from './tab-bar';
import { Text } from './text';

type ToastKind = 'success' | 'error';
type Toast = { id: number; kind: ToastKind; message: string };
type ToastApi = { success: (message: string) => void; error: (message: string) => void };

const ToastContext = createContext<ToastApi>({ success: () => {}, error: () => {} });

/**
 * Petits messages de confirmation (« Séance planifiée le vendredi 2 octobre »),
 * posés au-dessus de la barre d'onglets. Ils disparaissent seuls ; un appui les ferme.
 * Même rôle que ToastService côté web.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);
  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = next.current++;
      setToasts((list) => [...list.slice(-1), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(() => ({ success: (m) => push('success', m), error: (m) => push('error', m) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  // Au-dessus de la barre d'onglets flottante, qu'elle soit là ou non.
  const bottom = insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_MARGIN + 12;
  return (
    <View pointerEvents="box-none" style={[styles.stack, { bottom }]}>
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </View>
  );
}

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { colors } = useTheme();
  // Une valeur animée créée une fois, gardée en état : le compilateur React refuse les refs lues au rendu.
  const [appear] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [appear]);

  return (
    <Animated.View style={{ opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      <Pressable accessibilityRole="alert" accessibilityLabel={toast.message} onPress={onDismiss} style={[styles.toast, { backgroundColor: colors.brand }]}>
        <View style={[styles.badge, { backgroundColor: toast.kind === 'error' ? colors.danger : colors.success }]}>
          <Icon name={toast.kind === 'error' ? 'warning' : 'check'} size={14} color="#FFFFFF" strokeWidth={2.5} />
        </View>
        <Text variant="h3" style={styles.message}>
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 8 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    maxWidth: 480,
    shadowColor: '#051923',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  message: { flexShrink: 1, color: '#FFFFFF', fontSize: 14 },
});
