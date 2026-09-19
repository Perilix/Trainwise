// Accès aux données de la partie athlète. En mode démo, les données d'exemple remplacent l'API.
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { useSession } from '@/features/auth/session';
import { api, cachedGet, invalidateApiCache } from '@/lib/api';
import type {
  ApiCalendarData,
  ApiCoach,
  ApiCoachInvitation,
  ApiCompetition,
  ApiNotification,
  ApiPlannedRunDetail,
  ApiRun,
  ApiRunBlock,
  ApiUser,
  ApiStrengthSession,
  ApiStravaStatus,
} from '@/lib/api-types';
import { emitAppEvent } from '@/lib/app-events';
import { startOfWeek } from '@/lib/dates';
import { formatPace } from '@/lib/format';
import { useSessionQuery } from '@/features/auth/use-session-query';
import { getConversations } from '@/features/chat/conversations';

import { buildHome, buildPlanning, buildProfile, buildRunsOverview, initialsOf, mapNotification, mapRunDetail, SESSION_TYPE_LABELS } from './mappers';
import { mapPlannedDetail } from './session-detail';
import type { StrengthSessionPayload } from './strength-log';
import { samplePlannedDetails, sampleHome, sampleNotifications, samplePlanning, sampleProfile, sampleRuns, sampleRunsOverview } from './sample-data';
import type { CoachInvitation, NewPlannedSession, RunsPeriod } from './types';

export const useAthleteQuery = useSessionQuery;

const getRuns = () => cachedGet<ApiRun[]>('/api/runs');
export const getCoach = () => cachedGet<ApiCoach | null>('/api/athlete/coach').catch(() => null);
const getStravaStatus = () => cachedGet<ApiStravaStatus>('/api/strava/status').catch(() => null);
const getCalendar = (year: number, monthIndex: number) => api<ApiCalendarData>('/api/planning/calendar', { query: { month: monthIndex + 1, year } });

export function useAthleteHome() {
  return useAthleteQuery(
    'home',
    async (user) => {
      const now = new Date();
      // Semaine en cours (qui peut commencer le mois précédent) et mois suivant pour les prochaines séances.
      const months = new Map<string, Date>();
      [startOfWeek(now), now, new Date(now.getFullYear(), now.getMonth() + 1, 1)].forEach((date) => months.set(`${date.getFullYear()}-${date.getMonth()}`, date));
      const [calendars, runs, strength, coach, conversations, strava] = await Promise.all([
        Promise.all([...months.values()].map((date) => getCalendar(date.getFullYear(), date.getMonth()))),
        getRuns(),
        api<{ sessions: ApiStrengthSession[] }>('/api/strength/sessions', { query: { limit: 20 } })
          .then((response) => response.sessions)
          .catch((): ApiStrengthSession[] => []),
        getCoach(),
        getConversations(),
        getStravaStatus(),
      ]);
      return buildHome({ user, calendars, runs, strength, coach, conversations, strava, now });
    },
    () => sampleHome,
  );
}

export function usePlanningMonth(year: number, monthIndex: number) {
  return useAthleteQuery(
    `planning:${year}-${monthIndex}`,
    async (user) => {
      const [calendar, coach] = await Promise.all([getCalendar(year, monthIndex), getCoach()]);
      return buildPlanning(calendar, new Date(), coach?.firstName, user.vma ?? undefined);
    },
    () => ({ ...samplePlanning, year, monthIndex }),
  );
}

export function usePlannedSession(id: string) {
  return useAthleteQuery(
    `planned:${id}`,
    async (user) => {
      const [raw, coach] = await Promise.all([api<ApiPlannedRunDetail>(`/api/planning/${encodeURIComponent(id)}`), getCoach()]);
      return mapPlannedDetail(raw, user.vma, coach?.firstName);
    },
    () => mapPlannedDetail(samplePlannedDetails[id] ?? samplePlannedDetails['plan-2026-09-13'], 16.5, 'Camille'),
  );
}

export function useRunsOverview(period: RunsPeriod, offset = 0) {
  return useAthleteQuery(`runs:${period}:${offset}`, async () => buildRunsOverview(await getRuns(), period, new Date(), offset), () => sampleRunsOverview);
}

