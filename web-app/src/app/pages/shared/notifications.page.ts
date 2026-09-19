import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { BadgesService } from '../../core/badges.service';
import { load } from '../../core/load';
import { AthleteService } from '../../data/athlete.service';
import type { AthleteNotification, NotificationKind } from '../../domain/athlete.types';
import { IconComponent } from '../../ui/icon.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { StateViewComponent } from '../../ui/state-view.component';

/** Tuile d'icône par type : code de lecture propre à cet écran (DA §6.12). */
const KIND_STYLE: Record<string, { icon: string; tone: string }> = {
  'session-updated': { icon: 'edit', tone: 'violet' },
  'session-planned': { icon: 'calendar', tone: 'violet' },
  'week-published': { icon: 'calendar', tone: 'violet' },
  'session-reminder': { icon: 'clock', tone: 'accent' },
  'session-done': { icon: 'check', tone: 'success' },
  feedback: { icon: 'quote', tone: 'violet' },
  message: { icon: 'chat', tone: 'accent' },
  'strava-import': { icon: 'refresh', tone: 'strava' },
  'friend-request': { icon: 'friends', tone: 'accent' },
  invitation: { icon: 'mail', tone: 'violet' },
  record: { icon: 'trophy', tone: 'warn' },
  competition: { icon: 'flag', tone: 'warn' },
  subscription: { icon: 'crown', tone: 'violet' },
  alert: { icon: 'alert', tone: 'danger' },
  other: { icon: 'info', tone: 'subtle' },
};

const FILTERS: { value: string; label: string; icon: string; kinds?: NotificationKind[] }[] = [
  { value: 'all', label: 'Toutes', icon: 'bell' },
  { value: 'unread', label: 'Non lues', icon: 'eye' },
  { value: 'sessions', label: 'Séances', icon: 'run', kinds: ['session-updated', 'session-planned', 'session-done', 'session-reminder', 'week-published'] },
  { value: 'messages', label: 'Messages', icon: 'chat', kinds: ['message', 'feedback'] },
  { value: 'account', label: 'Compte', icon: 'user', kinds: ['subscription', 'invitation', 'friend-request'] },
  { value: 'alerts', label: 'Alertes', icon: 'alert', kinds: ['alert', 'record', 'competition'] },
];

const GROUP_LABELS: Record<AthleteNotification['group'], string> = {
  today: "Aujourd'hui",
  yesterday: 'Hier',
  week: 'Cette semaine',
  older: 'Plus ancien',
};

