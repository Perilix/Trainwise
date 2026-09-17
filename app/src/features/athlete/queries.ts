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
  ApiStrengthSession,
  ApiStravaStatus,
} from '@/lib/api-types';
import { emitAppEvent } from '@/lib/app-events';
import { startOfWeek } from '@/lib/dates';
import { useSessionQuery } from '@/features/auth/use-session-query';
import { getConversations } from '@/features/chat/conversations';

import { buildHome, buildPlanning, buildProfile, buildRunsOverview, initialsOf, mapNotification, mapRunDetail } from './mappers';
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
    async () => {
      const [calendar, coach] = await Promise.all([getCalendar(year, monthIndex), getCoach()]);
      return buildPlanning(calendar, new Date(), coach?.firstName);
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
    async () => {
      const [run, coach] = await Promise.all([api<ApiRun>(`/api/runs/${encodeURIComponent(id)}`), getCoach()]);
      return mapRunDetail(run, coach?.firstName);
    },
    () => sampleRuns[id] ?? sampleRuns['run-2026-08-31'],
  );
}

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

export function useChatUnreadCount() {
  return useAthleteQuery('chat:unread', async () => (await api<{ unreadCount: number }>('/api/chat/unread')).unreadCount, () => 1);
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

export function useAthleteActions() {
  const { status } = useSession();
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
