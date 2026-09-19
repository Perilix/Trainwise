import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { decodePolyline, type LatLng } from '../domain/polyline';
import { hostWidth } from './host-width';
import { RoutePreviewComponent } from './route-preview.component';

const TILE = 256;
const MAX_ZOOM = 17;
const MIN_ZOOM = 2;
const PADDING = 24;

type Tile = { key: string; url: string; x: number; y: number };

/** Projection Web Mercator, en pixels du monde au niveau de zoom donné. */
function project(point: LatLng, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((point.lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/**
 * Carte du parcours d'une sortie : tuiles OpenStreetMap et tracé par-dessus.
 * Vue figée (pas de déplacement ni de zoom) — c'est un aperçu, pas un outil de
 * navigation, et ça évite d'embarquer une bibliothèque de cartographie.
 * Sans GPS (tapis, saisie manuelle), on retombe sur l'aperçu dessiné.
 */
@Component({
  selector: 'tw-route-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RoutePreviewComponent],
  template: `
    @if (view(); as map) {
      <div class="frame" [style.height.px]="height()">
        @for (tile of map.tiles; track tile.key) {
          <img class="tile" [src]="tile.url" [style.left.px]="tile.x" [style.top.px]="tile.y" alt="" loading="lazy" decoding="async" />
        }
        <svg class="route" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" [attr.width]="width()" [attr.height]="height()" aria-hidden="true">
          <path [attr.d]="map.path" fill="none" stroke="#ffffff" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="0.9" />
          <path [attr.d]="map.path" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" />
          <circle [attr.cx]="map.start.x" [attr.cy]="map.start.y" r="7" fill="var(--brand)" stroke="#ffffff" stroke-width="2.5" />
          <circle [attr.cx]="map.end.x" [attr.cy]="map.end.y" r="7" fill="var(--success)" stroke="#ffffff" stroke-width="2.5" />
        </svg>
        <a class="credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>
      </div>
    } @else {
      <tw-route-preview [polyline]="polyline()" [height]="height()" [seed]="seed()" />
    }
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .frame {
        position: relative;
        width: 100%;
        overflow: hidden;
        border-radius: var(--r-sm);
        background: var(--subtle);
      }

      .tile {
        position: absolute;
        width: 256px;
        height: 256px;
        user-select: none;
        pointer-events: none;
      }

      .route {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .credit {
        position: absolute;
        right: 6px;
        bottom: 4px;
        font-size: 10px;
        line-height: 14px;
        padding: 0 4px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.75);
        color: #333;
      }
    `,
  ],
})
export class RouteMapComponent {
  readonly polyline = input<string | null | undefined>(null);
  readonly height = input(320);
  readonly seed = input(1);

  readonly fixedWidth = input<number | undefined>(undefined, { alias: 'width' });
  private readonly measuredWidth = hostWidth(662);
  readonly width = computed(() => this.fixedWidth() ?? this.measuredWidth());

  private readonly points = computed(() => {
    const encoded = this.polyline();
    return encoded ? decodePolyline(encoded) : [];
  });

  readonly view = computed(() => {
    const points = this.points();
    const width = this.width();
    const height = this.height();
    if (points.length < 2 || width < 40) return null;

    const lats = points.map((point) => point.lat);
    const lngs = points.map((point) => point.lng);
    const bounds = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs),
    };

    // Le zoom le plus serré qui garde tout le parcours dans le cadre.
    let zoom = MAX_ZOOM;
    while (zoom > MIN_ZOOM) {
      const a = project({ lat: bounds.north, lng: bounds.west }, zoom);
      const b = project({ lat: bounds.south, lng: bounds.east }, zoom);
      if (Math.abs(b.x - a.x) <= width - PADDING * 2 && Math.abs(b.y - a.y) <= height - PADDING * 2) break;
      zoom -= 1;
    }

    const center = project({ lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 }, zoom);
    const originX = center.x - width / 2;
    const originY = center.y - height / 2;

    const tiles: Tile[] = [];
    const count = 2 ** zoom;
    const firstX = Math.floor(originX / TILE);
    const firstY = Math.floor(originY / TILE);
    const lastX = Math.floor((originX + width) / TILE);
    const lastY = Math.floor((originY + height) / TILE);
    for (let x = firstX; x <= lastX; x += 1) {
      for (let y = firstY; y <= lastY; y += 1) {
        if (y < 0 || y >= count) continue;
        const wrapped = ((x % count) + count) % count;
        tiles.push({
          key: `${zoom}/${wrapped}/${y}/${x}`,
          url: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${y}.png`,
          x: x * TILE - originX,
          y: y * TILE - originY,
        });
      }
    }

    const screen = points.map((point) => {
      const projected = project(point, zoom);
      return { x: projected.x - originX, y: projected.y - originY };
    });

    return {
      tiles,
      path: screen.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '),
      start: screen[0],
      end: screen[screen.length - 1],
    };
  });
}
