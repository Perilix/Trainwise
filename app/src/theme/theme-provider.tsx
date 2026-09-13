import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { intensityRamp, palettes, type ColorScheme, type Palette } from './tokens';

export type ThemePreference = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  scheme: ColorScheme;
  colors: Palette;
  ramp: readonly string[];
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = 'trainwise.theme-preference';

const ThemeContext = createContext<ThemeContextValue | null>(null);

type Props = {
  children: ReactNode;
  // Impose un thème à un sous-arbre (aperçus, écran système), sans toucher à la préférence enregistrée.
  forcedScheme?: ColorScheme;
};

export function AppThemeProvider({ children, forcedScheme }: Props) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') setPreferenceState(stored);
      })
      .catch(() => {});
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const resolved: ColorScheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const scheme = forcedScheme ?? resolved;

  return (
    <ThemeContext.Provider value={{ scheme, colors: palettes[scheme], ramp: intensityRamp[scheme], preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme doit être utilisé à l’intérieur de AppThemeProvider');
  return context;
}
