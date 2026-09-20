import { Injectable, inject } from '@angular/core';
import { forkJoin, map, of, switchMap } from 'rxjs';

import type { ApiConversation, ApiConversationGroup, ApiMessage, ApiSessionRef, ApiUserRef } from '../core/api-types';
import { ApiService } from '../core/api.service';
import { initialsOf } from '../domain/athlete.mappers';
import { daysBetween } from '../core/dates';
import { formatDayShort, formatTime, toIsoDay } from '../core/format';

export type ConversationRow = {
  conversationId: string;
  /** Null pour un groupe : il n'y a pas d'interlocuteur unique. */
  peerId: string | null;
  kind: 'direct' | 'group';
  name: string;
  initials: string;
  online: boolean;
  preview: string;
  timeLabel: string;
  unread: number;
  /** Participants, pour un groupe : le coach d'abord, puis les athlètes. */
  people?: { id: string; name: string; initials: string; coach: boolean }[];
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

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = inject(ApiService);

  conversations$() {
    return this.api.getOr<ApiConversation[]>('/api/chat/conversations', []).pipe(
      map((conversations) => {
        const now = new Date();
        return conversations.flatMap<ConversationRow>((conversation) => {
          const last = conversation.lastMessage;
          const sentAt = last?.sentAt ? new Date(last.sentAt) : null;
          const preview = last?.content ? (last.type === 'text' ? last.content : 'Pièce jointe') : 'Nouvelle conversation';
          const common = {
            conversationId: conversation._id,
            preview,
            timeLabel: sentAt ? timeLabel(sentAt, now) : '',
            unread: conversation.unreadCount,
          };

          if (conversation.type === 'group') {
            const name = conversation.name?.trim() || 'Groupe';
            return [
              {
                ...common,
                peerId: null,
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
      }),
    );
  }

  /** Le groupe derrière une conversation : sa couleur, sa course visée. */
  conversationGroup$(conversationId: string) {
    return this.api.getOr<ApiConversationGroup | null>(`/api/chat/conversations/${encodeURIComponent(conversationId)}/group`, null);
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
            kind: 'direct' as const,
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