@Component({
  selector: 'tw-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PageHeaderComponent, StateViewComponent],
  template: `
    <main class="page">
      <tw-page-header title="Notifications" subtitle="Ce qui demande votre attention.">
        <button class="btn btn-ghost" type="button" [disabled]="!unreadCount()" (click)="markAll()">
          <tw-icon name="check" [size]="18" [strokeWidth]="2" />
          Tout marquer comme lu
        </button>
      </tw-page-header>

      <div class="cols">
        <aside class="side">
          <section class="card filters">
            @for (filter of filters; track filter.value) {
              <button type="button" class="filter" [class.on]="active() === filter.value" (click)="active.set(filter.value)">
                <tw-icon [name]="filter.icon" [size]="18" />
                <span class="grow">{{ filter.label }}</span>
                <span class="count">{{ countOf(filter.value) }}</span>
              </button>
            }
          </section>
        </aside>

        <div class="feed">
          @if (notifications.loading()) {
            <tw-state kind="loading" />
          } @else if (notifications.error()) {
            <tw-state kind="error" [message]="notifications.error()">
              <button class="btn btn-ghost btn-sm" (click)="notifications.reload()">Réessayer</button>
            </tw-state>
          } @else {
            @for (group of grouped(); track group.label) {
              <span class="group-label">{{ group.label }}</span>
              <section class="card group">
                @for (item of group.items; track item.id) {
                  <div class="note" [class.unread]="item.unread" (click)="open(item)">
                    <span class="tile" [class]="styleOf(item.kind).tone">
                      <tw-icon [name]="styleOf(item.kind).icon" [size]="20" />
                    </span>
                    <div class="grow stack">
                      <p class="body">{{ item.title }}</p>
                      <p class="small muted">{{ item.body }}</p>
                    </div>
                    <div class="meta">
                      <span class="caption muted-3">{{ item.timeLabel }}</span>
                      @if (item.unread) {
                        <span class="pin"></span>
                      }
                    </div>
                  </div>
                }
              </section>
            } @empty {
              <div class="card card-pad">
                <tw-state kind="empty" icon="bell" message="Aucune notification." />
              </div>
            }
          }
        </div>
      </div>
    </main>
  `,
  styles: [
    `
      .page {
        flex: 1;
        min-width: 0;
        padding: 32px 40px 40px;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .cols {
        display: grid;
        grid-template-columns: 280px minmax(0, 1fr);
        gap: 20px;
        align-items: start;
      }

      .filters {
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .filter {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 42px;
        padding: 0 12px;
        border-radius: var(--r-md);
        color: var(--text2);
        font-size: 14px;
        font-weight: 500;
        text-align: left;
      }

      .filter:hover {
        background: var(--bg);
      }

      .filter.on {
        background: var(--subtle);
        color: var(--ink);
        font-weight: 600;
      }

      .count {
        font-size: 12px;
        font-weight: 600;
        color: var(--text3);
      }

      .feed {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
      }

      .group-label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text3);
        margin-top: 12px;
      }

      .group {
        padding: 0 20px;
      }

      .note {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 16px 0;
        cursor: pointer;
      }

      .note + .note {
        border-top: 1px solid var(--border);
      }

      .tile {
        width: 40px;
        height: 40px;
        border-radius: var(--r-md);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        background: var(--subtle);
        color: var(--ink);
      }

      .tile.violet {
        background: var(--violet-soft);
        color: var(--violet-ink);
      }

      .tile.accent {
        background: var(--accent-soft);
        color: var(--accent-ink);
      }

      .tile.success {
        background: var(--success-soft);
        color: var(--success-ink);
      }

      .tile.strava {
        background: var(--strava-soft);
        color: var(--strava-ink);
      }

      .tile.warn {
        background: var(--warn-soft);
        color: var(--warn-ink);
      }

      .tile.danger {
        background: var(--danger-soft);
        color: var(--danger);
      }

      .meta {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .pin {
        width: 8px;
        height: 8px;
        border-radius: var(--r-pill);
        background: var(--danger);
      }
    `,
  ],
})
export class NotificationsPage {
  private readonly athlete = inject(AthleteService);
  private readonly badges = inject(BadgesService);
  private readonly router = inject(Router);

  readonly filters = FILTERS;
  readonly active = signal('all');

  readonly notifications = load(() => this.athlete.notifications$());

  readonly unreadCount = computed(() => (this.notifications.data() ?? []).filter((item) => item.unread).length);

  readonly filtered = computed(() => {
    const all = this.notifications.data() ?? [];
    const filter = FILTERS.find((item) => item.value === this.active());
    if (!filter || filter.value === 'all') return all;
    if (filter.value === 'unread') return all.filter((item) => item.unread);
    return all.filter((item) => filter.kinds?.includes(item.kind));
  });

  readonly grouped = computed(() => {
    const groups: AthleteNotification['group'][] = ['today', 'yesterday', 'week', 'older'];
    return groups
      .map((group) => ({ label: GROUP_LABELS[group], items: this.filtered().filter((item) => item.group === group) }))
      .filter((group) => group.items.length);
  });

  countOf(value: string) {
    const all = this.notifications.data() ?? [];
    if (value === 'all') return all.length;
    if (value === 'unread') return all.filter((item) => item.unread).length;
    const filter = FILTERS.find((item) => item.value === value);
    return all.filter((item) => filter?.kinds?.includes(item.kind)).length;
  }

  styleOf(kind: string) {
    return KIND_STYLE[kind] ?? KIND_STYLE['other'];
  }

  open(item: AthleteNotification) {
    if (item.unread) {
      this.athlete.markNotificationRead(item.id).subscribe({
        next: () => {
          this.notifications.reload(true);
          this.badges.refresh();
        },
      });
    }
    if (item.actionUrl) void this.router.navigateByUrl(item.actionUrl);
  }

  markAll() {
    this.athlete.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.reload(true);
        this.badges.markNotificationsRead();
      },
    });
  }
}
