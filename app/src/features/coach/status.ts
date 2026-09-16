import type { Palette } from '@/theme/tokens';

import type { AthleteStatus } from './types';

// Statut de forme calculé par l'API : vert, orange ou rouge.
export const ATHLETE_STATUS_STYLE: Record<AthleteStatus, { label: string; color: keyof Palette }> = {
  green: { label: 'En forme', color: 'success' },
  orange: { label: 'Vigilance', color: 'warning' },
  red: { label: 'Alerte', color: 'danger' },
};
