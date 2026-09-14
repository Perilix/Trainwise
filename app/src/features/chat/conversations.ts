import { initialsOf } from '@/features/athlete/mappers';
import { api } from '@/lib/api';
import type { ApiConversation } from '@/lib/api-types';
import { daysBetween } from '@/lib/dates';
import { formatDayShort, formatTime, toIsoDay } from '@/lib/format';

export const getConversations = () => api<ApiConversation[]>('/api/chat/conversations').catch((): ApiConversation[] => []);

export type ConversationRow = {
  peerId: string;
  name: string;
  initials: string;
  online: boolean;
  preview: string;
  timeLabel: string;
  unread: number;
};

function timeLabel(sentAt: Date, now: Date) {
  const age = daysBetween(sentAt, now);
  if (age <= 0) return formatTime(sentAt);
  if (age === 1) return 'Hier';
  const [weekday, ...dayMonth] = formatDayShort(toIsoDay(sentAt)).split(' ');
  return age < 7 ? weekday : dayMonth.join(' ');
}

/** Conversations directes, les plus récentes en premier (ordre de l'API). */
export function mapConversationRows(conversations: ApiConversation[], now: Date): ConversationRow[] {
  return conversations.flatMap((conversation) => {
    const peer = conversation.otherParticipant;
    if (conversation.type !== 'direct' || !peer) return [];
    const last = conversation.lastMessage;
    const sentAt = last?.sentAt ? new Date(last.sentAt) : null;
    return [
      {
        peerId: peer._id,
        name: `${peer.firstName} ${peer.lastName}`.trim(),
        initials: initialsOf(peer.firstName, peer.lastName),
        online: peer.isOnline,
        preview: last?.content ? (last.type === 'text' ? last.content : 'Pièce jointe') : 'Nouvelle conversation',
        timeLabel: sentAt ? timeLabel(sentAt, now) : '',
        unread: conversation.unreadCount,
      },
    ];
  });
}
