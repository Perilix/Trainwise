import { initialsOf } from '@/features/athlete/mappers';
import { useSessionQuery } from '@/features/auth/use-session-query';
import { api } from '@/lib/api';
import type { ApiConversation, ApiConversationGroup } from '@/lib/api-types';
import { daysBetween } from '@/lib/dates';
import { formatDayShort, formatTime, toIsoDay } from '@/lib/format';

export const getConversations = () => api<ApiConversation[]>('/api/chat/conversations').catch((): ApiConversation[] => []);

/** Le groupe derrière une conversation : sa couleur, sa course visée. */
export function useConversationGroup(conversationId: string) {
  return useSessionQuery<ApiConversationGroup | null>(
    `conversation-group:${conversationId}`,
    async () => api<ApiConversationGroup>(`/api/chat/conversations/${encodeURIComponent(conversationId)}/group`).catch(() => null),
    () => null,
  );
}

/** Une conversation précise, telle que la liste la décrit — membres compris. */
export function useConversationRow(conversationId: string) {
  return useSessionQuery(
    `conversation:${conversationId}`,
    async () => mapConversationRows(await getConversations(), new Date()).find((row) => row.conversationId === conversationId) ?? null,
    () => null,
  );
}

export type ConversationRow = {
  /** Identifiant de l'interlocuteur, ou du groupe pour une conversation à plusieurs. */
  peerId: string;
  kind: 'direct' | 'group';
  name: string;
  initials: string;
  online: boolean;
  preview: string;
  timeLabel: string;
  unread: number;
  /** Participants, pour un groupe : le coach d'abord, puis les athlètes. */
  people?: { id: string; name: string; initials: string; coach: boolean }[];
  /** Identifiant de la conversation — utile quand il n'y a pas d'interlocuteur. */
  conversationId: string;
};

/** Les initiales d'un groupe viennent de son nom : « Marathon de Lyon » → ML. */
const groupInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('') || name.slice(0, 2).toUpperCase();

function timeLabel(sentAt: Date, now: Date) {
  const age = daysBetween(sentAt, now);
  if (age <= 0) return formatTime(sentAt);
  if (age === 1) return 'Hier';
  const [weekday, ...dayMonth] = formatDayShort(toIsoDay(sentAt)).split(' ');
  return age < 7 ? weekday : dayMonth.join(' ');
}

/** Conversations, directes et de groupe, les plus récentes en premier (ordre de l'API). */
export function mapConversationRows(conversations: ApiConversation[], now: Date): ConversationRow[] {
  return conversations.flatMap<ConversationRow>((conversation) => {
    const last = conversation.lastMessage;
    const sentAt = last?.sentAt ? new Date(last.sentAt) : null;
    const common = {
      conversationId: conversation._id,
      preview: last?.content ? (last.type === 'text' ? last.content : 'Pièce jointe') : 'Nouvelle conversation',
      timeLabel: sentAt ? timeLabel(sentAt, now) : '',
      unread: conversation.unreadCount,
    };

    if (conversation.type === 'group') {
      const name = conversation.name?.trim() || 'Groupe';
      return [
        {
          ...common,
          peerId: conversation._id,
          kind: 'group' as const,
          name,
          initials: groupInitials(name),
          online: false,
          people: (conversation.participants ?? [])
            .map((person) => ({
              id: person._id,
              name: `${person.firstName} ${person.lastName}`.trim(),
              initials: initialsOf(person.firstName, person.lastName),
              coach: person.role === 'coach',
            }))
            // Le coach en tête : c'est lui qui rassemble le groupe.
            .sort((a, b) => Number(b.coach) - Number(a.coach) || a.name.localeCompare(b.name)),
        },
      ];
    }

    const peer = conversation.otherParticipant;
    if (!peer) return [];
    return [
      {
        ...common,
        peerId: peer._id,
        kind: 'direct' as const,
        name: `${peer.firstName} ${peer.lastName}`.trim(),
        initials: initialsOf(peer.firstName, peer.lastName),
        online: peer.isOnline,
      },
    ];
  });
}
