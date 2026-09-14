// Accès aux données de l'espace coach. En mode démo, les données d'exemple remplacent l'API.
import { buildPlanning } from '@/features/athlete/mappers';
import { samplePlannedDetails, samplePlanning } from '@/features/athlete/sample-data';
import { mapPlannedDetail } from '@/features/athlete/session-detail';
import type { NewPlannedSession } from '@/features/athlete/types';
import { useSession } from '@/features/auth/session';
import { useSessionQuery } from '@/features/auth/use-session-query';
import { getConversations, mapConversationRows } from '@/features/chat/conversations';
import { useDirectChat } from '@/features/chat/use-direct-chat';
import { api, cachedGet, invalidateApiCache } from '@/lib/api';
import type {
  ApiCalendarData,
  ApiCoachAthlete,
  ApiCoachAthleteDetail,
  ApiCoachStats,
  ApiCompetition,
  ApiPackageType,
  ApiPendingInvitation,
  ApiPlannedRunDetail,
  ApiRunBlock,
  ApiSubscriptionRequest,
  ApiUser,
  ApiUserSearchResult,
} from '@/lib/api-types';

import { buildAthleteFiche, buildCoachHome, buildInviteOverview, mapAthleteList, mapSearchResults } from './mappers';
import {
  COACH_SAMPLE_NOW,
  sampleAthleteCompetitions,
  sampleAthleteDetail,
  sampleCoachAthletes,
  sampleCoachConversations,
  sampleCoachMessages,
  sampleCoachStats,
  sampleInviteCode,
  samplePendingInvitations,
  sampleSearchResults,
  sampleSubscriptionRequests,
} from './sample-data';
import type { TemplatePayload } from './templates';

const athletePath = (id: string) => `/api/coach/athletes/${encodeURIComponent(id)}`;

/** Midi heure locale : la date reste la même quel que soit le fuseau du serveur. */
const noonIso = (isoDay: string) => {
  const [year, month, day] = isoDay.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toISOString();
};

export function useAthletePlanning(athleteId: string, year: number, monthIndex: number) {
  return useSessionQuery(
    `coach:planning:${athleteId}:${year}-${monthIndex}`,
    async () => buildPlanning(await api<ApiCalendarData>(`${athletePath(athleteId)}/calendar`, { query: { month: monthIndex + 1, year } }), new Date()),
    () => ({ ...samplePlanning, year, monthIndex }),
  );
}

/** Séance planifiée brute (pour l'éditeur) ; null quand on crée une nouvelle séance. */
export function useCoachPlannedRaw(athleteId: string, planId?: string) {
  return useSessionQuery<ApiPlannedRunDetail | null>(
    `coach:planned-raw:${athleteId}:${planId ?? 'nouvelle'}`,
    async () => (planId ? api<ApiPlannedRunDetail>(`${athletePath(athleteId)}/planning/${encodeURIComponent(planId)}`) : null),
    () => (planId ? (samplePlannedDetails[planId] ?? samplePlannedDetails['plan-2026-09-15']) : null),
  );
}

export function useCoachPlannedSession(athleteId: string, planId: string) {
  return useSessionQuery(
    `coach:planned:${athleteId}:${planId}`,
    async () => mapPlannedDetail(await api<ApiPlannedRunDetail>(`${athletePath(athleteId)}/planning/${encodeURIComponent(planId)}`)),
    () => mapPlannedDetail(samplePlannedDetails[planId] ?? samplePlannedDetails['plan-2026-09-13'], 17),
  );
}

export function useCoachHome() {
  return useSessionQuery(
    'coach:home',
    async () => {
      const [stats, athletes, requests] = await Promise.all([
        api<ApiCoachStats>('/api/coach/stats'),
        api<ApiCoachAthlete[]>('/api/coach/athletes'),
        api<ApiSubscriptionRequest[]>('/api/coach/subscription-requests').catch((): ApiSubscriptionRequest[] => []),
      ]);
      return buildCoachHome(stats, athletes, requests);
    },
    () => buildCoachHome(sampleCoachStats, sampleCoachAthletes, sampleSubscriptionRequests),
  );
}

