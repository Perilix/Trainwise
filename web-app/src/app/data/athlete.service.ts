import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, tap } from 'rxjs';

import type {
  ApiCalendarData,
  ApiCoach,
  ApiCoachInvitation,
  ApiCompetition,
  ApiConversation,
  ApiNotification,
  ApiPlannedRunDetail,
  ApiRun,
  ApiRunBlock,
  ApiStrengthSession,
  ApiStrengthSessionDetail,
  ApiStravaStatus,
  ApiUser,
} from '../core/api-types';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { startOfWeek } from '../core/dates';
import { formatPace } from '../core/format';
import {
  SESSION_TYPE_LABELS,
  buildHome,
  buildPlanning,
  buildProfile,
  buildRunsOverview,
  buildWeekPlan,
  initialsOf,
  nextCompetition,
  mapNotification,
  mapRunDetail,
} from '../domain/athlete.mappers';
import { mapPlannedDetail } from '../domain/session-detail';
import type { CoachInvitation, NewPlannedSession, RunsPeriod } from '../domain/athlete.types';

/** Sortie saisie à la main depuis le web. */
export type DoneRunPayload = {
  date: string;
  distanceKm?: number;
  durationMin?: number;
  feeling?: number;
  notes?: string;
  sessionType?: string;
};

export type CompetitionPayload = {
  name: string;
  date: string;
  discipline: string;
  targetTime?: string | null;
  priority: 'A' | 'B' | 'C';
};

