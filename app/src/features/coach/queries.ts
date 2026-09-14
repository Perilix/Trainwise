// Accès aux données de l'espace coach. En mode démo, les données d'exemple remplacent l'API.
import { useSession } from '@/features/auth/session';
import { useSessionQuery } from '@/features/auth/use-session-query';
import { getConversations, mapConversationRows } from '@/features/chat/conversations';
import { useDirectChat } from '@/features/chat/use-direct-chat';
import { api, invalidateApiCache } from '@/lib/api';
import type {
  ApiCoachAthlete,
  ApiCoachAthleteDetail,
  ApiCoachStats,
  ApiCompetition,
  ApiPackageType,
  ApiPendingInvitation,
  ApiSubscriptionRequest,
  ApiUser,
  ApiUserSearchResult,
} from '@/lib/api-types';

import { buildAthleteFiche, buildCoachHome, buildInviteOverview, mapSearchResults } from './mappers';
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

const athletePath = (id: string) => `/api/coach/athletes/${encodeURIComponent(id)}`;

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
