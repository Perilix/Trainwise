import { Injectable, inject } from '@angular/core';
import { map, tap } from 'rxjs';

import type { ApiPlannedRun } from '../core/api-types';
import { ApiService } from '../core/api.service';
import { formatDayShort, formatDecimal, formatHoursMinutes, toIsoDay } from '../core/format';
import { SESSION_TYPE_LABELS } from '../domain/athlete.mappers';

/** Séance prévue proposée pour une activité importée (fenêtre de ± 3 jours côté API). */
export type MatchCandidate = { id: string; date: string; dayLabel: string; title: string; meta: string };

export type PendingMatch = {
  kind: 'run' | 'strength';
  id: string;
  date: string;
  dayLabel: string;
  activityLabel: string;
  planned: MatchCandidate;
};

type ReviewActivity = {
  id: string;
  date: string;
  distance?: number | null;
  duration?: number | null;
  sessionType?: string | null;
  pendingPlannedMatch?: (ApiPlannedRun & { _id: string }) | null;
};

const plannedTitle = (planned: ApiPlannedRun) =>
  planned.title || SESSION_TYPE_LABELS[planned.sessionType] || (planned.activityType === 'strength' ? 'Renforcement' : 'Course');

const plannedMeta = (planned: ApiPlannedRun) =>
  [
    planned.targetDistance ? `${formatDecimal(planned.targetDistance, 1)} km` : null,
    planned.targetDuration ? formatHoursMinutes(planned.targetDuration * 60) : null,
    planned.targetPace ? `${planned.targetPace} /km` : null,
  ]
    .filter(Boolean)
    .join(' · ');

function toCandidate(planned: ApiPlannedRun & { _id: string }): MatchCandidate {
  const date = toIsoDay(new Date(planned.date));
  return { id: planned._id, date, dayLabel: formatDayShort(date), title: plannedTitle(planned), meta: plannedMeta(planned) };
}

function activityLabel(activity: ReviewActivity, kind: 'run' | 'strength') {
  if (kind === 'strength') {
    return [SESSION_TYPE_LABELS[activity.sessionType ?? ''] ?? 'Renforcement', activity.duration ? formatHoursMinutes(activity.duration * 60) : null]
      .filter(Boolean)
      .join(' · ');
  }
  return (
    [activity.distance ? `${formatDecimal(activity.distance, 1)} km` : null, activity.duration ? formatHoursMinutes(activity.duration * 60) : null]
      .filter(Boolean)
      .join(' · ') || 'Sortie importée'
  );
}

/**
 * Rapprochement d'une activité importée de Strava avec la séance qui était prévue.
 * Confirmer fige la séance prévue dans l'activité et la retire du planning : c'est
 * ce qui évite d'avoir le même entraînement en double, une fois « à faire » et une
 * fois « fait ».
 */
@Injectable({ providedIn: 'root' })
export class MatchService {
  private readonly api = inject(ApiService);

  /** Activités importées, pas encore relues, qui tombent le jour d'une séance prévue. */
  pending$() {
    return this.api.getOr<{ runs: ReviewActivity[]; strength: ReviewActivity[] }>('/api/strava/pending-review', { runs: [], strength: [] }).pipe(
      map((review) =>
        (['run', 'strength'] as const)
          .flatMap((kind) => (kind === 'run' ? review.runs : review.strength).map((activity) => ({ kind, activity })))
          .flatMap<PendingMatch>(({ kind, activity }) => {
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
          }),
      ),
    );
  }

  /** Séances prévues auxquelles cette sortie peut être rattachée. */
  candidates$(runId: string) {
    return this.api
      .get<(ApiPlannedRun & { _id: string })[]>(`/api/runs/${encodeURIComponent(runId)}/match/candidates`)
      .pipe(map((candidates) => candidates.map(toCandidate)));
  }

  confirm(item: PendingMatch) {
    return this.api.post(`${this.base(item)}/match/confirm`).pipe(this.refresh());
  }

  dismiss(item: PendingMatch) {
    return this.api.post(`${this.base(item)}/match/dismiss`).pipe(this.refresh());
  }

  /** Rattachement manuel à une autre séance que celle proposée. */
  link(runId: string, plannedId: string) {
    return this.api.post(`/api/runs/${encodeURIComponent(runId)}/match/link/${encodeURIComponent(plannedId)}`).pipe(this.refresh());
  }

  /** Marque les activités comme relues : la fenêtre ne se rouvrira pas pour elles. */
  clear(runIds: string[], strengthIds: string[]) {
    return this.api.post('/api/strava/pending-review/clear', { runIds, strengthIds });
  }

  private base(item: PendingMatch) {
    return item.kind === 'run' ? `/api/runs/${encodeURIComponent(item.id)}` : `/api/strength/sessions/${encodeURIComponent(item.id)}`;
  }

  private refresh<T>() {
    return (source: import('rxjs').Observable<T>) => source.pipe(tap(() => this.api.invalidate()));
  }
}