export function useAthleteFiche(id: string) {
  return useSessionQuery(
    `coach:athlete:${id}`,
    async () => {
      const [detail, competitions] = await Promise.all([
        api<ApiCoachAthleteDetail>(athletePath(id)),
        api<ApiCompetition[] | { competitions: ApiCompetition[] }>(`${athletePath(id)}/competitions`)
          .then((response) => (Array.isArray(response) ? response : (response.competitions ?? [])))
          .catch((): ApiCompetition[] => []),
      ]);
      return buildAthleteFiche(detail, competitions, new Date());
    },
    () => buildAthleteFiche({ ...sampleAthleteDetail, ...demoAthleteIdentity(id) }, sampleAthleteCompetitions, COACH_SAMPLE_NOW),
  );
}

// En démo, toutes les fiches reprennent le profil de Léa sous le nom de l'athlète choisi.
function demoAthleteIdentity(id: string) {
  const athlete = sampleCoachAthletes.find((item) => item._id === id);
  return athlete ? { _id: athlete._id, firstName: athlete.firstName, lastName: athlete.lastName, status: athlete.status } : {};
}

export function useCoachConversations() {
  return useSessionQuery(
    'coach:conversations',
    async () => mapConversationRows(await getConversations(), new Date()),
    () => mapConversationRows(sampleCoachConversations, COACH_SAMPLE_NOW),
  );
}

export function useAthleteConversation(peerId: string) {
  return useDirectChat({
    key: `chat:${peerId}`,
    loadPeer: async (conversations) => {
      const existing = conversations.find((conversation) => conversation.otherParticipant?._id === peerId)?.otherParticipant;
      if (existing) return existing;
      const athlete = await api<ApiCoachAthleteDetail>(athletePath(peerId)).catch(() => null);
      return athlete ? { _id: athlete._id, firstName: athlete.firstName, lastName: athlete.lastName } : null;
    },
    demo: () => {
      const conversation = sampleCoachConversations.find((item) => item.otherParticipant?._id === peerId)?.otherParticipant;
      const athlete = sampleCoachAthletes.find((item) => item._id === peerId);
      const person = conversation ?? athlete;
      return {
        peer: person
          ? {
              id: peerId,
              firstName: person.firstName,
              name: `${person.firstName} ${person.lastName}`,
              initials: `${person.firstName[0]}${person.lastName[0]}`.toUpperCase(),
              online: Boolean(conversation?.isOnline),
            }
          : null,
        messages: sampleCoachMessages(peerId),
      };
    },
  });
}

/** Athlètes du coach (nom, VMA) pour planifier une séance type. */
export function useCoachAthleteList() {
  return useSessionQuery('coach:athlete-list', async () => mapAthleteList(await cachedGet<ApiCoachAthlete[]>('/api/coach/athletes')), () => mapAthleteList(sampleCoachAthletes));
}

export function useInviteOverview() {
  return useSessionQuery(
    'coach:invite',
    async () => {
      const [code, pending] = await Promise.all([
        api<{ code: string | null }>('/api/coach/invite/code').then((response) => response.code),
        api<ApiPendingInvitation[]>('/api/coach/invitations/pending').catch((): ApiPendingInvitation[] => []),
      ]);
      return buildInviteOverview(code, pending);
    },
    () => buildInviteOverview(sampleInviteCode, samplePendingInvitations),
  );
}

