import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { ApiError } from '../core/api.service';
import { formatDayShort, toIsoDay } from '../core/format';
import { CoachService } from '../data/coach.service';
import { IconComponent } from './icon.component';

/**
 * Le retour du coach sur une séance réalisée.
 *
 * Le même bloc des deux côtés : le coach l'écrit et le corrige, l'athlète le
 * lit. Un seul retour par séance — il se modifie, il ne s'empile pas ; une
 * discussion se tient dans la messagerie, pas sous une sortie.
 */
@Component({
  selector: 'tw-coach-feedback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <section class="card card-pad">
      <div class="spread">
        <span class="h2">{{ editable() ? 'Mon retour' : 'Le retour de ton coach' }}</span>
        @if (savedAt(); as at) {
          <span class="caption muted">{{ dayLabel(at) }}</span>
        }
      </div>

      @if (editable()) {
        @if (editing()) {
          <textarea
            class="input mt"
            rows="4"
            placeholder="Ce que tu as vu de cette séance : ce qui va, ce qu'il faut ajuster la prochaine fois."
            [value]="draft()"
            (input)="draft.set(text($event))"
          ></textarea>
          <div class="row">
            @if (error()) {
              <span class="small err grow">{{ error() }}</span>
            } @else {
              <span class="caption muted-3 grow">L'athlète est prévenu à ton premier retour, pas à chaque correction.</span>
            }
            <button class="btn btn-ghost btn-sm" type="button" (click)="cancel()">Annuler</button>
            <button class="btn btn-primary btn-sm" type="button" [disabled]="saving()" (click)="save()">
              {{ saving() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
          </div>
        } @else if (current()) {
          <p class="quote">« {{ current() }} »</p>
          <div class="row">
            <span class="grow"></span>
            <button class="btn btn-ghost btn-sm" type="button" (click)="edit()">
              <tw-icon name="edit" [size]="16" [strokeWidth]="2" />
              Modifier
            </button>
          </div>
        } @else {
          <p class="small muted mt-sm">Pas encore de retour sur cette séance.</p>
          <button class="btn btn-ghost btn-sm mt-sm" type="button" (click)="edit()">
            <tw-icon name="edit" [size]="16" [strokeWidth]="2" />
            Écrire un retour
          </button>
        }
      } @else if (current()) {
        <p class="quote">« {{ current() }} »</p>
      } @else {
        <p class="small muted mt-sm">Ton coach n'a pas encore commenté cette séance.</p>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .quote {
        margin: 12px 0 0;
        padding-left: 12px;
        border-left: 2px solid var(--border-strong);
        color: var(--text2);
        font-style: italic;
      }

      .row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
      }

      .mt {
        margin-top: 12px;
      }

      .mt-sm {
        margin-top: 8px;
      }

      .err {
        color: var(--danger);
      }
    `,
  ],
})
export class CoachFeedbackComponent {
  private readonly coach = inject(CoachService);

  readonly athleteId = input<string>('');
  readonly kind = input<'run' | 'strength'>('run');
  readonly sessionId = input<string>('');
  readonly feedback = input<{ text: string | null; at: string | null } | null | undefined>(null);
  /** Vrai côté coach : lui seul écrit. */
  readonly editable = input(false);
  readonly saved = output<void>();

  readonly editing = signal(false);
  readonly draft = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  /** Ce qu'on vient d'enregistrer, tant que l'écran n'a pas rechargé. */
  private readonly local = signal<{ text: string | null; at: string | null } | null>(null);

  readonly current = computed(() => (this.local() ?? this.feedback())?.text ?? '');
  readonly savedAt = computed(() => (this.local() ?? this.feedback())?.at ?? null);

  dayLabel(at: string) {
    return formatDayShort(toIsoDay(new Date(at)));
  }

  edit() {
    this.draft.set(this.current());
    this.error.set('');
    this.editing.set(true);
  }

  cancel() {
    this.editing.set(false);
    this.error.set('');
  }

  save() {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    const text = this.draft().trim();
    this.coach.setSessionFeedback(this.athleteId(), this.kind(), this.sessionId(), text).subscribe({
      next: ({ coachFeedback }) => {
        this.saving.set(false);
        this.editing.set(false);
        this.local.set(coachFeedback);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
      },
    });
  }

  text(event: Event) {
    return (event.target as HTMLTextAreaElement).value;
  }
}