@Injectable({ providedIn: 'root' })
export class AthleteService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  // ---------- Lectures ----------

  private user(): ApiUser {
    const user = this.auth.user();
    if (!user) throw new Error('Session absente');
    return user;
  }

  private runs$() {
    return this.api.cachedGet<ApiRun[]>('/api/runs');
  }

  coach$() {
    return this.api.getOr<ApiCoach | null>('/api/athlete/coach', null);
  }

  private strava$() {
    return this.api.getOr<ApiStravaStatus | null>('/api/strava/status', null);
  }

  private calendar$(year: number, monthIndex: number) {
    return this.api.get<ApiCalendarData>('/api/planning/calendar', { month: monthIndex + 1, year });
  }

  private conversations$() {
    return this.api.getOr<ApiConversation[]>('/api/chat/conversations', []);
  }

  home$() {
    const user = this.user();
    const now = new Date();
    // La semaine en cours peut démarrer sur le mois précédent ; le mois suivant porte les prochaines séances.
    const months = new Map<string, Date>();
    for (const date of [startOfWeek(now), now, new Date(now.getFullYear(), now.getMonth() + 1, 1)]) {
      months.set(`${date.getFullYear()}-${date.getMonth()}`, date);
    }

    return forkJoin({
      calendars: forkJoin([...months.values()].map((date) => this.calendar$(date.getFullYear(), date.getMonth()))),
      runs: this.runs$(),
      strength: this.api
        .getOr<{ sessions: ApiStrengthSession[] }>('/api/strength/sessions', { sessions: [] }, { limit: 20 })
        .pipe(map((response) => response.sessions ?? [])),
      coach: this.coach$(),
      conversations: this.conversations$(),
      strava: this.strava$(),
    }).pipe(map((data) => buildHome({ user, ...data, now })));
  }

  planning$(year: number, monthIndex: number) {
    const user = this.user();
    return forkJoin({ calendar: this.calendar$(year, monthIndex), coach: this.coach$() }).pipe(
      map(({ calendar, coach }) => buildPlanning(calendar, new Date(), coach?.firstName, user.vma ?? undefined)),
    );
  }

  /** Les 7 jours de la semaine en cours (rail du chat). La semaine peut chevaucher deux mois. */
  weekPlan$(reference = new Date()) {
    const start = startOfWeek(reference);
    const months = new Map<string, Date>();
    for (let index = 0; index < 7; index += 1) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      months.set(`${day.getFullYear()}-${day.getMonth()}`, day);
    }
    return forkJoin([...months.values()].map((date) => this.planning$(date.getFullYear(), date.getMonth()))).pipe(
      map((planningMonths) => buildWeekPlan(planningMonths, start, new Date())),
    );
  }

  plannedSession$(id: string) {
    const user = this.user();
    return forkJoin({
      raw: this.api.get<ApiPlannedRunDetail>(`/api/planning/${encodeURIComponent(id)}`),
      coach: this.coach$(),
    }).pipe(map(({ raw, coach }) => mapPlannedDetail(raw, user.vma, coach?.firstName)));
  }

  runsOverview$(period: RunsPeriod, offset = 0) {
    return this.runs$().pipe(map((runs) => buildRunsOverview(runs, period, new Date(), offset)));
  }

  runDetail$(id: string) {
    const user = this.user();
    return forkJoin({
      run: this.api.get<ApiRun>(`/api/runs/${encodeURIComponent(id)}`),
      coach: this.coach$(),
    }).pipe(map(({ run, coach }) => mapRunDetail(run, coach?.firstName, user.vma)));
  }

  /** Séance de renforcement déjà réalisée : le détail des séries (GET /api/strength/sessions/:id). */
  strengthSession$(id: string) {
    return this.api.get<ApiStrengthSessionDetail>(`/api/strength/sessions/${encodeURIComponent(id)}`);
  }

  /**
   * Déroulé réalisé d'une sortie, prêt à éditer : les tours reconstruits par Strava
   * quand il y en a, sinon un seul bloc à la distance de la sortie.
   */
  runBlocksDraft$(id: string) {
    return this.api.get<ApiRun>(`/api/runs/${encodeURIComponent(id)}`).pipe(
      map((run) => ({
        title: run.plannedSnapshot?.title || run.stravaData?.name || SESSION_TYPE_LABELS[run.sessionType ?? ''] || 'Sortie',
        auto: Boolean(run.blocksAutoReconstructed),
        blocks: run.runBlocks?.length
          ? run.runBlocks
          : ([{ role: 'main', mode: 'distance', distance: run.distance ?? null, pace: run.averagePace ?? null, repetitions: 1, order: 0 }] as ApiRunBlock[]),
      })),
    );
  }

  /** Prochaine compétition (la plus proche à venir), pour le rappel du rail « semaine ». */
  nextCompetition$() {
    return this.api
      .getOr<ApiCompetition[] | { competitions: ApiCompetition[] }>('/api/competitions', [])
      .pipe(map((response) => nextCompetition(Array.isArray(response) ? response : (response.competitions ?? []), new Date())));
  }

  profile$() {
    const user = this.user();
    return forkJoin({
      competitions: this.api
        .getOr<ApiCompetition[] | { competitions: ApiCompetition[] }>('/api/competitions', [])
        .pipe(map((response) => (Array.isArray(response) ? response : (response.competitions ?? [])))),
      strava: this.strava$(),
      coach: this.coach$(),
    }).pipe(map(({ competitions, strava, coach }) => buildProfile(user, competitions, strava, coach, new Date())));
  }

  /** Cumul mensuel des kilomètres, année en cours et précédente : alimente la courbe du profil. */
  yearlyVolume$() {
    return this.runs$().pipe(
      map((runs) => {
        const year = new Date().getFullYear();
        const current = Array<number>(12).fill(0);
        const previous = Array<number>(12).fill(0);
        let runsThisYear = 0;
        let durationThisYear = 0;
        for (const run of runs) {
          const date = new Date(run.stravaData?.startDateLocal ?? run.date);
          const bucket = date.getFullYear() === year ? current : date.getFullYear() === year - 1 ? previous : null;
          if (!bucket) continue;
          bucket[date.getMonth()] += run.distance ?? 0;
          if (bucket === current) {
            runsThisYear += 1;
            durationThisYear += run.stravaData?.movingTime ?? (run.duration ?? 0) * 60;
          }
        }
        // La courbe se lit en cumul : c'est la progression de l'année, pas le volume d'un mois isolé.
        const cumulative = (values: number[]) => values.map((_, index) => values.slice(0, index + 1).reduce((sum, value) => sum + value, 0));
        return {
          year,
          current: cumulative(current),
          previous: cumulative(previous),
          totals: { runs: runsThisYear, distanceKm: current.reduce((sum, value) => sum + value, 0), durationSec: durationThisYear },
        };
      }),
    );
  }

  notifications$() {
    return this.api
      .get<{ notifications: ApiNotification[] }>('/api/notifications', { limit: 50 })
      .pipe(map(({ notifications }) => notifications.map((item) => mapNotification(item, new Date()))));
  }

  coachInvitations$(): Observable<CoachInvitation[]> {
    return this.api.getOr<ApiCoachInvitation[]>('/api/athlete/invitations', []).pipe(
      map((invitations) =>
        invitations.flatMap((invitation) =>
          invitation.coach
            ? [
                {
                  id: invitation._id,
                  coachName: `${invitation.coach.firstName} ${invitation.coach.lastName}`.trim(),
                  initials: initialsOf(invitation.coach.firstName, invitation.coach.lastName),
                  email: invitation.coach.email,
                },
              ]
            : [],
        ),
      ),
    );
  }

  // ---------- Écritures ----------

  setSessionStatus(id: string, status: 'planned' | 'completed' | 'skipped') {
    return this.api.patch(`/api/planning/${encodeURIComponent(id)}/status`, { status }).pipe(this.refresh());
  }

  createPlannedSession(payload: NewPlannedSession) {
    return this.api.post('/api/planning', { ...payload, status: 'planned' }).pipe(this.refresh());
  }

  deletePlannedSession(id: string) {
    return this.api.delete(`/api/planning/${encodeURIComponent(id)}`).pipe(this.refresh());
  }

  joinCoach(code: string) {
    return this.api.post(`/api/athlete/join/${encodeURIComponent(code.trim().toUpperCase())}`).pipe(this.refresh());
  }

  answerInvitation(id: string, accept: boolean) {
    return this.api
      .post(`/api/athlete/invitations/${encodeURIComponent(id)}/${accept ? 'accept' : 'reject'}`)
      .pipe(this.refresh());
  }

  leaveCoach() {
    return this.api.delete('/api/athlete/coach').pipe(this.refresh());
  }

  saveRunFeeling(id: string, feeling: number) {
    return this.api.patch(`/api/runs/${encodeURIComponent(id)}`, { feeling }).pipe(this.refresh());
  }

  saveRunNotes(id: string, notes: string) {
    return this.api.patch(`/api/runs/${encodeURIComponent(id)}`, { notes }).pipe(this.refresh());
  }

  /** Relance la détection du déroulé depuis les tours Strava d'une sortie. */
  rebuildRunBlocks(id: string) {
    return this.api.post(`/api/runs/${encodeURIComponent(id)}/blocks/rebuild`).pipe(this.refresh());
  }

  saveRunBlocks(id: string, runBlocks: ApiRunBlock[]) {
    return this.api.patch(`/api/runs/${encodeURIComponent(id)}`, { runBlocks }).pipe(this.refresh());
  }

  /** Sortie saisie à la main : l'API complète d'elle-même la séance prévue du même jour. */
  logRun(payload: DoneRunPayload) {
    const pace =
      payload.distanceKm && payload.durationMin ? formatPace((payload.durationMin * 60) / payload.distanceKm) : undefined;
    return this.api
      .post('/api/runs', {
        date: new Date(`${payload.date}T12:00:00`).toISOString(),
        distance: payload.distanceKm,
        duration: payload.durationMin,
        averagePace: pace,
        feeling: payload.feeling,
        notes: payload.notes || undefined,
        sessionType: payload.sessionType,
      })
      .pipe(this.refresh());
  }

  saveCompetition(id: string | null, payload: CompetitionPayload) {
    const path = id ? `/api/competitions/${encodeURIComponent(id)}` : '/api/competitions';
    return (id ? this.api.patch(path, payload) : this.api.post(path, payload)).pipe(this.refresh());
  }

  deleteCompetition(id: string) {
    return this.api.delete(`/api/competitions/${encodeURIComponent(id)}`).pipe(this.refresh());
  }

  /** État du lien Strava, seul, pour l'écran des connecteurs. */
  stravaStatus$() {
    return this.strava$().pipe(
      map((status) => ({
        connected: Boolean(status?.connected),
        since: status?.connectedAt ? new Date(status.connectedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined,
      })),
    );
  }

  /**
   * Rattrapage Strava : importe les activités récentes qui manquent encore.
   * Le webhook Strava reste la voie normale ; ceci couvre les événements ratés
   * (backend redémarré, abonnement suspendu, activité modifiée hors ligne).
   */
  syncStrava$(limit = 20) {
    return this.api.post<{ imported: unknown[]; importedStrength: unknown[] }>(`/api/strava/sync?limit=${limit}`).pipe(this.refresh());
  }

  stravaAuthUrl$(returnTo: string) {
    return this.api.get<{ authUrl: string }>('/api/strava/auth-url', { returnTo });
  }

  disconnectStrava() {
    return this.api.delete('/api/strava/disconnect').pipe(this.refresh());
  }

  markNotificationRead(id: string) {
    return this.api.patch(`/api/notifications/${encodeURIComponent(id)}/read`);
  }

  markAllNotificationsRead() {
    return this.api.patch('/api/notifications/read-all');
  }

  /** Après une écriture, le cache de lecture n'est plus à jour : on le vide. */
  private refresh<T>() {
    return (source: Observable<T>) => source.pipe(tap(() => this.api.invalidate()));
  }
}