/** Écritures de l'espace coach. En démo, elles n'appellent pas l'API. */
export function useCoachActions() {
  const { status, user, updateUser } = useSession();
  const live = status === 'signedIn';

  const assignToAthletes = async (templateId: string, athleteIds: string[], isoDay: string) => {
    if (!live) return athleteIds.length;
    const response = await api<{ created: number }>(`/api/coach/session-templates/${encodeURIComponent(templateId)}/assign`, {
      method: 'POST',
      body: { assignments: athleteIds.map((athleteId) => ({ athleteId, date: noonIso(isoDay), paceOverrides: {} })) },
    });
    invalidateApiCache();
    return response.created;
  };

  return {
    async respondToRequest(id: string, accept: boolean) {
      if (!live) return;
      await api(`/api/coach/subscription-requests/${encodeURIComponent(id)}/respond`, { method: 'POST', body: { action: accept ? 'accept' : 'decline' } });
      invalidateApiCache();
    },
    async generateInviteCode() {
      if (!live) return sampleInviteCode;
      return (await api<{ code: string }>('/api/coach/invite/code', { method: 'POST', body: {} })).code;
    },
    async searchAthletes(query: string) {
      if (!live) {
        const needle = query.trim().toLowerCase();
        return mapSearchResults(sampleSearchResults.filter((result) => `${result.firstName} ${result.lastName} ${result.email}`.toLowerCase().includes(needle)));
      }
      return mapSearchResults(await api<ApiUserSearchResult[]>('/api/coach/users/search', { query: { query: query.trim() } }));
    },
    async inviteAthlete(athleteId: string, packageType: ApiPackageType) {
      if (!live) return;
      await api('/api/coach/invite/direct', { method: 'POST', body: { athleteId, packageType } });
      invalidateApiCache();
    },
    async createAthleteSession(athleteId: string, payload: NewPlannedSession & { runBlocks?: ApiRunBlock[] }) {
      if (!live) return;
      await api(`${athletePath(athleteId)}/planning`, { method: 'POST', body: { ...payload, date: noonIso(payload.date), status: 'planned' } });
      invalidateApiCache();
    },
    async updateAthleteSession(athleteId: string, planId: string, patch: { sessionType?: string; description?: string; runBlocks?: ApiRunBlock[] }) {
      if (!live) return;
      await api(`${athletePath(athleteId)}/planning/${encodeURIComponent(planId)}`, { method: 'PATCH', body: patch });
      invalidateApiCache();
    },
    async duplicateAthleteSession(athleteId: string, planId: string, isoDay: string) {
      if (!live) return;
      await api(`${athletePath(athleteId)}/planning/${encodeURIComponent(planId)}/duplicate`, { method: 'POST', body: { targetDate: noonIso(isoDay) } });
      invalidateApiCache();
    },
    async deleteAthleteSession(athleteId: string, planId: string) {
      if (!live) return;
      await api(`${athletePath(athleteId)}/planning/${encodeURIComponent(planId)}`, { method: 'DELETE' });
      invalidateApiCache();
    },
    /** Planifie une séance type : l'API calcule les allures à partir de la VMA de l'athlète. */
    async assignTemplate(templateId: string, athleteId: string, isoDay: string) {
      await assignToAthletes(templateId, [athleteId], isoDay);
    },
    assignTemplateToAthletes: assignToAthletes,
    async createTemplate(payload: TemplatePayload) {
      if (!live) return;
      await api('/api/coach/session-templates', { method: 'POST', body: payload });
      invalidateApiCache();
    },
    async updateTemplate(templateId: string, payload: TemplatePayload) {
      if (!live) return;
      await api(`/api/coach/session-templates/${encodeURIComponent(templateId)}`, { method: 'PATCH', body: payload });
      invalidateApiCache();
    },
    async deleteTemplate(templateId: string) {
      if (!live) return;
      await api(`/api/coach/session-templates/${encodeURIComponent(templateId)}`, { method: 'DELETE' });
      invalidateApiCache();
    },
    async removeAthlete(athleteId: string) {
      if (!live) return;
      await api(athletePath(athleteId), { method: 'DELETE' });
      invalidateApiCache();
    },
    async updateAthleteVma(athleteId: string, vma: number) {
      if (!live) return;
      await api(`${athletePath(athleteId)}/vma`, { method: 'PATCH', body: { vma } });
      invalidateApiCache();
    },
    async updateProfile(patch: Pick<ApiUser, 'disciplines' | 'diplomas' | 'experience' | 'bio'>) {
      if (!user) return;
      if (!live) {
        updateUser({ ...user, ...patch });
        return;
      }
      updateUser(await api<ApiUser>('/api/auth/profile', { method: 'PATCH', body: patch }));
    },
  };
}
