import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { hostWidth } from './host-width';

import { ThemeService } from '../core/theme.service';
import { decodePolyline, projectPolyline } from '../domain/polyline';

/**
 * Tracé de la sortie. Le parcours réel est dessiné dès qu'il est disponible ;
 * les sorties sans GPS (tapis, saisie manuelle) gardent l'aperçu stylisé.
 */
@Component({
  selector: 'tw-route-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="width()" [attr.height]="height()" [attr.viewBox]="viewBox()" aria-hidden="true">
      <rect x="0" y="0" [attr.width]="width()" [attr.height]="height()" rx="12" [attr.fill]="map().bg" />
      @if (!hasRoute()) {
        <rect
          [attr.x]="width() * 0.62"
          [attr.y]="height() * 0.08"
          [attr.width]="width() * 0.22"
          [attr.height]="height() * 0.3"
          rx="6"
          [attr.fill]="map().park"
        />
      }
      @for (street of streets(); track $index) {
        <path [attr.d]="street.d" [attr.stroke]="map().street" [attr.stroke-width]="street.w" fill="none" />
      }
      <path [attr.d]="route()" fill="none" stroke="var(--surface)" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" />
      <path [attr.d]="route()" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
      <circle [attr.cx]="start()[0]" [attr.cy]="start()[1]" r="6" fill="var(--brand)" stroke="var(--surface)" stroke-width="2" />
    </svg>
  `,
  styles: [
    `
      /* Bloc pleine largeur : c'est cette largeur que le graphique mesure. */
      :host {
        display: block;
        width: 100%;
      }

      svg {
        display: block;
        border-radius: var(--r-sm);
      }
    `,
  ],
})
export class RoutePreviewComponent {
  private readonly theme = inject(ThemeService);

  /** Largeur imposée ; sinon le graphique prend toute la largeur disponible. */
  readonly fixedWidth = input<number | undefined>(undefined, { alias: 'width' });
  private readonly measuredWidth = hostWidth(338);
  readonly width = computed(() => this.fixedWidth() ?? this.measuredWidth());
  readonly height = input(132);
  readonly polyline = input<string | null | undefined>(null);
  readonly seed = input(1);

  readonly viewBox = computed(() => `0 0 ${this.width()} ${this.height()}`);

  readonly map = computed(() =>
    this.theme.resolved() === 'dark'
      ? { bg: '#15222C', street: '#1D2C37', park: '#16302A' }
      : { bg: '#EDE9E1', street: '#E4DED3', park: '#DDE9D8' },
  );

  private readonly real = computed(() => {
    const encoded = this.polyline();
    return encoded ? projectPolyline(decodePolyline(encoded), this.width(), this.height()) : null;
  });

  readonly hasRoute = computed(() => Boolean(this.real()));

  private readonly fallbackPoints = computed(() => {
    const width = this.width();
    const height = this.height();
    const seed = this.seed();
    return Array.from({ length: 41 }, (_, index) => {
      const angle = (index / 40) * Math.PI * 2;
      const radius = 0.36 + 0.07 * Math.sin(angle * 3 + seed) + 0.04 * Math.cos(angle * 5 + seed * 2);
      return [width / 2 + Math.cos(angle) * radius * width * 0.95, height / 2 + Math.sin(angle) * radius * height * 0.9] as const;
    });
  });

  readonly route = computed(
    () =>
      this.real() ??
      this.fallbackPoints()
        .map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
        .join(' '),
  );

  readonly start = computed(() => {
    const real = this.real();
    if (real) return real.slice(1).split(' ').slice(0, 2).map(Number);
    const [x, y] = this.fallbackPoints()[0];
    return [x, y];
  });

  readonly streets = computed(() => {
    const width = this.width();
    const height = this.height();
    const seed = this.seed();
    return [
      ...[1, 2, 3, 4, 5].map((index) => ({
        d: `M0 ${(height / 6) * index + ((seed * 7) % 13)} L${width} ${(height / 6) * index - 18 + ((seed * 11) % 17)}`,
        w: index % 2 ? 6 : 3,
      })),
      ...[1, 2, 3, 4].map((index) => ({
        d: `M${(width / 5) * index + ((seed * 13) % 19)} 0 L${(width / 5) * index - 30} ${height}`,
        w: index % 2 ? 3 : 5,
      })),
    ];
  });
}
