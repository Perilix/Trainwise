import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, tap } from 'rxjs';

import type {
  ApiCalendarData,
  ApiCoachAthlete,
  ApiCoachGroup,
  ApiCoachAthleteDetail,
  ApiCoachStats,
  ApiCompetition,
  ApiExercise,
  ApiPendingInvitation,
  ApiPlannedRunDetail,
  ApiRun,
  ApiSessionTemplate,
  ApiStrengthSessionDetail,
  ApiSubscriptionRequest,
  ApiUserSearchResult,
  GroupColor,
} from '../core/api-types';
import { ApiService } from '../core/api.service';
import { mapRunDetail } from '../domain/athlete.mappers';
import { buildAthleteFiche, buildCoachHome, buildInviteOverview, mapAthleteList, mapGroups, mapSearchResults } from '../domain/coach.mappers';
import type { ApiAthleteForm, ApiFormSummary } from '../domain/form';
import { mapPlannedDetail } from '../domain/session-detail';

@Injectable({ providedIn: 'root' })
export class CoachService {
  private readonly api = inject(ApiService);

  // ---------- Lectures ----------

  home$() {
    return forkJoin({
      stats: this.api.cachedGet<ApiCoachStats>('/api/coach/stats'),
      athletes: this.api.cachedGet<ApiCoachAthlete[]>('/api/coach/athletes'),
      requests: this.api.getOr<ApiSubscriptionRequest[]>('/api/coach/subscription-requests', []),
    }).pipe(map(({ stats, athletes, requests }) => buildCoachHome(stats, athletes, requests)));
  }

  // ---------- Groupes ----------

  groups$() {
    return this.api.cachedGet<ApiCoachGroup[]>('/api/coach/groups').pipe(map((groups) => mapGroups(groups, new Date())));
  }

  createGroup(body: { name: string; color?: GroupColor; athletes: string[]; raceName?: string; raceDate?: string }) {
    return this.api.post<ApiCoachGroup>('/api/coach/groups', body).pipe(this.refresh());
  }

  updateGroup(id: string, body: { name?: string; color?: GroupColor; athletes?: string[]; raceName?: string | null; raceDate?: string | null }) {
    return this.api.patch<ApiCoachGroup>(`/api/coach/groups/${encodeURIComponent(id)}`, body).pipe(this.refresh());
  }

  /** La discussion du groupe : une conversation à plusieurs, pas N messages. */
  openGroupConversation(id: string) {
    return this.api
      .post<{ conversationId: string; name: string; participants: number }>(`/api/coach/groups/${encodeURIComponent(id)}/conversation`, {})
      .pipe(this.refresh());
  }

  deleteGroup(id: string) {
    return this.api.delete(`/api/coach/groups/${encodeURIComponent(id)}`).pipe(this.refresh());
  }

  /** Planifié / réalisé semaine par semaine, pour l'écran Stats. */
  weeklyStats$(weeks = 8) {
    return this.api.cachedGet<{
      weeks: { start: string; label: string; planned: number; done: number }[];
      totals: { planned: number; done: number };
      completionRate: number | null;
    }>(`/api/coach/stats/weekly?weeks=${weeks}`);
  }

  /** La forme de chaque athlète (charge 7 j / 28 j), pour trier la liste de l'écran Stats. */
  formSummaries$() {
    return this.api.getOr<ApiFormSummary[]>('/api/coach/form', []);
  }

  /** Tout l'écran Stats d'un athlète : forme, charge, FC, ressenti, muscu, repères. */
  athleteForm$(athleteId: string, weeks = 8) {
    return this.api.get<ApiAthleteForm>(`/api/coach/athletes/${encodeURIComponent(athleteId)}/form`, { weeks });
  }

  athletes$() {
    return this.api.cachedGet<ApiCoachAthlete[]>('/api/coach/athletes').pipe(map(mapAthleteList));
  }

  invitations$() {
    return forkJoin({
      code: this.api.getOr<{ code: string | null }>('/api/coach/invite/code', { code: null }).pipe(map((res) => res.code)),
      pending: this.api.getOr<ApiPendingInvitation[]>('/api/coach/invitations/pending', []),
    }).pipe(map(({ code, pending }) => buildInviteOverview(code, pending)));
  }

  athlete$(athleteId: string) {
    return forkJoin({
      detail: this.api.get<ApiCoachAthleteDetail>(`/api/coach/athletes/${encodeURIComponent(athleteId)}`),
      competitions: this.api.getOr<ApiCompetition[]>(`/api/coach/athletes/${encodeURIComponent(athleteId)}/competitions`, []),
    }).pipe(map(({ detail, competitions }) => buildAthleteFiche(detail, competitions, new Date())));
  }

  athleteCalendar$(athleteId: string, startDate: string, endDate: string) {
    return this.api.get<ApiCalendarData>(`/api/coach/athletes/${encodeURIComponent(athleteId)}/calendar`, { startDate, endDate });
  }

  athletePlanning$(athleteId: string) {
    return this.api.get<ApiPlannedRunDetail[]>(`/api/coach/athletes/${encodeURIComponent(athleteId)}/planning`);
  }

  athleteSession$(athleteId: string, planId: string, vma?: number) {
    return this.api
      .get<ApiPlannedRunDetail>(`/api/coach/athletes/${encodeURIComponent(athleteId)}/planning/${encodeURIComponent(planId)}`)
      .pipe(map((raw) => mapPlannedDetail(raw, vma, 'vous')));
  }

  /** Sortie d'un athlète : la vue de détail, plus ce que le coach avait prévu. */
  athleteRun$(athleteId: string, runId: string, vma?: number) {
    return this.api
      .get<ApiRun>(`/api/coach/athletes/${encodeURIComponent(athleteId)}/runs/${encodeURIComponent(runId)}`)
      .pipe(map((run) => ({ detail: mapRunDetail(run, undefined, vma), snapshot: run.plannedSnapshot ?? null })));
  }

