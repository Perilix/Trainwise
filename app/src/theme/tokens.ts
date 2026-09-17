// Jetons du système « Trainwise épuré », repris de la maquette (clair et sombre depuis les mêmes noms).

export type ColorScheme = 'light' | 'dark';

const light = {
  bg: '#F6F4F0',
  surface: '#FFFFFF',
  subtle: '#EFEBE4',
  border: '#E7E2D9',
  borderStrong: '#D3CCBF',
  ink: '#051923',
  text2: '#5A6878',
  text3: '#7D8793',
  // Action principale et sélection ; en sombre elle passe en clair.
  primary: '#003554',
  onPrimary: '#FFFFFF',
  // Surfaces de marque (carte du jour, sidebar) : restent navy dans les deux thèmes.
  brand: '#003554',
  onBrand: '#FFFFFF',
  highlight: '#7FD3FD',
  accent: '#00A6FB',
  // Texte posé sur un aplat `accent`.
  ctaInk: '#051923',
  accentInk: '#0077B6',
  accentSoft: '#E3F4FD',
  success: '#10B981',
  successInk: '#047857',
  successSoft: '#E3F4EC',
  warning: '#F59E0B',
  warningInk: '#B45309',
  warningSoft: '#FCF1DC',
  danger: '#DC2626',
  dangerSoft: '#FBE9E7',
  // Violet réservé à « planifié par le coach ».
  violet: '#8B5CF6',
  // Aplat violet portant du texte blanc (bouton du coach).
  violetBtn: '#7C3AED',
  violetInk: '#6D28D9',
  violetSoft: '#EFEAFD',
  violetLine: 'rgba(139, 92, 246, 0.22)',
  strava: '#FC4C02',
  stravaInk: '#C2410C',
  stravaSoft: '#FEEDE5',
  thumb: '#FFFFFF',
  barMuted: '#C6E9FB',
};

export type Palette = { [K in keyof typeof light]: string };

const dark: Palette = {
  bg: '#0A141C',
  surface: '#111D26',
  subtle: '#1A2731',
  border: '#22303B',
  borderStrong: '#33434F',
  ink: '#E9EFF3',
  text2: '#9EABB6',
  text3: '#74828E',
  primary: '#E3EBF0',
  onPrimary: '#062030',
  brand: '#0B3350',
  onBrand: '#FFFFFF',
  highlight: '#7FD3FD',
  accent: '#1AB0FF',
  ctaInk: '#04121C',
  accentInk: '#5CC8FF',
  accentSoft: '#0E2C3E',
  success: '#34D399',
  successInk: '#6EE7B7',
  successSoft: '#0F2B24',
  warning: '#FBBF24',
  warningInk: '#FCD34D',
  warningSoft: '#2F2610',
  danger: '#F87171',
  dangerSoft: '#351818',
  violet: '#A78BFA',
  violetBtn: '#6D4AE0',
  violetInk: '#C4B5FD',
  violetSoft: '#241E3A',
  violetLine: 'rgba(167, 139, 250, 0.28)',
  strava: '#FC4C02',
  stravaInk: '#FF8A57',
  stravaSoft: '#35190C',
  thumb: '#2A3945',
  barMuted: '#1B4460',
};

export const palettes: Record<ColorScheme, Palette> = { light, dark };

// Rampe d'intensité (profils de séance, zones) : du plus facile au plus intense.
export const intensityRamp: Record<ColorScheme, readonly string[]> = {
  light: ['#CDEBFB', '#8FD2F8', '#3DB4F5', '#0A8ED6', '#05608F'],
  dark: ['#173447', '#1D5577', '#1E80B8', '#2AAAF0', '#8AD8FF'],
};

export const radius = { sm: 10, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

// `contentWidth` : au-delà, une ligne de texte devient pénible à suivre.
export const layout = { gutter: 16, desktopBreakpoint: 1024, sidebarWidth: 248, contentWidth: 880 } as const;
