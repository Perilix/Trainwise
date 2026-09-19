import { initialsOf } from '@/features/athlete/mappers';
import { api } from '@/lib/api';
import type { ApiConversation } from '@/lib/api-types';
import { daysBetween } from '@/lib/dates';
import { formatDayShort, formatTime, toIsoDay } from '@/lib/format';

export const getConversations = () => api<ApiConversation[]>('/api/chat/conversations').catch((): ApiConversation[] => []);

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
  /** Nombre de participants, pour un groupe. */
  members?: number;
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
          members: conversation.participants?.length ?? 0,
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
