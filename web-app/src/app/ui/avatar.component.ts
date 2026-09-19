import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Pastille d'initiales. `tone` suit le code couleur : violet = coach, bleu = athlète. */
@Component({
  selector: 'tw-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src()) {
      <img [src]="src()" [alt]="initials()" [style.width.px]="size()" [style.height.px]="size()" />
    } @else {
      <span
        class="fallback"
        [class]="tone()"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="fontSize()"
        >{{ initials() }}</span
      >
    }
    @if (online()) {
      <span class="online" [style.width.px]="dotSize()" [style.height.px]="dotSize()"></span>
    }
  `,
  styles: [
    `
      :host {
        position: relative;
        display: inline-flex;
        flex-shrink: 0;
      }

      img,
      .fallback {
        border-radius: var(--r-pill);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        letter-spacing: 0.02em;
        object-fit: cover;
      }

      .violet {
        background: var(--violet-soft);
        color: var(--violet-ink);
      }

      .accent {
        background: var(--accent-soft);
        color: var(--accent-ink);
      }

      .subtle {
        background: var(--subtle);
        color: var(--ink);
      }

      .brand {
        background: var(--highlight);
        color: #003554;
      }

      .online {
        position: absolute;
        right: 0;
        bottom: 0;
        border-radius: var(--r-pill);
        background: var(--success);
        box-shadow: 0 0 0 2px var(--surface);
      }
    `,
  ],
})
export class AvatarComponent {
  readonly initials = input('');
  readonly src = input<string | null | undefined>(null);
  readonly size = input(40);
  readonly tone = input<'violet' | 'accent' | 'subtle' | 'brand'>('accent');
  readonly online = input(false);

  readonly fontSize = computed(() => Math.max(11, Math.round(this.size() * 0.36)));
  readonly dotSize = computed(() => Math.max(8, Math.round(this.size() * 0.24)));
}
