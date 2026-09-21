import type { Activity } from './types';

/**
 * Où mène une activité réalisée.
 *
 * Une course ouvre sa fiche ; une séance de renforcement ouvre sa saisie, seul
 * écran qui en montre les exercices — et qui sert aussi à les relire.
 */
export const activityHref = (activity: Activity) =>
  activity.sport === 'running'
    ? { pathname: '/sortie/[id]' as const, params: { id: activity.id } }
    : { pathname: '/muscu/[id]' as const, params: { id: activity.id, done: activity.id } };
