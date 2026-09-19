import type { SessionStatus } from './athlete.types';

// Pastille de statut d'une séance planifiée (planning, détail de séance).
export const SESSION_STATUS_CHIP = {
  planned: { label: 'À faire', tone: 'neutral', icon: 'clock' },
  done: { label: 'Effectuée', tone: 'success', icon: 'check' },
  skipped: { label: 'Passée', tone: 'warning', icon: 'ban' },
} as const satisfies Record<SessionStatus, { label: string; tone: string; icon: string }>;
