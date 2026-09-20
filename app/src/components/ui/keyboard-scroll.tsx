import { createContext, useContext, useRef, type RefObject } from 'react';
import { findNodeHandle, type ScrollView, type TextInput } from 'react-native';

/**
 * La zone de défilement de l'écran courant.
 *
 * Décaler le contenu sous le clavier ne suffit pas : rien ne remonte jusqu'au
 * champ que l'on vient de toucher. Les champs s'annoncent donc à leur écran,
 * qui les amène au-dessus du clavier.
 */
const ScrollContext = createContext<RefObject<ScrollView | null> | null>(null);

export const KeyboardScrollProvider = ScrollContext.Provider;

/** Marge laissée entre le champ et le haut du clavier. */
const BREATHING_ROOM = 24;

/** À brancher sur un champ de saisie : `onFocus={() => bringIntoView(ref.current)}`. */
export function useBringIntoView() {
  const scroll = useContext(ScrollContext);

  return (input: TextInput | null) => {
    if (!scroll?.current || !input) return;
    const node = findNodeHandle(input);
    if (node === null) return;
    // API de la zone de défilement : elle connaît la position du clavier.
    const responder = scroll.current as unknown as {
      scrollResponderScrollNativeHandleToKeyboard?: (node: number, offset: number, preventNegative: boolean) => void;
    };
    responder.scrollResponderScrollNativeHandleToKeyboard?.(node, BREATHING_ROOM, true);
  };
}

/** Référence de zone de défilement, à poser sur la `ScrollView` d'un écran. */
export function useScrollRef() {
  return useRef<ScrollView | null>(null);
}