export function useRunDetail(id: string) {
  return useAthleteQuery(
    `run:${id}`,
    async (user) => {
      const [run, coach] = await Promise.all([api<ApiRun>(`/api/runs/${encodeURIComponent(id)}`), getCoach()]);
      return mapRunDetail(run, coach?.firstName, user.vma);
    },
    () => sampleRuns[id] ?? sampleRuns['run-2026-08-31'],
  );
}

/**
 * Blocs réalisés d'une sortie, format brut pour l'éditeur. Sans blocs enregistrés,
 * on amorce une étape unique aux chiffres de la sortie : il reste à la découper.
 */
export function useRunBlocksDraft(id: string) {
  return useAthleteQuery(
    `run-blocks:${id}`,
    async () => {
      const run = await api<ApiRun>(`/api/runs/${encodeURIComponent(id)}`);
      return runBlocksDraft(run);
    },
    () => runBlocksDraft({ _id: id, date: new Date().toISOString(), distance: 10, duration: 55, averagePace: '5:30', stravaActivityId: null }),
  );
}

const runBlocksDraft = (run: ApiRun) => ({
  title: run.stravaData?.name || SESSION_TYPE_LABELS[run.sessionType ?? ''] || 'Sortie',
  auto: Boolean(run.blocksAutoReconstructed),
  blocks: run.runBlocks?.length
    ? run.runBlocks
    : ([{ role: 'main', mode: 'distance', distance: run.distance ?? null, pace: run.averagePace ?? null, repetitions: 1, order: 0 }] as ApiRunBlock[]),
});

export function useAthleteProfile() {
  return useAthleteQuery(
    'profile',
    async (user) => {
      const [competitions, strava, coach] = await Promise.all([
        api<ApiCompetition[] | { competitions: ApiCompetition[] }>('/api/competitions')
          .then((response) => (Array.isArray(response) ? response : (response.competitions ?? [])))
          .catch((): ApiCompetition[] => []),
        getStravaStatus(),
        getCoach(),
      ]);
      return buildProfile(user, competitions, strava, coach, new Date());
    },
    () => sampleProfile,
  );
}

export function useNotifications() {
  return useAthleteQuery(
    'notifications',
    async () => {
      const { notifications } = await api<{ notifications: ApiNotification[] }>('/api/notifications', { query: { limit: 50 } });
      const now = new Date();
      return notifications.map((notification) => mapNotification(notification, now));
    },
    () => sampleNotifications,
  );
}

export function useUnreadNotificationCount() {
  return useAthleteQuery('notifications:unread', async () => (await api<{ count: number }>('/api/notifications/unread-count')).count, () => 3);
}

export function useCoachInvitations() {
  return useAthleteQuery(
    'coach:invitations',
    async () => {
      const invitations = await api<ApiCoachInvitation[]>('/api/athlete/invitations');
      return invitations.flatMap((invitation): CoachInvitation[] =>
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
      );
    },
    (): CoachInvitation[] => [],
  );
}

/** Total des messages non lus, toutes conversations : côté coach, qui a la liste complète. */
export function useAllChatUnreadCount() {
  return useAthleteQuery('chat:unread:all', async () => (await api<{ unreadCount: number }>('/api/chat/unread')).unreadCount, () => 0);
}

/** Messages non lus du coach (onglet Coach de l'athlète). */
export function useChatUnreadCount() {
  return useAthleteQuery(
    'chat:unread',
    async () => {
      // `/api/chat/unread` totalise toutes les conversations, or l'athlète n'a d'écran que
      // pour celle de son coach : un non-lu ailleurs laisserait la pastille allumée pour toujours.
      const [conversations, coach] = await Promise.all([getConversations(), getCoach()]);
      if (!coach) return 0;
      return conversations.find((conversation) => conversation.otherParticipant?._id === coach._id)?.unreadCount ?? 0;
    },
    () => 0,
  );
}

/** Écritures. Sans effet en mode démo. */
/** URL de retour après l'autorisation Strava : `exp://…` dans Expo Go, `trainwise://` en build. */
const stravaReturnUrl = () => Linking.createURL('strava');

export type StravaImportResult = { status: 'running' | 'done' | 'partial' | 'error'; imported: number; skipped: number };

type StravaStatus = { connected: boolean; initialImport: StravaImportResult | null };

/**
 * L'import de l'historique tourne côté serveur : on interroge son avancement
 * pour pouvoir annoncer un nombre de séances. Au-delà du délai, il continue
 * sans nous et l'athlète verra ses séances arriver.
 */
