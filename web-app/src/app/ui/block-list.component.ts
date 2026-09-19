import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { ThemeService } from '../core/theme.service';
import type { RunBlockView } from '../domain/athlete.types';
import { formatDuration, intensityColor } from '../domain/sessions';

const RAMP = {
  light: ['#CDEBFB', '#8FD2F8', '#3DB4F5', '#0A8ED6', '#05608F'],
  dark: ['#173447', '#1D5577', '#1E80B8', '#2AAAF0', '#8AD8FF'],
};

/**
 * Déroulé d'une séance, bloc par bloc, comme sur mobile : une barre d'intensité
 * à gauche, le rôle et la durée en tête, puis la ligne qui se lit d'un trait —
 * « 2 × 12 min · 4:25 /km ». Les blocs à étapes multiples se déplient dessous.
 */
@Component({
  selector: 'tw-block-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="blocks">
      @for (block of rows(); track block.key) {
        <div class="block">
          <span class="bar" [style.background]="block.color"></span>
          <div class="body">
            <div class="head">
              <span class="overline grow">{{ block.roleLabel }}</span>
              @if (block.durationSec) {
                <span class="caption muted num">{{ duration(block.durationSec) }}</span>
              }
            </div>

            @if (block.single; as step) {
              <span class="line">
                @if (block.repetitions > 1) {
                  <span class="times">{{ block.repetitions }} × </span>
                }
                {{ step.label }}
                @if (step.paceLabel) {
                  <span class="pace"> · {{ step.paceLabel }}</span>
                }
              </span>
            } @else {
              @if (block.repetitions > 1) {
                <span class="line">{{ block.repetitions }} × la série</span>
              }
              <div class="group">
                @for (step of block.steps; track step.key) {
                  <div class="step">
                    <span class="line small-line">
                      {{ step.label }}
                      @if (step.paceLabel) {
                        <span class="pace"> · {{ step.paceLabel }}</span>
                      }
                    </span>
                    @if (step.recoveryLabel) {
                      <span class="small muted">{{ step.recoveryLabel }}</span>
                    }
                    @if (step.note) {
                      <span class="small muted">{{ step.note }}</span>
                    }
                  </div>
                }
              </div>
            }

            @if (block.recoveryLabel) {
              <span class="small muted">{{ block.recoveryLabel }}</span>
            }
            @if (block.note) {
              <span class="small muted">{{ block.note }}</span>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .blocks {
        display: flex;
        flex-direction: column;
      }

      .block {
        display: flex;
        gap: 12px;
        padding: 12px 0;
      }

      .block + .block {
        border-top: 1px solid var(--border);
      }

      /* Barre d'intensité : la couleur dit l'effort, la lecture est immédiate. */
      .bar {
        width: 4px;
        border-radius: var(--r-pill);
        flex-shrink: 0;
      }

      .body {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        flex: 1;
      }

      .head {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }

      .line {
        font-size: 16px;
        line-height: 24px;
        font-weight: 600;
      }

      .small-line {
        font-size: 14px;
        line-height: 21px;
        font-weight: 500;
      }

      .times {
        color: var(--text2);
      }

      .pace {
        color: var(--accent-ink);
      }

      .group {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 2px;
      }

      .step {
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding-left: 12px;
        border-left: 2px solid var(--border);
      }
    `,
  ],
})
export class BlockListComponent {
  private readonly theme = inject(ThemeService);

  readonly blocks = input.required<RunBlockView[]>();

  readonly rows = computed(() => {
    const ramp = RAMP[this.theme.resolved()];
    return this.blocks().map((block) => ({
      ...block,
      single: block.steps.length === 1 ? block.steps[0] : null,
      color: intensityColor(Math.max(...block.steps.map((step) => step.pct)), ramp),
    }));
  });

  duration(seconds: number) {
    return formatDuration(seconds);
  }
}
