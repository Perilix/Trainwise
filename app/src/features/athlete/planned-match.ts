// Rapprochement d'une sortie réalisée avec la séance qui était prévue.
// L'API propose le rapprochement à l'import Strava (`pendingPlannedMatch`) et accepte
// aussi un rattachement manuel ; confirmer fige la séance prévue dans la sortie.
import { api, invalidateApiCache } from '@/lib/api';
import { emitAppEvent } from '@/lib/app-events';
import type { ApiPlannedRun } from '@/lib/api-types';
import { formatDayShort, formatDecimal, formatHoursMinutes, toIsoDay } from '@/lib/format';

import { SESSION_TYPE_LABELS } from './mappers';

/** Séance prévue proposée pour une sortie (fenêtre de ± 3 jours côté API). */
export type MatchCandidate = { id: string; date: string; dayLabel: string; title: string; meta: string };

export type PendingReviewItem = {
  kind: 'run' | 'strength';
  id: string;
  date: string;
  dayLabel: string;
  activityLabel: string;
  planned: MatchCandidate;
};

type PendingReviewActivity = {
  id: string;
  date: string;
  distance?: number | null;
  duration?: number | null;
  sessionType?: string | null;
  pendingPlannedMatch?: (ApiPlannedRun & { _id: string }) | null;
};

const plannedLabel = (planned: ApiPlannedRun) =>
  planned.title || SESSION_TYPE_LABELS[planned.sessionType] || (planned.activityType === 'strength' ? 'Renforcement' : 'Course');

const plannedMeta = (planned: ApiPlannedRun) =>
  [
    planned.targetDistance ? `${formatDecimal(planned.targetDistance)} km` : null,
    planned.targetDuration ? formatHoursMinutes(planned.targetDuration * 60) : null,
    planned.targetPace ? `${planned.targetPace} /km` : null,
  ]
    .filter(Boolean)
    .join(' · ');

export function toCandidate(planned: ApiPlannedRun): MatchCandidate {
  const date = toIsoDay(new Date(planned.date));
  return { id: planned._id, date, dayLabel: formatDayShort(date), title: plannedLabel(planned), meta: plannedMeta(planned) };
}

/** Séances prévues auxquelles cette sortie peut être rattachée. */
export const runMatchCandidates = async (runId: string): Promise<MatchCandidate[]> => {
  const candidates = await api<ApiPlannedRun[]>(`/api/runs/${encodeURIComponent(runId)}/match/candidates`);
  return candidates.map(toCandidate);
};

const afterMatch = () => {
  invalidateApiCache();
  emitAppEvent('sessions:changed');
};

/** Rattache la sortie à une séance prévue : la séance prévue disparaît du planning. */
export const linkRunToPlanned = async (runId: string, plannedId: string) => {
  await api(`/api/runs/${encodeURIComponent(runId)}/match/link/${encodeURIComponent(plannedId)}`, { method: 'POST' });
  afterMatch();
};

/** Confirme la séance proposée par l'API à l'import. */
export const confirmRunMatch = async (runId: string) => {
  await api(`/api/runs/${encodeURIComponent(runId)}/match/confirm`, { method: 'POST' });
  afterMatch();
};

/** « Non, ce n'était pas cette séance » : la proposition ne revient plus. */
export const dismissRunMatch = async (runId: string) => {
  await api(`/api/runs/${encodeURIComponent(runId)}/match/dismiss`, { method: 'POST' });
  afterMatch();
};

export const confirmStrengthMatch = async (sessionId: string) => {
  await api(`/api/strength/sessions/${encodeURIComponent(sessionId)}/match/confirm`, { method: 'POST' });
  afterMatch();
};

export const dismissStrengthMatch = async (sessionId: string) => {
  await api(`/api/strength/sessions/${encodeURIComponent(sessionId)}/match/dismiss`, { method: 'POST' });
  afterMatch();
};

const activityLabel = (activity: PendingReviewActivity, kind: 'run' | 'strength') => {
  if (kind === 'strength') return [SESSION_TYPE_LABELS[activity.sessionType ?? ''] ?? 'Renforcement', activity.duration ? formatHoursMinutes(activity.duration * 60) : null].filter(Boolean).join(' · ');
  return [activity.distance ? `${formatDecimal(activity.distance)} km` : null, activity.duration ? formatHoursMinutes(activity.duration * 60) : null].filter(Boolean).join(' · ') || 'Sortie importée';
};

/**
 * Activités importées que l'athlète n'a pas encore relues, et qui tombent le jour
 * d'une séance prévue : l'app propose de les rapprocher à l'ouverture.
 */
export async function getPendingMatches(): Promise<PendingReviewItem[]> {
  const review = await api<{ runs: PendingReviewActivity[]; strength: PendingReviewActivity[] }>('/api/strava/pending-review');
  const items = (['run', 'strength'] as const).flatMap((kind) =>
    (kind === 'run' ? review.runs : review.strength).map((activity) => ({ kind, activity })),
  );

  return items.flatMap(({ kind, activity }) => {
    if (!activity.pendingPlannedMatch) return [];
    const date = toIsoDay(new Date(activity.date));
    return [
      {
        kind,
        id: activity.id,
        date,
        dayLabel: formatDayShort(date),
        activityLabel: activityLabel(activity, kind),
        planned: toCandidate(activity.pendingPlannedMatch),
      },
    ];
  });
}

/** Marque les activités comme relues : la fenêtre ne se rouvrira pas pour elles. */
export const clearPendingReview = async (runIds: string[], strengthIds: string[]) => {
  if (!runIds.length && !strengthIds.length) return;
  await api('/api/strava/pending-review/clear', { method: 'POST', body: { runIds, strengthIds } });
};