const waitForInitialImport = async (onProgress?: (result: StravaImportResult) => void): Promise<StravaImportResult> => {
  const deadline = Date.now() + 90_000;
  let last: StravaImportResult = { status: 'running', imported: 0, skipped: 0 };

  while (Date.now() < deadline) {
    const status = await api<StravaStatus>('/api/strava/status').catch(() => null);
    const initial = status?.initialImport;
    if (initial) {
      last = initial;
      onProgress?.(initial);
      if (initial.status !== 'running') {
        finishImport(initial);
        return initial;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Délai dépassé : le serveur continue, mais ce qui est déjà importé doit s'afficher.
  finishImport(last);
  return { ...last, status: 'running' };
};

/** Vide le cache et réveille les écrans montés, qui gardent sinon leurs anciennes données. */
const finishImport = (result: StravaImportResult) => {
  invalidateApiCache();
  if (result.imported > 0) emitAppEvent('sessions:changed');
};

/** Champs du profil sportif modifiables depuis l'app. */
export type SportProfilePatch = Pick<ApiUser, 'runningLevel' | 'weeklyFrequency' | 'vma' | 'fcmax' | 'height' | 'weight' | 'injuries' | 'availableDays' | 'preferredTime'>;

export type CompetitionPayload = { name: string; date: string; discipline: string; targetTime?: string | null; priority: 'A' | 'B' | 'C' };

/** Profil renseigné à la mise en route : le profil sportif, plus ce qui n'existe qu'ici. */
export type OnboardingPatch = SportProfilePatch & { disciplines?: string[]; strengthGoal?: string; strengthFrequency?: number };

/** Sortie réalisée saisie à la main depuis une séance prévue. */
export type DoneRunPayload = { date: string; distanceKm?: number; durationMin?: number; feeling?: number; notes?: string; sessionType?: string };

export function useAthleteActions() {
  const { status, user, updateUser } = useSession();
  const live = status === 'signedIn';

  const setSessionStatus = async (id: string, next: 'planned' | 'completed' | 'skipped') => {
    if (!live) return;
    await api(`/api/planning/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status: next } });
    invalidateApiCache();
  };

  return {
    async skipSession(id: string) {
      await setSessionStatus(id, 'skipped');
    },
    async completeSession(id: string) {
      await setSessionStatus(id, 'completed');
    },
    async reopenSession(id: string) {
      await setSessionStatus(id, 'planned');
    },
    async createPlannedSession(payload: NewPlannedSession) {
      if (!live) return;
      await api('/api/planning', { method: 'POST', body: { ...payload, status: 'planned' } });
      invalidateApiCache();
    },
    async joinCoach(code: string) {
      if (!live) return;
      await api(`/api/athlete/join/${encodeURIComponent(code.trim().toUpperCase())}`, { method: 'POST' });
      invalidateApiCache();
    },
    async answerInvitation(id: string, accept: boolean) {
      if (!live) return;
      await api(`/api/athlete/invitations/${encodeURIComponent(id)}/${accept ? 'accept' : 'reject'}`, { method: 'POST' });
      invalidateApiCache();
    },
    async saveStrengthSession(payload: StrengthSessionPayload) {
      if (!live) return;
      await api('/api/strength/sessions', { method: 'POST', body: payload });
      invalidateApiCache();
    },
    async saveRunFeeling(id: string, feeling: number) {
      if (!live) return;
      await api(`/api/runs/${encodeURIComponent(id)}`, { method: 'PATCH', body: { feeling } });
      invalidateApiCache('/api/runs');
    },
    /**
     * Sortie saisie à la main, quand Strava ne l'a pas importée. L'API complète
     * d'elle-même la séance prévue du même jour et prévient le coach.
     */
    async logRun(payload: DoneRunPayload) {
      if (!live) return;
      const pace = payload.distanceKm && payload.durationMin ? formatPace((payload.durationMin * 60) / payload.distanceKm) : undefined;
      await api('/api/runs', {
        method: 'POST',
        body: {
          date: new Date(`${payload.date}T12:00:00`).toISOString(),
          distance: payload.distanceKm,
          duration: payload.durationMin,
          averagePace: pace,
          feeling: payload.feeling,
          notes: payload.notes || undefined,
          sessionType: payload.sessionType,
        },
      });
      invalidateApiCache();
      emitAppEvent('sessions:changed');
    },
    /** Déroulé réalisé : l'API prévient le coach et cesse de le réécrire depuis Strava. */
    async saveRunBlocks(id: string, runBlocks: ApiRunBlock[]) {
      if (!live) return;
      await api(`/api/runs/${encodeURIComponent(id)}`, { method: 'PATCH', body: { runBlocks } });
      invalidateApiCache('/api/runs');
    },
    /** Compte rendu libre de la sortie : ce que l'athlète a réellement fait. */
    async saveRunNotes(id: string, notes: string) {
      if (!live) return;
      await api(`/api/runs/${encodeURIComponent(id)}`, { method: 'PATCH', body: { notes } });
      invalidateApiCache('/api/runs');
      emitAppEvent('sessions:changed');
    },
    /**
     * Ouvre l'autorisation Strava, puis suit l'import de l'historique lancé par
     * le serveur. Renvoie `null` si l'athlète a abandonné l'autorisation.
     */
    async connectStrava(onProgress?: (result: StravaImportResult) => void): Promise<StravaImportResult | null> {
      if (!live) return null;
      const returnTo = stravaReturnUrl();
      const { authUrl } = await api<{ authUrl: string }>('/api/strava/auth-url', { query: { returnTo } });
      const result = await WebBrowser.openAuthSessionAsync(authUrl, returnTo);
      if (result.type !== 'success' || !result.url.includes('strava=success')) return null;

      invalidateApiCache();
      return waitForInitialImport(onProgress);
    },
    /** Délie le compte Strava : l'API révoque aussi l'autorisation côté Strava. */
    async disconnectStrava() {
      if (!live) return;
      await api('/api/strava/disconnect', { method: 'DELETE' });
      invalidateApiCache();
    },
    /** Fin de la mise en route : le profil et la première compétition, en une fois. */
    async completeOnboarding(patch: OnboardingPatch, competition?: CompetitionPayload) {
      if (!user) return;
      if (!live) {
        updateUser({ ...user, ...patch, hasCompletedOnboarding: true });
        return;
      }
      updateUser(await api<ApiUser>('/api/auth/profile', { method: 'PATCH', body: { ...patch, hasCompletedOnboarding: true } }));
      if (competition) await api('/api/competitions', { method: 'POST', body: competition }).catch(() => undefined);
      invalidateApiCache();
    },
    /** Visite guidée vue : elle ne se rouvrira plus, sur aucun appareil. */
    async markTourSeen(pageId: string) {
      if (!user) return;
      updateUser({ ...user, toursSeen: [...(user.toursSeen ?? []), pageId] });
      if (live) await api('/api/auth/tours', { method: 'POST', body: { pageId } }).catch(() => undefined);
    },
    /** Profil sportif : niveau, fréquence, mensurations, contraintes. */
    async updateSportProfile(patch: SportProfilePatch) {
      if (!user) return;
      if (!live) {
        updateUser({ ...user, ...patch });
        return;
      }
      updateUser(await api<ApiUser>('/api/auth/profile', { method: 'PATCH', body: patch }));
    },
    async saveCompetition(id: string | null, payload: CompetitionPayload) {
      if (!live) return;
      await api(id ? `/api/competitions/${encodeURIComponent(id)}` : '/api/competitions', { method: id ? 'PATCH' : 'POST', body: payload });
      invalidateApiCache();
    },
    async deleteCompetition(id: string) {
      if (!live) return;
      await api(`/api/competitions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      invalidateApiCache();
    },
    async updateIdentity(patch: { firstName: string; lastName: string }) {
      if (!user) return;
      if (!live) {
        updateUser({ ...user, ...patch });
        return;
      }
      updateUser(await api<ApiUser>('/api/auth/profile', { method: 'PATCH', body: patch }));
    },
    async changeEmail(email: string, password: string) {
      if (!user || !live) return;
      const { email: saved } = await api<{ email: string }>('/api/auth/email', { method: 'PATCH', body: { email, password } });
      updateUser({ ...user, email: saved });
    },
    async changePassword(currentPassword: string, newPassword: string) {
      if (!live) return;
      await api('/api/auth/password', { method: 'PATCH', body: { currentPassword, newPassword } });
    },
    async deleteAccount() {
      if (!live) return;
      await api('/api/auth/account', { method: 'DELETE' });
    },
    async markNotificationRead(id: string) {
      if (!live) return;
      await api(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
    },
    async markAllNotificationsRead() {
      if (!live) return;
      await api('/api/notifications/read-all', { method: 'PATCH' });
    },
  };
}
