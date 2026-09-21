import type { Activity } from './types';

/** Où mène une activité réalisée : sa fiche, course ou renforcement. */
export const activityHref = (activity: Activity) =>
  activity.sport === 'running'
    ? { pathname: '/sortie/[id]' as const, params: { id: activity.id } }
    : { pathname: '/muscu/fiche/[id]' as const, params: { id: activity.id } };
