import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { map, of } from 'rxjs';

import { ApiService } from '../../core/api.service';
import type { ApiMessage } from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { BadgesService } from '../../core/badges.service';
import { startOfWeek } from '../../core/dates';
import { formatDayShort, formatDecimal, formatHoursMinutes, toIsoDay } from '../../core/format';
import { load } from '../../core/load';
import { SocketService } from '../../core/socket.service';
import { AthleteService } from '../../data/athlete.service';
import { ChatService, type ConversationRow } from '../../data/chat.service';
import { CoachService } from '../../data/coach.service';
import { buildPlanning, buildWeekPlan, mapMessages } from '../../domain/athlete.mappers';
import type { Activity, CitedSession, PlannedSession, WeekPlanDay } from '../../domain/athlete.types';
import type { Segment } from '../../domain/sessions';
import { AvatarComponent } from '../../ui/avatar.component';
import { IconComponent } from '../../ui/icon.component';
import { StateViewComponent } from '../../ui/state-view.component';
import { WeekPlanComponent, type WeekPick } from '../../ui/week-plan.component';
import { WorkoutProfileComponent } from '../../ui/workout-profile.component';

/** Messagerie en deux panneaux : la liste des conversations à gauche, le fil à droite. */
@Component({
  selector: 'tw-messages',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, RouterLink, StateViewComponent, WeekPlanComponent, WorkoutProfileComponent],
  template: `
    <main class="split">
      @if (showList()) {
      <section class="list">
        <div class="list-head">
          <span class="title">Messages</span>
        </div>
        <div class="search-wrap">
          <div class="search">
            <tw-icon name="search" [size]="16" />
            <input placeholder="Rechercher" [value]="search()" (input)="search.set(value($event))" />
          </div>
        </div>

        @if (groupCount()) {
          <div class="filters">
            @for (option of filters; track option.value) {
              <button type="button" class="chip-filter" [class.on]="filter() === option.value" (click)="filter.set(option.value)">
                {{ option.label }}
              </button>
            }
          </div>
        }

        <div class="rows scroll-y">
          @if (conversations.loading()) {
            <tw-state kind="loading" />
          } @else {
            @for (row of filtered(); track row.conversationId) {
              <button type="button" class="conv" [class.on]="row.conversationId === activeId()" (click)="select(row)">
                <tw-avatar [initials]="row.initials" [tone]="row.kind === 'group' ? 'danger' : 'accent'" [size]="44" [online]="row.online" />
                <div class="grow stack">
                  <div class="line">
                    @if (row.kind === 'group') {
                      <tw-icon class="group-mark" name="friends" [size]="14" />
                    }
                    <span class="h3 grow truncate">{{ row.name }}</span>
                    <span class="caption muted-3">{{ row.timeLabel }}</span>
                  </div>
                  <div class="line">
                    <span class="small muted grow truncate">{{ row.preview }}</span>
                    @if (row.unread) {
                      <span class="badge">{{ row.unread }}</span>
                    }
                  </div>
                </div>
              </button>
            } @empty {
              <tw-state kind="empty" icon="chat" message="Aucune conversation." />
            }
          }
        </div>
      </section>
      }

      <section class="thread">
        @if (active(); as peer) {
          <header class="thread-head">
            <tw-avatar [initials]="peer.initials" [tone]="peer.kind === 'group' ? 'danger' : 'accent'" [size]="44" [online]="peer.online" />
            <div class="grow stack">
              <span class="h3">{{ peer.name }}</span>
              <div class="line">
                @if (peer.kind === 'group') {
                  <tw-icon class="group-mark" name="friends" [size]="14" />
                  <span class="caption muted">{{ typing() ? 'quelqu’un écrit…' : (peer.people?.length ?? 0) + ' participants' }}</span>
                } @else {
                  <span class="dot" [style.background]="peer.online ? 'var(--success)' : 'var(--text3)'"></span>
                  <span class="caption muted">{{ typing() ? 'écrit…' : peer.online ? 'En ligne' : 'Hors ligne' }}</span>
                }
              </div>
            </div>
            @if (auth.isCoach() && peer.peerId; as athleteId) {
              <button class="btn btn-ghost btn-sm" type="button" (click)="openAthlete(athleteId)">
                <tw-icon name="user" [size]="16" [strokeWidth]="2" />
                Fiche athlète
              </button>
            }
          </header>

          <div class="stream scroll-y" #stream>
            @for (message of thread(); track message.id) {
              @if (message.dayLabel) {
                <div class="day">{{ message.dayLabel }}</div>
              }
              @if (message.system) {
                <span class="system caption">{{ message.text }}</span>
              } @else {
              @let speaking = active()?.kind === 'group' && !message.fromMe;
              <div class="bubble-wrap" [class.mine]="message.fromMe" [class.speaking]="speaking">
                @if (speaking && message.senderName) {
                  <span class="caption sender">{{ message.senderName }}</span>
                }
                <div class="bubble-row">
                  @if (speaking) {
                    <tw-avatar class="speaker" [initials]="message.senderInitials ?? ''" tone="accent" [size]="40" />
                  }
                  <div class="bubble" [class.mine]="message.fromMe">
                    @if (message.session; as session) {
                      <button type="button" class="quoted" (click)="openSession(session)">
                        <span class="q-head">
                          <span class="q-tile"><tw-icon [name]="session.sport === 'strength' ? 'dumbbell' : 'run'" [size]="16" /></span>
                          <span class="stack grow">
                            <span class="h3 truncate">{{ session.title }}</span>
                            @if (session.meta) {
                              <span class="caption muted">{{ session.meta }}</span>
                            }
                          </span>
                        </span>
                        @if (profileOf(session); as segments) {
                          <tw-workout-profile class="q-profile" [segments]="segments" [height]="30" [gap]="1" />
                        }
                        <span class="q-open">Ouvrir la séance <tw-icon name="chevron-right" [size]="14" [strokeWidth]="2" /></span>
                      </button>
                    }
                    @if (message.text) {
                      <span class="text">{{ message.text }}</span>
                    }
                  </div>
                </div>
                <span class="time caption muted-3">{{ message.timeLabel }}</span>
              </div>
              }
            } @empty {
              <tw-state kind="empty" icon="chat" message="Démarre la conversation." />
            }
          </div>

          <div class="composer">
            <input
              class="composer-input"
              placeholder="Écris ton message…"
              [value]="draft()"
              (input)="onType($event)"
              (keydown.enter)="send()"
            />
            <button class="send" type="button" [class.on]="draft().trim().length > 0" [disabled]="!draft().trim()" (click)="send()" aria-label="Envoyer">
              <tw-icon name="send" [size]="18" [strokeWidth]="2" />
            </button>
          </div>
          @if (sendError()) {
            <p class="err small">{{ sendError() }}</p>
          }
        } @else if (!conversations.loading()) {
          <div class="empty-thread">
            <tw-state kind="empty" icon="chat" [message]="auth.isCoach() ? 'Choisis une conversation.' : 'Aucun coach pour le moment.'">
              @if (!auth.isCoach()) {
                <a class="btn btn-ghost btn-sm" routerLink="/profil">Rejoindre un coach</a>
              }
            </tw-state>
          </div>
        }
      </section>

      @if (active()?.kind === 'group') {
        <aside class="week">
          <div class="week-head">
            <div class="head-line">
              <span class="h3 grow">Membres</span>
              <span class="caption muted num">{{ active()?.people?.length ?? 0 }}</span>
            </div>
          </div>
          <div class="members scroll-y">
            @for (person of active()?.people ?? []; track person.id) {
              <div class="member">
                <tw-avatar [initials]="person.initials" [tone]="person.coach ? 'violet' : 'accent'" [size]="36" />
                <span class="h3 grow truncate">{{ person.name }}</span>
                @if (person.coach) {
                  <span class="chip chip-coach">Coach</span>
                }
              </div>
            } @empty {
              <p class="small muted pad">Personne dans ce groupe.</p>
            }
          </div>
          <p class="caption muted-3 pad">
            Les membres suivent le groupe : le coach les ajoute et les retire depuis sa page d'accueil.
          </p>
        </aside>
      } @else {
      <aside class="week">
        <div class="week-head">
          <div class="head-line">
            <span class="h3 grow">{{ auth.isCoach() ? 'Sa semaine' : 'Ma semaine' }}</span>
            <span class="caption muted">{{ weekLabel() }}</span>
          </div>
          @if (race.data(); as next) {
            <span class="race" [class.close]="next.days <= 21">
              <tw-icon name="flag" [size]="13" [strokeWidth]="2" />
              <span class="truncate grow">{{ next.name }}</span>
              <span class="num">{{ next.countdown }}</span>
            </span>
          }
        </div>

        @if (week.loading()) {
          <tw-state kind="loading" />
        } @else if (week.data(); as days) {
          <div class="summary">
            <div class="volume">
              <span class="num done">{{ volume().done }}</span>
              <span class="unit">/ {{ volume().planned }} km cette semaine</span>
            </div>
            <div class="bar" [attr.aria-label]="volume().done + ' km sur ' + volume().planned + ' prévus'">
              <span class="fill" [style.width.%]="volume().percent"></span>
            </div>
            <div class="mini-stats">
              <div class="mini-stat">
                <span class="num">{{ counts().done }}/{{ counts().planned }}</span>
                <span class="caption muted">séances</span>
              </div>
              <div class="mini-stat">
                <span class="num">{{ timeLabel() }}</span>
                <span class="caption muted">de sport</span>
              </div>
              <div class="mini-stat">
                <span class="num">{{ nextLabel() }}</span>
                <span class="caption muted">prochaine</span>
              </div>
            </div>
          </div>

          <div class="week-body scroll-y">
            <tw-week-plan [days]="days" (openSession)="openPlanned($event)" (openActivity)="openDone($event)" (quote)="quoteInChat($event)" />
          </div>

          <div class="week-foot">
            <span class="caption muted grow">Clique une séance : tu peux l'ouvrir ou la citer ici.</span>
            <a class="btn btn-ghost btn-sm" [routerLink]="planningLink()">Planning</a>
          </div>
        }
      </aside>
      }
    </main>
  `,
  styles: [
    `
      /* La hauteur doit être posée sur l'hôte : .split est un élément flex, son
         flex-basis l'emporte sur sa propre hauteur, qui retombait alors sur la
         hauteur du contenu — toute la conversation, d'où la page à rallonge. */
      :host {
        height: 100vh;
        overflow: hidden;
      }

      .split {
        flex: 1;
        min-width: 0;
        min-height: 0;
        display: flex;
        overflow: hidden;
      }

      .list {
        width: 340px;
        flex-shrink: 0;
        min-height: 0;
        border-right: 1px solid var(--border);
        background: var(--surface);
        display: flex;
        flex-direction: column;
      }

      .list-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 24px 20px 12px;
      }

      .title {
        font-size: 22px;
        line-height: 30px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }

      .group-mark {
        color: var(--danger);
      }

      .sender {
        color: var(--accent-ink);
      }

      /* Une arrivée, un départ : la conversation le dit, personne ne l'a écrit. */
      .system {
        align-self: center;
        color: var(--text3);
        text-align: center;
        padding: 2px 0;
      }

      .members {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .member {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        border-top: 1px solid var(--border);
      }

      .pad {
        padding: 12px 16px;
        margin: 0;
      }

      .filters {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 16px 12px;
      }

      .chip-filter {
        height: 28px;
        padding: 0 12px;
        border-radius: var(--r-pill);
        background: var(--surface);
        border: 1px solid var(--border);
        font-size: 12px;
        font-weight: 500;
        color: var(--text3);
        cursor: pointer;
      }

      .chip-filter.on {
        background: var(--subtle);
        border-color: var(--border-strong);
        color: var(--ink);
        font-weight: 600;
      }

      .search-wrap {
        padding: 0 20px 12px;
      }

      .search {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 40px;
        padding: 0 12px;
        border-radius: var(--r-md);
        border: 1px solid var(--border);
        color: var(--text3);
      }

      .search input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: none;
        background: none;
        font-size: 14px;
        color: var(--ink);
      }

      .rows {
        flex: 1;
        min-height: 0;
      }

      .conv {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 20px;
        width: 100%;
        text-align: left;
      }

      .conv:hover {
        background: var(--bg);
      }

      .conv.on {
        background: var(--subtle);
      }

      .line {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .badge {
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: var(--r-pill);
        background: var(--danger);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .thread {
        flex: 1;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        background: var(--bg);
      }

      /* Troisième colonne : la semaine de l'athlète, pour parler d'une séance
         sans quitter la conversation. */
      .week {
        width: 340px;
        flex-shrink: 0;
        min-height: 0;
        border-left: 1px solid var(--border);
        background: var(--surface);
        display: flex;
        flex-direction: column;
      }

      .week-head {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 22px 20px 14px;
        border-bottom: 1px solid var(--border);
      }

      .head-line {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }

      /* Rappel de l'objectif : c'est lui qui donne du sens au volume de la semaine. */
      .race {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 26px;
        padding: 0 10px;
        border-radius: var(--r-pill);
        background: var(--subtle);
        color: var(--text2);
        font-size: 12px;
        font-weight: 500;
      }

      .race.close {
        background: var(--warn-soft);
        color: var(--warn-ink);
      }

      .summary {
        padding: 14px 20px 16px;
        border-bottom: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .volume {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }

      .volume .done {
        font-size: 24px;
        line-height: 30px;
        font-weight: 600;
      }

      .volume .unit {
        font-size: 12px;
        color: var(--text2);
      }

      .bar {
        height: 6px;
        border-radius: var(--r-pill);
        background: var(--subtle);
        overflow: hidden;
      }

      .fill {
        display: block;
        height: 100%;
        border-radius: var(--r-pill);
        background: var(--accent);
        transition: width 0.4s ease;
      }

      .mini-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-top: 4px;
      }

      .mini-stat {
        display: flex;
        flex-direction: column;
      }

      .mini-stat .num {
        font-size: 14px;
        font-weight: 600;
      }

      .week-foot {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px 14px 20px;
        border-top: 1px solid var(--border);
      }

      .week-body {
        flex: 1;
        min-height: 0;
        padding: 4px 20px 20px;
      }

      @media (max-width: 1280px) {
        .week {
          display: none;
        }
      }

      .thread-head {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 28px;
        border-bottom: 1px solid var(--border);
        background: var(--surface);
      }

      .stream {
        flex: 1;
        min-height: 0;
        padding: 22px 28px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .day {
        align-self: center;
        font-size: 12px;
        font-weight: 600;
        color: var(--text3);
        background: var(--subtle);
        padding: 4px 10px;
        border-radius: var(--r-pill);
      }

      /* La pastille de l'auteur accompagne la bulle, alignée sur son bas ;
         le nom et l'heure restent en dehors, au-dessus et en dessous. */
      .bubble-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        min-width: 0;
      }

      .speaker {
        flex-shrink: 0;
      }

      /* Nom et heure se calent sur la bulle, pas sur la pastille. */
      .bubble-wrap.speaking .sender,
      .bubble-wrap.speaking .time {
        padding-left: 48px;
      }

      .bubble-wrap {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        max-width: 75%;
        /* Le message se pose au lieu d'apparaître d'un coup — à l'envoi comme
           à la réception, et au chargement du fil. */
        animation: message-in 0.22s cubic-bezier(0.2, 0.8, 0.3, 1) both;
      }

      @keyframes message-in {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.98);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .bubble-wrap {
          animation: none;
        }
      }

      .bubble-wrap.mine {
        align-self: flex-end;
        align-items: flex-end;
      }

      .bubble {
        padding: 12px 14px;
        border-radius: 4px 16px 16px 16px;
        background: var(--surface);
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .bubble.mine {
        background: var(--brand);
        color: var(--on-brand);
        border-color: var(--brand);
        border-radius: 16px 4px 16px 16px;
      }

      .text {
        font-size: 14px;
        line-height: 21px;
        white-space: pre-wrap;
      }

      .quoted {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        border-radius: var(--r-md);
        background: var(--bg);
        color: var(--ink);
        text-align: left;
        width: 290px;
        max-width: 100%;
      }

      .q-head {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .q-tile {
        width: 32px;
        height: 32px;
        border-radius: var(--r-sm);
        background: var(--accent-soft);
        color: var(--accent-ink);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .q-profile {
        opacity: 0.9;
      }

      .q-open {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 600;
        color: var(--accent-ink);
      }

      .composer {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px 28px 20px;
        border-top: 1px solid var(--border);
        background: var(--surface);
      }

      .composer-input {
        flex: 1;
        min-width: 0;
        height: 48px;
        border-radius: var(--r-pill);
        border: 1px solid var(--border);
        background: var(--bg);
        padding: 0 18px;
        outline: none;
      }

      .composer-input:focus {
        border-color: var(--accent);
      }

      .send {
        width: 48px;
        height: 48px;
        border-radius: var(--r-pill);
        background: var(--subtle);
        color: var(--text3);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .send.on {
        background: var(--accent);
        color: var(--on-accent);
      }

      .empty-thread {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .err {
        color: var(--danger);
        padding: 0 28px 16px;
      }
    `,
  ],
})
export class MessagesPage {
  private readonly chat = inject(ChatService);
  private readonly athleteApi = inject(AthleteService);
  private readonly coach = inject(CoachService);
  private readonly api = inject(ApiService);
  private readonly socket = inject(SocketService);
  private readonly badges = inject(BadgesService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  /** Ouvre directement la conversation avec cet athlète (lien depuis la fiche). */
  readonly athlete = input<string | undefined>(undefined);
  /** Conversation à ouvrir d'office, par exemple celle d'un groupe. */
  readonly conversation = input<string | undefined>(undefined);

  readonly conversations = load(() => this.chat.conversations$());

  /** Semaine affichée à droite : la sienne côté athlète, celle de l'interlocuteur côté coach. */
  readonly week = load<WeekPlanDay[]>(() => {
    if (!this.auth.isCoach()) return this.athleteApi.weekPlan$();
    const peer = this.activePeer();
    // Un groupe n'a pas de semaine à afficher : il n'a pas un planning, mais N.
    if (!peer?.peerId) return of<WeekPlanDay[]>([]);
    const start = startOfWeek(new Date());
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return this.coach
      .athleteCalendar$(peer.peerId, toIsoDay(start), toIsoDay(end))
      .pipe(map((calendar) => buildWeekPlan([buildPlanning(calendar, new Date())], start, new Date())));
  });

  readonly search = signal('');
  readonly filters = [
    { value: 'tous' as const, label: 'Tous' },
    { value: 'athletes' as const, label: 'Athlètes' },
    { value: 'groupes' as const, label: 'Groupes' },
  ];
  readonly filter = signal<'tous' | 'athletes' | 'groupes'>('tous');
  readonly activeId = signal<string | null>(null);
  readonly activePeer = signal<ConversationRow | null>(null);
  readonly messages = signal<ApiMessage[]>([]);
  readonly draft = signal('');
  readonly typing = signal(false);
  readonly sendError = signal('');

  private readonly stream = viewChild<ElementRef<HTMLElement>>('stream');

  /** Profils des séances citées, chargés une fois puis gardés en mémoire. */
  private readonly profiles = signal<Record<string, Segment[]>>({});
  private readonly profilesAsked = new Set<string>();

  private typingSent = false;
  private typingTimer: ReturnType<typeof setTimeout> | null = null;

  readonly groupCount = computed(() => (this.conversations.data() ?? []).filter((row) => row.kind === 'group').length);

  /**
   * L'athlète n'avait qu'une conversation, celle de son coach : la liste ne lui
   * servait à rien. Dès qu'il appartient à un groupe, il en a plusieurs.
   */
  readonly showList = computed(() => this.auth.isCoach() || this.groupCount() > 0);

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const kind = this.filter();
    return (this.conversations.data() ?? [])
      .filter((row) => (kind === 'tous' ? true : kind === 'groupes' ? row.kind === 'group' : row.kind === 'direct'))
      .filter((row) => (term ? row.name.toLowerCase().includes(term) : true));
  });

  readonly active = computed(() => this.activePeer());

  readonly thread = computed(() => mapMessages(this.messages(), this.auth.user()?.id ?? '', new Date()));

  constructor() {
    this.socket.on<{ conversationId: string; message?: ApiMessage }>('message:new', (payload) => {
      const message = (payload.message ?? payload) as unknown as ApiMessage;
      if (payload.conversationId !== this.activeId()) {
        this.conversations.reload(true);
        this.badges.refresh();
        return;
      }
      this.messages.update((messages) => (messages.some((item) => item._id === message._id) ? messages : [...messages, message]));
      this.markRead();
    });

    // Retiré d'un groupe : la discussion se referme sous nos yeux plutôt que
    // de rester ouverte sur un fil auquel on n'a plus accès.
    this.socket.on<{ conversationId: string }>('conversation:removed', (payload) => {
      if (this.activeId() === payload.conversationId) {
        this.activeId.set(null);
        this.activePeer.set(null);
        this.messages.set([]);
      }
      this.conversations.reload(true);
    });

    this.socket.on<{ conversationId: string }>('typing:start', (payload) => {
      if (payload.conversationId === this.activeId()) this.typing.set(true);
    });
    this.socket.on<{ conversationId: string }>('typing:stop', (payload) => {
      if (payload.conversationId === this.activeId()) this.typing.set(false);
    });

    // Les citations arrivent sans leur déroulé (la référence est figée à l'envoi) :
    // on va chercher le profil de chaque séance citée, une seule fois.
    effect(() => {
      for (const message of this.thread()) {
        const session = message.session;
        if (session) untracked(() => this.loadProfile(session));
      }
    });

    // On ouvre toujours la conversation sur le dernier message : c'est là qu'on
    // reprend le fil, et le composeur reste visible sous la pile.
    effect(() => {
      this.thread();
      const element = this.stream()?.nativeElement;
      if (!element) return;
      untracked(() => queueMicrotask(() => element.scrollTo({ top: element.scrollHeight })));
    });

    // Une conversation est ouverte d'office : un panneau vide n'apprend rien.
    // Côté athlète il n'y en a qu'une, celle du coach : on ne passe jamais par la liste.
    effect(() => {
      const rows = this.conversations.data();
      if (!rows || this.activeId()) return;
      if (!this.auth.isCoach()) {
        const wantedConversation = this.conversation();
        const target = wantedConversation ? rows.find((row) => row.conversationId === wantedConversation) : null;
        if (target) this.select(target);
        else this.openCoachConversation();
        return;
      }
      const wantedConversation = this.conversation();
      const wanted = this.athlete();
      const target =
        (wantedConversation && rows.find((row) => row.conversationId === wantedConversation)) ??
        (wanted && rows.find((row) => row.peerId === wanted)) ??
        rows[0];
      if (target) this.select(target);
    });
  }

  /** Prochaine compétition de l'athlète : seul le sien est chargé ici. */
  readonly race = load(() => (this.auth.isCoach() ? of(null) : this.athleteApi.nextCompetition$()));

  /** Kilomètres réalisés cette semaine, rapportés à ce qui était prévu. */
  readonly volume = computed(() => {
    const days = this.week.data() ?? [];
    const done = days.reduce((sum, day) => sum + day.activities.reduce((total, activity) => total + (activity.distanceKm ?? 0), 0), 0);
    const planned = days.reduce((sum, day) => sum + day.sessions.reduce((total, session) => total + (session.distanceKm ?? 0), 0), 0);
    return {
      done: formatDecimal(done, done % 1 ? 1 : 0),
      planned: formatDecimal(planned, planned % 1 ? 1 : 0),
      percent: planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : done > 0 ? 100 : 0,
    };
  });

  readonly counts = computed(() => {
    const days = this.week.data() ?? [];
    return {
      done: days.reduce((sum, day) => sum + day.activities.length, 0),
      planned: days.reduce((sum, day) => sum + day.sessions.length, 0),
    };
  });

  readonly timeLabel = computed(() => {
    const seconds = (this.week.data() ?? []).reduce((sum, day) => sum + day.activities.reduce((total, activity) => total + activity.durationSec, 0), 0);
    return seconds ? formatHoursMinutes(seconds) : '—';
  });

  /** Le prochain rendez-vous de la semaine : ce qui reste à faire, pas ce qui est passé. */
  readonly nextLabel = computed(() => {
    const today = toIsoDay(new Date());
    const day = (this.week.data() ?? []).find((item) => item.iso >= today && item.sessions.some((session) => session.status === 'planned'));
    if (!day) return '—';
    if (day.iso === today) return "Auj.";
    return formatDayShort(day.iso).split(' ')[0];
  });

  readonly planningLink = computed(() => {
    const peer = this.activePeer();
    return this.auth.isCoach() && peer ? `/coach/athletes/${peer.peerId}/planning` : '/planning';
  });

  readonly weekLabel = computed(() => {
    const start = startOfWeek(new Date());
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return `${formatDayShort(toIsoDay(start))} – ${formatDayShort(toIsoDay(end))}`;
  });

  profileOf(session: CitedSession) {
    const segments = this.profiles()[`${session.kind}:${session.id}`];
    return segments?.length ? segments : null;
  }

  /** Va chercher le déroulé d'une séance citée, côté athlète ou côté coach. */
  private loadProfile(session: CitedSession) {
    const key = `${session.kind}:${session.id}`;
    if (session.kind === 'strength' || this.profilesAsked.has(key)) return;
    const peer = this.activePeer();
    if (this.auth.isCoach() && !peer) return;
    this.profilesAsked.add(key);

    // Côté coach, la VMA de référence est celle de l'athlète : on laisse l'API
    // et les blocs décider plutôt que d'imposer celle du coach.
    const request =
      session.kind === 'run'
        ? this.auth.isCoach() && peer?.peerId
          ? this.coach.athleteRun$(peer.peerId, session.id).pipe(map((result) => result.detail.segments))
          : this.athleteApi.runDetail$(session.id).pipe(map((detail) => detail.segments))
        : this.auth.isCoach() && peer?.peerId
          ? this.coach.athleteSession$(peer.peerId, session.id).pipe(map((detail) => detail.segments))
          : this.athleteApi.plannedSession$(session.id).pipe(map((detail) => detail.segments));

    request.subscribe({
      next: (segments) => this.profiles.update((current) => ({ ...current, [key]: segments })),
      // Une séance supprimée depuis l'envoi : la carte reste lisible sans profil.
      error: () => undefined,
    });
  }

  /**
   * Cite une séance dans la conversation : le message porte une référence figée
   * (type « session »), que le fil affiche sous forme de carte cliquable.
   */
  quoteInChat(pick: WeekPick) {
    const conversationId = this.activeId();
    if (!conversationId) return;
    if (!this.socket.connect()) {
      this.sendError.set('Connexion au chat indisponible.');
      return;
    }
    const reference =
      pick.kind === 'planned'
        ? {
            kind: 'planned' as const,
            id: pick.session.id,
            sport: pick.session.sport,
            title: pick.session.title,
            date: pick.session.date,
            meta: this.plannedMeta(pick.session),
          }
        : {
            kind: pick.activity.sport === 'strength' ? ('strength' as const) : ('run' as const),
            id: pick.activity.id,
            sport: pick.activity.sport,
            title: pick.activity.title,
            date: pick.activity.date,
            meta: this.activityMeta(pick.activity),
          };
    this.sendError.set('');
    this.socket.emit('message:send', {
      conversationId,
      content: this.draft().trim() || reference.title,
      type: 'session',
      sessionRef: reference,
    });
    this.draft.set('');
  }

  private plannedMeta(session: PlannedSession) {
    if (session.sport === 'strength') return session.exercisesCount ? `${session.exercisesCount} exercices` : 'Renforcement';
    const parts: string[] = [];
    if (session.distanceKm) parts.push(`${formatDecimal(session.distanceKm, session.distanceKm % 1 ? 1 : 0)} km`);
    if (session.durationMin) parts.push(`${session.durationMin} min`);
    return parts.join(' · ');
  }

  private activityMeta(activity: Activity) {
    const parts = [formatHoursMinutes(activity.durationSec)];
    if (activity.distanceKm) parts.unshift(`${formatDecimal(activity.distanceKm, 1)} km`);
    return parts.join(' · ');
  }

  /** Séance planifiée du rail : la fiche côté coach, l'écran de séance côté athlète. */
  openPlanned(session: PlannedSession) {
    const peer = this.activePeer();
    if (this.auth.isCoach() && peer) {
      void this.router.navigate(['/coach/athletes', peer.peerId, 'seance', session.id]);
      return;
    }
    void this.router.navigate([session.sport === 'strength' ? '/muscu' : '/seance', session.id]);
  }

  openDone(activity: Activity) {
    const peer = this.activePeer();
    if (this.auth.isCoach() && peer) {
      void this.router.navigate(['/coach/athletes', peer.peerId, activity.sport === 'strength' ? 'muscu' : 'sortie', activity.id]);
      return;
    }
    void this.router.navigate([activity.sport === 'strength' ? '/muscu-realisee' : '/sorties', activity.id]);
  }

  select(row: ConversationRow) {
    this.activeId.set(row.conversationId);
    this.activePeer.set(row);
    this.typing.set(false);
    this.messages.set([]);
    this.socket.emit('conversation:join', { conversationId: row.conversationId });
    this.chat.messages$(row.conversationId).subscribe({ next: (messages) => this.messages.set(messages) });
    if (this.auth.isCoach()) this.week.reload();
    this.markRead();
  }

  send() {
    const text = this.draft().trim();
    const conversationId = this.activeId();
    if (!text || !conversationId) return;
    if (!this.socket.connect()) {
      this.sendError.set('Connexion au chat indisponible.');
      return;
    }
    this.sendError.set('');
    this.socket.emit('message:send', { conversationId, content: text, type: 'text' });
    this.socket.emit('typing:stop', { conversationId });
    this.typingSent = false;
    this.draft.set('');
  }

  onType(event: Event) {
    this.draft.set((event.target as HTMLInputElement).value);
    const conversationId = this.activeId();
    if (!conversationId) return;
    if (!this.typingSent) {
      this.socket.emit('typing:start', { conversationId });
      this.typingSent = true;
    }
    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => {
      this.socket.emit('typing:stop', { conversationId });
      this.typingSent = false;
    }, 2500);
  }

  openSession(session: { kind: string; id: string; sport?: string }) {
    const peer = this.activePeer();
    if (this.auth.isCoach() && peer) {
      const segment = session.kind === 'run' ? 'sortie' : session.kind === 'strength' ? 'muscu' : 'seance';
      void this.router.navigate(['/coach/athletes', peer.peerId, segment, session.id]);
      return;
    }
    const path = session.kind === 'run' ? '/sorties' : session.kind === 'strength' ? '/muscu' : '/seance';
    void this.router.navigate([path, session.id]);
  }

  openAthlete(peerId: string) {
    void this.router.navigate(['/coach/athletes', peerId]);
  }

  value(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  private openCoachConversation() {
    this.chat.coachConversation$().subscribe({
      next: (row) => {
        if (row) this.select(row);
      },
    });
  }

  private markRead() {
    const conversationId = this.activeId();
    if (!conversationId) return;
    this.chat.markRead(conversationId).subscribe({
      next: () => {
        this.api.invalidate('/api/chat');
        this.badges.refresh();
      },
    });
  }
}
