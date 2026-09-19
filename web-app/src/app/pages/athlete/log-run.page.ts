import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

import { formatPace, toIsoDay } from '../../core/format';
import { AthleteService } from '../../data/athlete.service';
import { IconComponent } from '../../ui/icon.component';
import { PageHeaderComponent } from '../../ui/page-header.component';

const TYPES = [
  { value: 'endurance', label: 'Endurance' },
  { value: 'fractionne', label: 'Fractionné' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'sortie_longue', label: 'Sortie longue' },
  { value: 'recuperation', label: 'Récupération' },
  { value: 'cotes', label: 'Côtes' },
];

/** Sortie saisie à la main, quand Strava ne l'a pas importée. */
@Component({
  selector: 'tw-log-run',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PageHeaderComponent],
  template: `
    <main class="page">
      <button type="button" class="back" (click)="goBack()">
        <tw-icon name="chevron-left" [size]="16" />
        <span class="small">Sorties</span>
      </button>

      <tw-page-header title="Enregistrer une séance" subtitle="Ce que Strava n'a pas importé se saisit ici." />

      <div class="cols">
        <section class="card card-pad">
          <div class="form">
            <div class="two">
              <div class="field">
                <label for="date">Date</label>
                <input id="date" type="date" class="input" [value]="date()" (change)="date.set(value($event))" />
              </div>
              <div class="field">
                <label for="type">Type</label>
                <select id="type" class="input" [value]="type()" (change)="type.set(value($event))">
                  @for (option of types; track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="two">
              <div class="field">
                <label for="distance">Distance (km)</label>
                <input id="distance" class="input" inputmode="decimal" placeholder="10,5" [value]="distance()" (input)="distance.set(value($event))" />
              </div>
              <div class="field">
                <label for="duration">Durée (min)</label>
                <input id="duration" class="input" inputmode="numeric" placeholder="55" [value]="duration()" (input)="duration.set(value($event))" />
              </div>
            </div>

            <div class="field">
              <label for="feeling">Ressenti — {{ feeling() }}/10</label>
              <input id="feeling" class="slider" type="range" min="1" max="10" [value]="feeling()" (input)="feeling.set(number($event))" />
            </div>

            <div class="field">
              <label for="notes">Notes</label>
              <textarea id="notes" class="input" rows="3" [value]="notes()" (input)="notes.set(text($event))"></textarea>
            </div>

            @if (error()) {
              <p class="err small">{{ error() }}</p>
            }

            <div class="actions">
              <button class="btn btn-ghost grow" type="button" (click)="goBack()">Annuler</button>
              <button class="btn btn-primary grow" type="button" [disabled]="saving()" (click)="save()">
                {{ saving() ? 'Enregistrement…' : 'Enregistrer' }}
              </button>
            </div>
          </div>
        </section>

        <section class="card card-pad">
          <span class="h2">Aperçu</span>
          <div class="preview">
            <div class="line"><span class="grow body muted">Allure calculée</span><span class="h3 num">{{ pace() }}</span></div>
            <div class="line"><span class="grow body muted">Date</span><span class="h3">{{ date() }}</span></div>
          </div>
          <p class="caption muted mt">
            L'API rapproche d'elle-même cette sortie de la séance prévue le même jour, et prévient ton coach.
          </p>
        </section>
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
        gap: 20px;
      }

      .back {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--text2);
        font-weight: 500;
      }

      .cols {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
        gap: 20px;
        align-items: start;
      }

      .form {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .two {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .slider {
        width: 100%;
        accent-color: var(--brand);
      }

      .actions {
        display: flex;
        gap: 10px;
        margin-top: 6px;
      }

      .err {
        color: var(--danger);
        margin: 0;
      }

      .preview {
        display: flex;
        flex-direction: column;
        margin-top: 10px;
      }

      .line {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
      }

      .line + .line {
        border-top: 1px solid var(--border);
      }

      .mt {
        display: block;
        margin-top: 12px;
      }
    `,
  ],
})
export class LogRunPage {
  private readonly athlete = inject(AthleteService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly types = TYPES;

  readonly date = signal(toIsoDay(new Date()));
  readonly type = signal('endurance');
  readonly distance = signal('');
  readonly duration = signal('');
  readonly feeling = signal(7);
  readonly notes = signal('');
  readonly saving = signal(false);
  readonly error = signal('');

  readonly pace = computed(() => {
    const km = Number(this.distance().replace(',', '.'));
    const minutes = Number(this.duration());
    if (!km || !minutes) return '—';
    return `${formatPace((minutes * 60) / km)} /km`;
  });

  save() {
    const km = Number(this.distance().replace(',', '.'));
    const minutes = Number(this.duration());
    if (!km && !minutes) {
      this.error.set('Indique au moins une distance ou une durée.');
      return;
    }
    this.error.set('');
    this.saving.set(true);
    this.athlete
      .logRun({
        date: this.date(),
        distanceKm: km || undefined,
        durationMin: minutes || undefined,
        feeling: this.feeling(),
        notes: this.notes(),
        sessionType: this.type(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          void this.router.navigate(['/sorties']);
        },
        error: () => {
          this.saving.set(false);
          this.error.set("La sortie n'a pas pu être enregistrée.");
        },
      });
  }

  goBack() {
    if (history.length > 1) this.location.back();
    else void this.router.navigate(['/sorties']);
  }

  value(event: Event) {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  text(event: Event) {
    return (event.target as HTMLTextAreaElement).value;
  }

  number(event: Event) {
    return Number((event.target as HTMLInputElement).value);
  }
}
