import { Injectable, inject } from '@angular/core';
import { forkJoin, map, of, switchMap } from 'rxjs';

import type { ApiConversation, ApiMessage, ApiSessionRef, ApiUserRef } from '../core/api-types';
import { ApiService } from '../core/api.service';
import { initialsOf } from '../domain/athlete.mappers';
import { daysBetween } from '../core/dates';
import { formatDayShort, formatTime, toIsoDay } from '../core/format';

export type ConversationRow = {
  conversationId: string;
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

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = inject(ApiService);

  conversations$() {
    return this.api.getOr<ApiConversation[]>('/api/chat/conversations', []).pipe(
      map((conversations) => {
        const now = new Date();
        return conversations.flatMap<ConversationRow>((conversation) => {
          const peer = conversation.otherParticipant;
          if (conversation.type !== 'direct' || !peer) return [];
          const last = conversation.lastMessage;
          const sentAt = last?.sentAt ? new Date(last.sentAt) : null;
          return [
            {
              conversationId: conversation._id,
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
      }),
    );
  }

  messages$(conversationId: string) {
    return this.api
      .get<{ messages: ApiMessage[] }>(`/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`, { limit: 50 })
      .pipe(map(({ messages }) => messages));
  }

  /** Ouvre (ou retrouve) la conversation avec un interlocuteur. */
  openWith$(peerId: string) {
    return this.api.post<ApiConversation>(`/api/chat/conversations/with/${encodeURIComponent(peerId)}`);
  }

  markRead(conversationId: string) {
    return this.api.patch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/read`);
  }

  /** Conversation avec le coach de l'athlète, créée au besoin. */
  coachConversation$() {
    return forkJoin({
      coach: this.api.getOr<{ _id: string; firstName: string; lastName: string } | null>('/api/athlete/coach', null),
      conversations: this.conversations$(),
    }).pipe(
      switchMap(({ coach, conversations }) => {
        if (!coach) return of(null);
        const existing = conversations.find((row) => row.peerId === coach._id);
        if (existing) return of(existing);
        return this.openWith$(coach._id).pipe(
          map((conversation) => ({
            conversationId: conversation._id,
            peerId: coach._id,
            name: `${coach.firstName} ${coach.lastName}`.trim(),
            initials: initialsOf(coach.firstName, coach.lastName),
            online: false,
            preview: 'Nouvelle conversation',
            timeLabel: '',
            unread: 0,
          })),
        );
      }),
    );
  }
}

export type { ApiMessage, ApiSessionRef, ApiUserRef };
