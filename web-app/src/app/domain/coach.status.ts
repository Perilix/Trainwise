import type { AthleteStatus } from './coach.types';

/** Suivi d'un athlète : vert = à jour, orange = vigilance, rouge = alerte (DA §2). */
export const ATHLETE_STATUS_STYLE: Record<AthleteStatus, { label: string; chip: string; color: string }> = {
  green: { label: 'À jour', chip: 'chip-done', color: 'var(--success)' },
  orange: { label: 'Vigilance', chip: 'chip-warn', color: 'var(--warn)' },
  red: { label: 'Alerte', chip: 'chip-danger', color: 'var(--danger)' },
};