  /** Séance muscu réalisée, par son propre identifiant (une activité de la fiche athlète). */
  athleteStrengthSession$(athleteId: string, sessionId: string) {
    return this.api.get<ApiStrengthSessionDetail>(
      `/api/coach/athletes/${encodeURIComponent(athleteId)}/strength-session-by-id/${encodeURIComponent(sessionId)}`,
    );
  }

  /** Séance muscu rattachée à une séance planifiée. */
  athleteStrengthByPlanned$(athleteId: string, plannedId: string) {
    return this.api.get<ApiStrengthSessionDetail>(
      `/api/coach/athletes/${encodeURIComponent(athleteId)}/strength-session/${encodeURIComponent(plannedId)}`,
    );
  }

  templates$() {
    return this.api.cachedGet<ApiSessionTemplate[]>('/api/coach/session-templates');
  }

  template$(id: string) {
    return this.api.get<ApiSessionTemplate>(`/api/coach/session-templates/${encodeURIComponent(id)}`);
  }

  exercises$(query?: { search?: string; muscleGroup?: string }) {
    return this.api.get<ApiExercise[] | { exercises: ApiExercise[] }>('/api/exercises', query).pipe(
      map((response) => (Array.isArray(response) ? response : (response.exercises ?? []))),
    );
  }

  searchUsers$(term: string) {
    return this.api.getOr<ApiUserSearchResult[]>('/api/coach/users/search', [], { q: term }).pipe(map(mapSearchResults));
  }

  // ---------- Écritures ----------

  respondToRequest(id: string, accept: boolean) {
    return this.api
      .post(`/api/coach/subscription-requests/${encodeURIComponent(id)}/respond`, { accept })
      .pipe(this.refresh());
  }

  generateInviteCode() {
    return this.api.post<{ code: string }>('/api/coach/invite/code').pipe(this.refresh());
  }

  /** Disponibilité d'un code pendant la frappe. L'API renvoie le code normalisé. */
  checkInviteCode$(code: string) {
    return this.api.get<{ code: string; available: boolean; error?: string }>('/api/coach/invite/code/check', { code });
  }

  /** Le coach choisit son code : l'ancien cesse alors de fonctionner. */
  setInviteCode(code: string) {
    return this.api.put<{ code: string }>('/api/coach/invite/code', { code }).pipe(this.refresh());
  }

  inviteByEmail(email: string) {
    return this.api.post('/api/coach/invite/direct', { email }).pipe(this.refresh());
  }

  removeAthlete(athleteId: string) {
    return this.api.delete(`/api/coach/athletes/${encodeURIComponent(athleteId)}`).pipe(this.refresh());
  }

  updateAthleteVma(athleteId: string, vma: number) {
    return this.api.patch(`/api/coach/athletes/${encodeURIComponent(athleteId)}/vma`, { vma }).pipe(this.refresh());
  }

  createSession(athleteId: string, body: unknown) {
    return this.api.post(`/api/coach/athletes/${encodeURIComponent(athleteId)}/planning`, body).pipe(this.refresh());
  }

  updateSession(athleteId: string, planId: string, body: unknown) {
    return this.api
      .patch(`/api/coach/athletes/${encodeURIComponent(athleteId)}/planning/${encodeURIComponent(planId)}`, body)
      .pipe(this.refresh());
  }

  deleteSession(athleteId: string, planId: string) {
    return this.api
      .delete(`/api/coach/athletes/${encodeURIComponent(athleteId)}/planning/${encodeURIComponent(planId)}`)
      .pipe(this.refresh());
  }

  duplicateSession(athleteId: string, planId: string, targetDate: string) {
    return this.api
      .post(`/api/coach/athletes/${encodeURIComponent(athleteId)}/planning/${encodeURIComponent(planId)}/duplicate`, { targetDate })
      .pipe(this.refresh());
  }

  saveTemplate(id: string | null, body: unknown) {
    const path = id ? `/api/coach/session-templates/${encodeURIComponent(id)}` : '/api/coach/session-templates';
    return (id ? this.api.patch(path, body) : this.api.post(path, body)).pipe(this.refresh());
  }

  deleteTemplate(id: string) {
    return this.api.delete(`/api/coach/session-templates/${encodeURIComponent(id)}`).pipe(this.refresh());
  }

  /**
   * Planifie une séance type pour plusieurs athlètes le même jour.
   *
   * L'API attend une assignation par athlète — c'est ce qui lui permet de
   * résoudre l'allure de chacun selon sa VMA. La date est posée à midi : à
   * minuit, le fuseau du serveur peut faire basculer la séance d'un jour.
   */
  /** Le retour du coach sur une séance réalisée. Un texte vide l'efface. */
  setSessionFeedback(athleteId: string, kind: 'run' | 'strength', sessionId: string, text: string) {
    return this.api
      .put<{ coachFeedback: { text: string | null; at: string | null } }>(
        `/api/coach/athletes/${encodeURIComponent(athleteId)}/feedback/${kind}/${encodeURIComponent(sessionId)}`,
        { text },
      )
      .pipe(this.refresh());
  }

  assignTemplate(templateId: string, body: { athleteIds: string[]; date: string }) {
    const date = `${body.date}T12:00:00.000Z`;
    return this.api
      .post(`/api/coach/session-templates/${encodeURIComponent(templateId)}/assign`, {
        assignments: body.athleteIds.map((athleteId) => ({ athleteId, date, paceOverrides: {} })),
      })
      .pipe(this.refresh());
  }

  private refresh<T>() {
    return (source: Observable<T>) => source.pipe(tap(() => this.api.invalidate()));
  }
}
