import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaceConfig, PaceMode, PaceZone, PaceZoneKey } from '../../interfaces/session-template.interfaces';

@Component({
  selector: 'app-pace-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pace-input.component.html',
  styleUrl: './pace-input.component.scss'
})
export class PaceInputComponent implements OnInit, OnChanges {
  @Input() value: PaceConfig | null = null;
  @Input() zones: PaceZone[] = [];
  @Input() previewVma: number | null = null;
  @Input() label = 'Allure';
  @Output() valueChange = new EventEmitter<PaceConfig>();

  internal = signal<PaceConfig>({ mode: 'zone', zone: 'endurance' });

  ngOnInit() {
    if (this.value) this.internal.set({ ...this.value });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value'] && this.value) {
      this.internal.set({ ...this.value });
    }
  }

  setMode(mode: PaceMode) {
    const cur = this.internal();
    let next: PaceConfig = { ...cur, mode };
    if (mode === 'zone' && !cur.zone) {
      const first = this.zones[0]?.key || 'endurance';
      const z = this.zones.find(x => x.key === first);
      next = { mode: 'zone', zone: first, vmaPercent: z?.defaultPercent ?? 70 };
    }
    if (mode === 'vmaPercent' && cur.vmaPercent == null) {
      next.vmaPercent = 80;
    }
    if (mode === 'absolute' && !cur.absolute) {
      next.absolute = '5:00';
    }
    this.internal.set(next);
    this.valueChange.emit(next);
  }

  setZone(zoneKey: PaceZoneKey) {
    const z = this.zones.find(x => x.key === zoneKey);
    const next: PaceConfig = {
      mode: 'zone',
      zone: zoneKey,
      vmaPercent: z?.defaultPercent ?? this.internal().vmaPercent ?? 70
    };
    this.internal.set(next);
    this.valueChange.emit(next);
  }

  setPercent(value: number | string) {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(n)) return;
    const next: PaceConfig = { ...this.internal(), vmaPercent: n };
    this.internal.set(next);
    this.valueChange.emit(next);
  }

  setAbsolute(value: string) {
    const next: PaceConfig = { ...this.internal(), mode: 'absolute', absolute: value };
    this.internal.set(next);
    this.valueChange.emit(next);
  }

  currentZone(): PaceZone | null {
    const key = this.internal().zone;
    if (!key) return null;
    return this.zones.find(x => x.key === key) || null;
  }

  resolvedPreview(): string | null {
    const cfg = this.internal();
    if (cfg.mode === 'absolute') return cfg.absolute || null;
    const vma = this.previewVma;
    if (!vma) return null;
    let percent: number | null = null;
    if (cfg.mode === 'vmaPercent') percent = cfg.vmaPercent || null;
    else if (cfg.mode === 'zone') {
      percent = cfg.vmaPercent || this.currentZone()?.defaultPercent || null;
    }
    if (!percent) return null;
    const speed = vma * (percent / 100);
    if (speed <= 0) return null;
    const secPerKm = 3600 / speed;
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${s.toString().padStart(2, '0')}/km`;
  }
}
