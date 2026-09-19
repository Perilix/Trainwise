import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { formatDayShort, formatDecimal, formatHoursMinutes } from '../../core/format';
import { load } from '../../core/load';
import { AuthService } from '../../core/auth.service';
import { ThemeService, type ThemeMode } from '../../core/theme.service';
import { AthleteService, type CompetitionPayload } from '../../data/athlete.service';
import { AvatarComponent } from '../../ui/avatar.component';
import { IconComponent } from '../../ui/icon.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { StatComponent } from '../../ui/stat.component';
import { StateViewComponent } from '../../ui/state-view.component';
import { YearChartComponent } from '../../ui/year-chart.component';

const LEVELS = [
  { value: 'debutant', label: 'Débutant' },
  { value: 'intermediaire', label: 'Intermédiaire' },
  { value: 'confirme', label: 'Confirmé' },
  { value: 'expert', label: 'Expert' },
];

const LINKS = [
  { label: 'À propos de Trainwise', icon: 'info', href: 'https://www.trainwise-app.com' },
  { label: 'Support et questions fréquentes', icon: 'help', href: 'mailto:contact@trainwise-app.com' },
  { label: 'Politique de confidentialité', icon: 'shield', href: 'https://www.trainwise-app.com/privacy' },
  { label: 'Nous contacter', icon: 'mail', href: 'mailto:contact@trainwise-app.com' },
];

