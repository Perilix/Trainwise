import { Component, Input, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-run-mini-map',
  standalone: true,
  template: `<div #mapEl class="mini-map-el"></div>`,
  styles: [`
    :host { display: block; width: 100%; height: 130px; }
    .mini-map-el { width: 100%; height: 100%; }
  `]
})
export class RunMiniMapComponent implements AfterViewInit, OnDestroy {
  @Input() polyline!: string;
  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private observer: IntersectionObserver | null = null;

  ngAfterViewInit() {
    this.observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !this.map) {
        this.initMap();
      }
    }, { threshold: 0.05 });
    this.observer.observe(this.mapEl.nativeElement);
  }

  private initMap() {
    const coords = this.decodePolyline(this.polyline);
    if (coords.length < 2) return;

    this.map = L.map(this.mapEl.nativeElement, {
      zoomControl: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      scrollWheelZoom: false,
      boxZoom: false,
      keyboard: false,
      attributionControl: false
    });

    // CartoDB Voyager — style chaleureux, coloré, moderne
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    const path = L.polyline(coords, {
      color: '#00a6fb',
      weight: 4,
      opacity: 1,
      lineJoin: 'round',
      lineCap: 'round'
    }).addTo(this.map);

    // Point de départ
    L.circleMarker(coords[0], {
      radius: 5,
      color: '#fff',
      weight: 2,
      fillColor: '#10b981',
      fillOpacity: 1
    }).addTo(this.map);

    this.map.fitBounds(path.getBounds(), { padding: [18, 18] });
  }

  private decodePolyline(encoded: string): L.LatLngTuple[] {
    const coords: L.LatLngTuple[] = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
      let b: number, shift = 0, result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : (result >> 1);
      shift = 0; result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : (result >> 1);
      coords.push([lat / 1e5, lng / 1e5]);
    }
    return coords;
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this.map?.remove();
  }
}