@Component({
  selector: 'tw-athlete-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, PageHeaderComponent, RouterLink, StatComponent, StateViewComponent, YearChartComponent],
  template: `
    <main class="page">
      <tw-page-header title="Profil" />

      @if (profile.loading()) {
        <tw-state kind="loading" />
      } @else if (profile.error()) {
        <tw-state kind="error" [message]="profile.error()">
          <button class="btn btn-ghost btn-sm" (click)="profile.reload()">Réessayer</button>
        </tw-state>
      } @else if (profile.data(); as data) {
        <div class="cols">
          <div class="col">
            <section class="card card-pad">
              <div class="identity">
                <tw-avatar [initials]="data.initials" tone="brand" [size]="56" />
                <div class="stack grow">
                  <span class="h2">{{ data.fullName }}</span>
                  <span class="small muted">{{ data.email }}</span>
                </div>
              </div>
            </section>

            <section class="card card-pad">
              <div class="card-head">
                <h2 class="h2">Profil sportif</h2>
                <button class="link" type="button" (click)="startEdit()">{{ editing() ? 'Annuler' : 'Modifier' }}</button>
              </div>

              @if (editing()) {
                <div class="form">
                  <div class="field">
                    <label for="level">Niveau</label>
                    <select id="level" class="input" [value]="draft().runningLevel ?? ''" (change)="patch('runningLevel', value($event))">
                      @for (level of levels; track level.value) {
                        <option [value]="level.value">{{ level.label }}</option>
                      }
                    </select>
                  </div>
                  <div class="two">
                    <div class="field">
                      <label for="freq">Séances / semaine</label>
                      <input id="freq" class="input" inputmode="numeric" [value]="draft().weeklyFrequency ?? ''" (input)="patchNumber('weeklyFrequency', $event)" />
                    </div>
                    <div class="field">
                      <label for="vma">VMA (km/h)</label>
                      <input id="vma" class="input" inputmode="decimal" [value]="draft().vma ?? ''" (input)="patchNumber('vma', $event)" />
                    </div>
                  </div>
                  <div class="two">
                    <div class="field">
                      <label for="fcmax">FCmax (bpm)</label>
                      <input id="fcmax" class="input" inputmode="numeric" [value]="draft().fcmax ?? ''" (input)="patchNumber('fcmax', $event)" />
                    </div>
                    <div class="field">
                      <label for="height">Taille (cm)</label>
                      <input id="height" class="input" inputmode="numeric" [value]="draft().height ?? ''" (input)="patchNumber('height', $event)" />
                    </div>
                  </div>
                  <div class="two">
                    <div class="field">
                      <label for="weight">Poids (kg)</label>
                      <input id="weight" class="input" inputmode="decimal" [value]="draft().weight ?? ''" (input)="patchNumber('weight', $event)" />
                    </div>
                    <div class="field">
                      <label for="slot">Créneau</label>
                      <select id="slot" class="input" [value]="draft().preferredTime ?? ''" (change)="patch('preferredTime', value($event))">
                        <option value="matin">Matin</option>
                        <option value="midi">Midi</option>
                        <option value="soir">Soir</option>
                      </select>
                    </div>
                  </div>
                  <div class="field">
                    <label for="injuries">Blessures ou contraintes</label>
                    <textarea id="injuries" class="input" rows="2" [value]="draft().injuries ?? ''" (input)="patch('injuries', text($event))"></textarea>
                  </div>
                  <button class="btn btn-primary btn-block" type="button" [disabled]="savingProfile()" (click)="saveProfile()">
                    {{ savingProfile() ? 'Enregistrement…' : 'Enregistrer' }}
                  </button>
                </div>
              } @else {
                <div class="specs">
                  @for (spec of specs(); track spec.label) {
                    <div class="spec">
                      <span class="caption muted">{{ spec.label }}</span>
                      <span class="h3">{{ spec.value }}</span>
                    </div>
                  }
                </div>
              }
            </section>

            <section class="card card-pad">
              <a class="connector" routerLink="/compte">
                <span class="tile"><tw-icon name="user" [size]="20" /></span>
                <div class="stack grow">
                  <span class="h3">Mon compte</span>
                  <span class="small muted">Identité, email, mot de passe</span>
                </div>
                <tw-icon name="chevron-right" [size]="18" />
              </a>
              <a class="connector bordered" routerLink="/connecteurs">
                <span class="tile strava"><tw-icon name="activity" [size]="20" /></span>
                <div class="stack grow">
                  <span class="h3">Connecteurs</span>
                  <span class="small muted">{{ data.strava.connected ? 'Strava connecté' + sinceSuffix(data.strava.since) : 'Strava, Garmin, Polar…' }}</span>
                </div>
                <tw-icon name="chevron-right" [size]="18" />
              </a>
              <div class="connector bordered">
                <span class="tile coach"><tw-icon name="user" [size]="20" /></span>
                <div class="stack grow">
                  <span class="h3">Mon coach</span>
                  <span class="small muted">{{ data.coach ? data.coach.name + ' · ' + data.coach.since : 'Aucun coach' }}</span>
                </div>
                @if (!data.coach) {
                  <button class="btn btn-ghost btn-sm" type="button" (click)="joining.set(true)">Rejoindre</button>
                }
              </div>
              @if (joining()) {
                <div class="join">
                  <input class="input" placeholder="Code du coach" [value]="joinCode()" (input)="joinCode.set(value($event))" />
                  <button class="btn btn-primary" type="button" [disabled]="!joinCode()" (click)="joinCoach()">Valider</button>
                </div>
                @if (joinError()) {
                  <p class="err small">{{ joinError() }}</p>
                }
              }
            </section>

            <section class="card links">
              @for (link of links; track link.label) {
                <a class="link-row" [href]="link.href" target="_blank" rel="noopener">
                  <tw-icon [name]="link.icon" [size]="20" />
                  <span class="grow body">{{ link.label }}</span>
                  <tw-icon name="chevron-right" [size]="18" />
                </a>
              }
            </section>

            <section class="card card-pad">
              <div class="connector">
                <span class="tile"><tw-icon name="sun" [size]="20" /></span>
                <div class="stack grow">
                  <span class="h3">Apparence</span>
                  <span class="small muted">Clair, sombre ou selon l'appareil</span>
                </div>
              </div>
              <div class="segmented">
                @for (mode of modes; track mode.value) {
                  <button type="button" class="seg" [class.on]="theme.mode() === mode.value" (click)="theme.set(mode.value)">
                    {{ mode.label }}
                  </button>
                }
              </div>
            </section>

            <button class="btn btn-danger btn-block" type="button" (click)="auth.logout()">
              <tw-icon name="logout" [size]="18" [strokeWidth]="2" />
              Se déconnecter
            </button>
          </div>

          <div class="col">
            <section class="card card-pad">
              <div class="spread">
                <span class="h2">Statistiques</span>
                <div class="legend">
                  <span class="leg"><span class="line-now"></span>{{ stats.data()?.year }}</span>
                  <span class="leg"><span class="line-prev"></span>{{ (stats.data()?.year ?? 0) - 1 }}</span>
                </div>
              </div>

              @if (stats.data(); as volume) {
                <div class="headline">
                  <div class="big">
                    <span class="num">{{ round(volume.totals.distanceKm) }}</span>
                    <span class="unit">km en {{ volume.year }}</span>
                  </div>
                  @if (trend(); as label) {
                    <span class="chip chip-done"><tw-icon name="trending-up" [size]="13" [strokeWidth]="2" />{{ label }}</span>
                  }
                </div>
                <tw-year-chart [current]="volume.current" [previous]="volume.previous" [label]="'kilomètres ' + volume.year" />
                <div class="totals">
                  <tw-stat label="Courses" [value]="volume.totals.runs" />
                  <tw-stat label="Distance totale" [value]="round(volume.totals.distanceKm)" unit="km" />
                  <tw-stat label="Temps total" [value]="hours(volume.totals.durationSec)" />
                </div>
              } @else {
                <tw-state kind="loading" />
              }
            </section>

            <section class="card card-pad">
              <div class="card-head">
                <h2 class="h2">Compétitions</h2>
                <button class="link" type="button" (click)="openCompetition(null)">Ajouter une compétition</button>
              </div>

              @if (data.competitions.length) {
                <div class="comps">
                  @for (competition of data.competitions; track competition.id) {
                    <div class="comp">
                      <span class="prio" [class]="'p-' + competition.priority">{{ competition.priority }}</span>
                      <div class="stack grow">
                        <span class="h3">{{ competition.name }}</span>
                        <span class="small muted">{{ compLabel(competition.date, competition.goal) }}</span>
                        <span class="chip mt-sm">{{ competition.weeksLeftLabel }}</span>
                      </div>
                      <button class="icon-btn" type="button" (click)="openCompetition(competition.id)" aria-label="Modifier">
                        <tw-icon name="edit" [size]="18" />
                      </button>
                      <button class="icon-btn" type="button" (click)="removeCompetition(competition.id)" aria-label="Supprimer">
                        <tw-icon name="trash" [size]="18" />
                      </button>
                    </div>
                  }
                </div>
              } @else {
                <tw-state kind="empty" icon="flag" message="Aucune compétition prévue." />
              }
            </section>
          </div>
        </div>
      }

      @if (competitionOpen()) {
        <div class="scrim" (click)="competitionOpen.set(false)">
          <div class="modal card" (click)="$event.stopPropagation()">
            <div class="spread">
              <span class="h2">{{ competitionId() ? 'Modifier la compétition' : 'Ajouter une compétition' }}</span>
              <button class="icon-btn" type="button" (click)="competitionOpen.set(false)" aria-label="Fermer">
                <tw-icon name="close" [size]="18" />
              </button>
            </div>
            <div class="form">
              <div class="field">
                <label for="comp-name">Nom</label>
                <input id="comp-name" class="input" [value]="comp().name" (input)="patchComp('name', value($event))" />
              </div>
              <div class="two">
                <div class="field">
                  <label for="comp-date">Date</label>
                  <input id="comp-date" type="date" class="input" [value]="comp().date" (change)="patchComp('date', value($event))" />
                </div>
                <div class="field">
                  <label for="comp-prio">Priorité</label>
                  <select id="comp-prio" class="input" [value]="comp().priority" (change)="patchComp('priority', value($event))">
                    <option value="A">A — objectif principal</option>
                    <option value="B">B — intermédiaire</option>
                    <option value="C">C — préparation</option>
                  </select>
                </div>
              </div>
              <div class="two">
                <div class="field">
                  <label for="comp-disc">Discipline</label>
                  <input id="comp-disc" class="input" placeholder="Marathon, 10 km…" [value]="comp().discipline" (input)="patchComp('discipline', value($event))" />
                </div>
                <div class="field">
                  <label for="comp-goal">Objectif</label>
                  <input id="comp-goal" class="input" placeholder="3:15:00" [value]="comp().targetTime ?? ''" (input)="patchComp('targetTime', value($event))" />
                </div>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn btn-ghost grow" type="button" (click)="competitionOpen.set(false)">Annuler</button>
              <button class="btn btn-primary grow" type="button" [disabled]="!comp().name || !comp().date" (click)="saveCompetition()">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      }
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
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
        gap: 20px;
        align-items: start;
      }

      .col {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }

      .identity {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .specs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        margin-top: 16px;
      }

      .spec {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 16px;
      }

      .two {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .connector {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-bottom: 14px;
      }

      /* Ces lignes sont des <a> : sans ça elles héritaient du bleu des liens. */
      a.connector {
        color: var(--ink);
      }

      a.connector:hover .h3 {
        color: var(--accent);
      }

      a.connector tw-icon {
        color: var(--text3);
      }

      .connector.bordered {
        border-top: 1px solid var(--border);
        padding-top: 14px;
        padding-bottom: 0;
      }

      .tile {
        width: 40px;
        height: 40px;
        border-radius: var(--r-md);
        background: var(--subtle);
        color: var(--ink);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .tile.strava {
        background: var(--strava-soft);
        color: var(--strava-ink);
      }

      .tile.coach {
        background: var(--violet-soft);
        color: var(--violet-ink);
      }

      .join {
        display: flex;
        gap: 8px;
        margin-top: 14px;
      }

      .err {
        color: var(--danger);
        margin-top: 8px;
      }

      .links {
        padding: 0 20px;
      }

      .link-row {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 52px;
        color: var(--ink);
      }

      .link-row + .link-row {
        border-top: 1px solid var(--border);
      }

      .link-row:hover {
        color: var(--accent-ink);
      }

      .segmented {
        display: flex;
        padding: 3px;
        border-radius: var(--r-md);
        background: var(--subtle);
        gap: 2px;
        margin-top: 14px;
      }

      .seg {
        flex: 1;
        height: 34px;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 500;
        color: var(--text2);
      }

      .seg.on {
        background: var(--surface);
        color: var(--ink);
        font-weight: 600;
      }

      .legend {
        display: flex;
        gap: 16px;
      }

      .leg {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 500;
        color: var(--text2);
      }

      .line-now {
        width: 16px;
        height: 2px;
        background: var(--accent);
        border-radius: 2px;
      }

      .line-prev {
        width: 16px;
        border-top: 1.5px dashed var(--text3);
      }

      .headline {
        display: flex;
        align-items: center;
        gap: 14px;
        margin: 18px 0 10px;
      }

      .big {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }

      .big .num {
        font-size: 34px;
        line-height: 42px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }

      .big .unit {
        font-size: 15px;
        color: var(--text2);
      }

      .totals {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--border);
      }

      .comps {
        display: flex;
        flex-direction: column;
        margin-top: 12px;
      }

      .comp {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 0;
      }

      .comp + .comp {
        border-top: 1px solid var(--border);
      }

      .prio {
        width: 32px;
        height: 32px;
        border-radius: var(--r-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 13px;
        flex-shrink: 0;
        background: var(--subtle);
        color: var(--ink);
      }

      .prio.p-A {
        background: var(--brand);
        color: var(--on-brand);
      }

      .prio.p-B {
        background: var(--accent-soft);
        color: var(--accent-ink);
      }

      .icon-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--r-sm);
        color: var(--text2);
      }

      .icon-btn:hover {
        background: var(--subtle);
        color: var(--ink);
      }

      .mt-sm {
        margin-top: 8px;
        align-self: flex-start;
      }

      .scrim {
        position: fixed;
        inset: 0;
        background: var(--overlay);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 40;
      }

      .modal {
        width: 520px;
        max-width: calc(100vw - 48px);
        padding: 24px;
      }

      .modal-actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
      }
    `,
  ],
})
export class AthleteProfilePage {
  private readonly athlete = inject(AthleteService);
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);

  readonly levels = LEVELS;
  readonly links = LINKS;
  readonly modes: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: 'Clair' },
    { value: 'dark', label: 'Sombre' },
    { value: 'system', label: 'Auto' },
  ];

  readonly profile = load(() => this.athlete.profile$());
  readonly stats = load(() => this.athlete.yearlyVolume$());

  readonly editing = signal(false);
  readonly savingProfile = signal(false);
  readonly draft = signal<Record<string, string | number | undefined>>({});

  readonly joining = signal(false);
  readonly joinCode = signal('');
  readonly joinError = signal('');

  readonly competitionOpen = signal(false);
  readonly competitionId = signal<string | null>(null);
  readonly comp = signal<CompetitionPayload>({ name: '', date: '', discipline: '', targetTime: '', priority: 'A' });

  readonly specs = computed(() => {
    const data = this.profile.data();
    if (!data) return [];
    return [
      { label: 'Niveau', value: data.level },
      { label: 'Fréquence', value: data.runsPerWeek ? `${data.runsPerWeek} séances/sem.` : '—' },
      { label: 'VMA', value: data.vma ? `${formatDecimal(data.vma, 1)} km/h` : '—' },
      { label: 'FCmax', value: data.fcMax ? `${data.fcMax} bpm` : '—' },
      { label: 'Taille', value: data.heightCm ? `${data.heightCm} cm` : '—' },
      { label: 'Poids', value: data.weightKg ? `${data.weightKg} kg` : '—' },
    ];
  });

  readonly trend = computed(() => {
    const volume = this.stats.data();
    if (!volume) return null;
    const month = new Date().getMonth();
    const now = volume.current[month] ?? 0;
    const before = volume.previous[month] ?? 0;
    if (!before || !now) return null;
    const delta = Math.round(((now - before) / before) * 100);
    return `${delta >= 0 ? '+' : ''}${delta} % vs ${volume.year - 1} à date`;
  });

  startEdit() {
    if (this.editing()) {
      this.editing.set(false);
      return;
    }
    const user = this.auth.user();
    this.draft.set({
      runningLevel: user?.runningLevel,
      weeklyFrequency: user?.weeklyFrequency,
      vma: user?.vma,
      fcmax: user?.fcmax,
      height: user?.height,
      weight: user?.weight,
      preferredTime: user?.preferredTime,
      injuries: user?.injuries,
    });
    this.editing.set(true);
  }

  patch(key: string, value: string) {
    this.draft.update((draft) => ({ ...draft, [key]: value }));
  }

  patchNumber(key: string, event: Event) {
    const raw = (event.target as HTMLInputElement).value.replace(',', '.');
    const parsed = Number(raw);
    this.draft.update((draft) => ({ ...draft, [key]: raw === '' || !Number.isFinite(parsed) ? undefined : parsed }));
  }

  saveProfile() {
    this.savingProfile.set(true);
    this.auth.updateProfile(this.draft()).subscribe({
      next: () => {
        this.savingProfile.set(false);
        this.editing.set(false);
        this.profile.reload(true);
      },
      error: () => this.savingProfile.set(false),
    });
  }

  joinCoach() {
    this.joinError.set('');
    this.athlete.joinCoach(this.joinCode()).subscribe({
      next: () => {
        this.joining.set(false);
        this.joinCode.set('');
        this.profile.reload(true);
      },
      error: () => this.joinError.set("Ce code ne correspond à aucun coach."),
    });
  }

  openCompetition(id: string | null) {
    const existing = id ? this.profile.data()?.competitions.find((item) => item.id === id) : null;
    this.competitionId.set(id);
    this.comp.set({
      name: existing?.name ?? '',
      date: existing?.date ?? '',
      discipline: existing?.discipline ?? '',
      targetTime: existing?.goal ?? '',
      priority: existing?.priority ?? 'A',
    });
    this.competitionOpen.set(true);
  }

  patchComp(key: keyof CompetitionPayload, value: string) {
    this.comp.update((comp) => ({ ...comp, [key]: value }));
  }

  saveCompetition() {
    this.athlete.saveCompetition(this.competitionId(), this.comp()).subscribe({
      next: () => {
        this.competitionOpen.set(false);
        this.profile.reload(true);
      },
    });
  }

  removeCompetition(id: string) {
    this.athlete.deleteCompetition(id).subscribe({ next: () => this.profile.reload(true) });
  }

  sinceSuffix(since?: string) {
    return since ? ` · depuis le ${since}` : '';
  }

  compLabel(date: string, goal?: string) {
    return goal ? `${formatDayShort(date)} · Objectif ${goal}` : formatDayShort(date);
  }

  round(value: number) {
    return Math.round(value);
  }

  hours(value: number) {
    return formatHoursMinutes(value);
  }

  value(event: Event) {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  text(event: Event) {
    return (event.target as HTMLTextAreaElement).value;
  }
}
