import { Component, Input, Output, EventEmitter, computed, signal, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RunBlock, RunBlockMode } from '../../services/run.service';
import { SessionTemplateService } from '../../services/session-template.service';
import { PaceZone, PaceZoneKey } from '../../interfaces/session-template.interfaces';

@Component({
  selector: 'app-run-blocks-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './run-blocks-editor.component.html',
  styleUrl: './run-blocks-editor.component.scss'
})
export class RunBlocksEditorComponent implements OnInit, OnChanges {
  @Input() blocks: RunBlock[] = [];
  @Input() readonly = false;
  @Input() title = '';
  // Quand true : les blocs s'affichent en résumé compact, avec un crayon pour éditer chaque bloc
  @Input() compact = false;
  // Quand fourni : affiche un diff (valeur barrée si différente entre original et bloc courant)
  @Input() compareTo: RunBlock[] | null = null;
  // Active le mode zone VMA (toggle Zone / Allure fixe + slider)
  @Input() enableVmaPaces = false;
  // VMA de l'athlète pour résoudre les % en allures concrètes
  @Input() athleteVma: number | null = null;
  @Output() blocksChange = new EventEmitter<RunBlock[]>();

  zones = signal<PaceZone[]>([]);

  constructor(private templateService: SessionTemplateService) {}

  expandedKeys = signal<Set<number>>(new Set<number>());

  internal = signal<RunBlock[]>([]);

  totalDistance = computed(() => {
    return this.computeTotalKm(this.internal());
  });

  ngOnInit() {
    this.internal.set(this.normalize(this.blocks || []));
    if (this.enableVmaPaces && this.zones().length === 0) {
      this.templateService.getPaceZones().subscribe({
        next: (z) => this.zones.set(z),
        error: () => {}
      });
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['blocks']) {
      this.internal.set(this.normalize(this.blocks || []));
    }
    // Recalcule les allures résolues quand la VMA change
    if (changes['athleteVma'] && !changes['athleteVma'].firstChange) {
      this.recomputeResolvedPaces();
    }
  }

  // ============= Pace mode helpers (zone / absolute) =============

  paceMode(block: RunBlock): 'absolute' | 'zone' {
    return block.paceSource?.mode === 'zone' || block.paceSource?.mode === 'vmaPercent' ? 'zone' : 'absolute';
  }

  recoveryPaceMode(block: RunBlock): 'absolute' | 'zone' {
    return block.recoveryPaceSource?.mode === 'zone' || block.recoveryPaceSource?.mode === 'vmaPercent' ? 'zone' : 'absolute';
  }

  setPaceMode(block: RunBlock, mode: 'absolute' | 'zone') {
    if (this.readonly) return;
    if (mode === 'absolute') {
      block.paceSource = { mode: 'absolute' };
    } else {
      const firstZone = this.zones()[0];
      block.paceSource = {
        mode: 'zone',
        zone: firstZone?.key || 'endurance',
        vmaPercent: firstZone?.defaultPercent ?? 70,
        resolvedFromVma: this.athleteVma ?? null
      };
      block.pace = this.computePaceString(block.paceSource.vmaPercent!);
    }
    this.emit();
  }

  setRecoveryPaceMode(block: RunBlock, mode: 'absolute' | 'zone') {
    if (this.readonly) return;
    if (mode === 'absolute') {
      block.recoveryPaceSource = { mode: 'absolute' };
    } else {
      const recovery = this.zones().find(z => z.key === 'recovery') || this.zones()[0];
      block.recoveryPaceSource = {
        mode: 'zone',
        zone: recovery?.key || 'recovery',
        vmaPercent: recovery?.defaultPercent ?? 60,
        resolvedFromVma: this.athleteVma ?? null
      };
      block.recoveryPace = this.computePaceString(block.recoveryPaceSource.vmaPercent!);
    }
    this.emit();
  }

  setBlockZone(block: RunBlock, zoneKey: PaceZoneKey, target: 'pace' | 'recoveryPace') {
    if (this.readonly) return;
    const zone = this.zones().find(z => z.key === zoneKey);
    if (!zone) return;
    const sourceField = target === 'pace' ? 'paceSource' : 'recoveryPaceSource';
    block[sourceField] = {
      mode: 'zone',
      zone: zoneKey,
      vmaPercent: zone.defaultPercent,
      resolvedFromVma: this.athleteVma ?? null
    };
    block[target] = this.computePaceString(zone.defaultPercent);
    this.emit();
  }

  setBlockPercent(block: RunBlock, percent: number, target: 'pace' | 'recoveryPace') {
    if (this.readonly) return;
    const sourceField = target === 'pace' ? 'paceSource' : 'recoveryPaceSource';
    const current = block[sourceField] || {};
    block[sourceField] = {
      ...current,
      mode: current.mode || 'zone',
      vmaPercent: percent,
      resolvedFromVma: this.athleteVma ?? null
    };
    block[target] = this.computePaceString(percent);
    this.emit();
  }

  zoneFor(block: RunBlock, target: 'pace' | 'recoveryPace'): PaceZone | null {
    const sourceField = target === 'pace' ? 'paceSource' : 'recoveryPaceSource';
    const key = block[sourceField]?.zone;
    if (!key) return null;
    return this.zones().find(z => z.key === key) || null;
  }

  blockPercent(block: RunBlock, target: 'pace' | 'recoveryPace'): number {
    const sourceField = target === 'pace' ? 'paceSource' : 'recoveryPaceSource';
    return block[sourceField]?.vmaPercent ?? this.zoneFor(block, target)?.defaultPercent ?? 70;
  }

  computePaceString(percent: number): string | null {
    if (!this.athleteVma || !percent) return null;
    const speed = this.athleteVma * (percent / 100);
    if (speed <= 0) return null;
    const secPerKm = 3600 / speed;
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Recalcule les allures résolues pour tous les blocs en mode zone (appelé quand VMA change)
  private recomputeResolvedPaces() {
    this.commit(list => list.map(b => {
      const updated = { ...b };
      if (b.paceSource?.mode === 'zone' || b.paceSource?.mode === 'vmaPercent') {
        const pct = b.paceSource.vmaPercent || this.zones().find(z => z.key === b.paceSource?.zone)?.defaultPercent;
        if (pct) {
          updated.pace = this.computePaceString(pct);
          updated.paceSource = { ...b.paceSource, resolvedFromVma: this.athleteVma ?? null };
        }
      }
      if (b.recoveryPaceSource?.mode === 'zone' || b.recoveryPaceSource?.mode === 'vmaPercent') {
        const pct = b.recoveryPaceSource.vmaPercent || this.zones().find(z => z.key === b.recoveryPaceSource?.zone)?.defaultPercent;
        if (pct) {
          updated.recoveryPace = this.computePaceString(pct);
          updated.recoveryPaceSource = { ...b.recoveryPaceSource, resolvedFromVma: this.athleteVma ?? null };
        }
      }
      return updated;
    }));
  }

  private normalize(list: RunBlock[]): RunBlock[] {
    return [...list]
      .map((b, i) => ({ ...b, order: b.order ?? i }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  warmupBlock = computed(() => this.internal().find(b => b.role === 'warmup') || null);
  mainBlocks = computed(() => this.internal().filter(b => b.role === 'main'));
  cooldownBlock = computed(() => this.internal().find(b => b.role === 'cooldown') || null);

  private emit() {
    this.blocksChange.emit(this.internal());
  }

  private commit(updater: (list: RunBlock[]) => RunBlock[]) {
    this.internal.update(list => {
      const next = updater(list);
      return next.map((b, i) => ({ ...b, order: i }));
    });
    this.emit();
  }

  addWarmup() {
    if (this.warmupBlock()) return;
    this.commit(list => [
      { role: 'warmup', mode: 'duration', duration: 15, pace: '', repetitions: 1, description: '', order: -1 },
      ...list
    ]);
  }

  addMain() {
    this.commit(list => {
      const insertAt = list.findIndex(b => b.role === 'cooldown');
      const block: RunBlock = {
        role: 'main',
        mode: 'distance',
        distance: 1,
        pace: '',
        repetitions: 1,
        description: '',
        recoveryMode: null
      };
      if (insertAt < 0) return [...list, block];
      const copy = [...list];
      copy.splice(insertAt, 0, block);
      return copy;
    });
  }

  addCooldown() {
    if (this.cooldownBlock()) return;
    this.commit(list => [
      ...list,
      { role: 'cooldown', mode: 'duration', duration: 10, pace: '', repetitions: 1, description: '', order: 999 }
    ]);
  }

  removeBlock(block: RunBlock) {
    this.commit(list => list.filter(b => b !== block));
  }

  moveMainUp(index: number) {
    this.commit(list => {
      const mains = list.filter(b => b.role === 'main');
      if (index <= 0 || index >= mains.length) return list;
      const target = mains[index];
      const prev = mains[index - 1];
      return list.map(b => {
        if (b === target) return prev;
        if (b === prev) return target;
        return b;
      });
    });
  }

  moveMainDown(index: number) {
    this.commit(list => {
      const mains = list.filter(b => b.role === 'main');
      if (index < 0 || index >= mains.length - 1) return list;
      const target = mains[index];
      const next = mains[index + 1];
      return list.map(b => {
        if (b === target) return next;
        if (b === next) return target;
        return b;
      });
    });
  }

  setMode(block: RunBlock, mode: RunBlockMode) {
    if (this.readonly) return;
    block.mode = mode;
    if (mode === 'distance') block.duration = null;
    else block.distance = null;
    this.emit();
  }

  toggleRecovery(block: RunBlock) {
    if (this.readonly) return;
    if (block.recoveryMode) {
      block.recoveryMode = null;
      block.recoveryDistance = null;
      block.recoveryDuration = null;
      block.recoveryPace = null;
      block.recoveryDescription = '';
    } else {
      block.recoveryMode = 'duration';
      block.recoveryDuration = '1min';
    }
    this.emit();
  }

  setRecoveryMode(block: RunBlock, mode: RunBlockMode) {
    if (this.readonly) return;
    block.recoveryMode = mode;
    if (mode === 'distance') block.recoveryDuration = null;
    else block.recoveryDistance = null;
    this.emit();
  }

  onFieldChange() {
    this.emit();
  }

  kmToMeters(km: number | null | undefined): string {
    if (km == null || km === 0) return '';
    return String(Math.round(km * 1000));
  }

  setDistanceFromMeters(block: RunBlock, value: string) {
    if (this.readonly) return;
    const m = parseFloat(value);
    block.distance = isNaN(m) || m <= 0 ? null : m / 1000;
    this.onFieldChange();
  }

  setRecoveryDistanceFromMeters(block: RunBlock, value: string) {
    if (this.readonly) return;
    const m = parseFloat(value);
    block.recoveryDistance = isNaN(m) || m <= 0 ? null : m / 1000;
    this.onFieldChange();
  }

  paceToMinPerKm(pace: string | null | undefined): number | null {
    if (!pace) return null;
    const m = /^(\d+):(\d{1,2})$/.exec(pace.trim());
    if (!m) return null;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    if (isNaN(min) || isNaN(sec) || sec >= 60) return null;
    return min + sec / 60;
  }

  blockDistanceKm(block: RunBlock): number {
    const reps = Math.max(1, block.repetitions || 1);
    let main = 0;
    if (block.mode === 'distance') {
      main = (block.distance || 0) * reps;
    } else if (block.mode === 'duration' && block.pace) {
      const pace = this.paceToMinPerKm(block.pace);
      if (pace && pace > 0) {
        main = ((block.duration || 0) / pace) * reps;
      }
    }
    let recovery = 0;
    if (block.role === 'main' && block.recoveryMode === 'distance') {
      recovery = (block.recoveryDistance || 0) * reps;
    }
    return main + recovery;
  }

  computeTotalKm(blocks: RunBlock[]): number {
    return blocks.reduce((acc, b) => acc + this.blockDistanceKm(b), 0);
  }

  blockDistanceLabel(block: RunBlock): string {
    const km = this.blockDistanceKm(block);
    if (!km) return '';
    return `≈ ${km.toFixed(2)} km`;
  }

  trackByOrder(_: number, block: RunBlock) {
    return block.order;
  }

  // ---- Mode compact / pencil edit ----
  isExpanded(block: RunBlock): boolean {
    if (!this.compact) return true;
    if (block.order == null) return false;
    return this.expandedKeys().has(block.order);
  }

  toggleExpand(block: RunBlock) {
    if (this.readonly) return;
    if (block.order == null) return;
    const keys = new Set(this.expandedKeys());
    if (keys.has(block.order)) keys.delete(block.order);
    else keys.add(block.order);
    this.expandedKeys.set(keys);
  }

  collapseAll() {
    this.expandedKeys.set(new Set());
  }

  // ---- Résumé compact d'un bloc ----
  formatPace(pace?: string | null): string {
    return pace ? `${pace}/km` : '';
  }

  blockSummary(block: RunBlock): string {
    const parts: string[] = [];
    const reps = Math.max(1, block.repetitions || 1);
    const main = block.mode === 'distance'
      ? (block.distance ? `${Math.round(block.distance * 1000)}m` : '')
      : (block.duration ? `${block.duration} min` : '');
    if (reps > 1 && block.role === 'main') parts.push(`${reps}× ${main}`);
    else parts.push(main);
    if (block.pace) parts.push(`@ ${block.pace}`);
    if (block.role === 'main' && block.recoveryMode) {
      const rec = block.recoveryMode === 'distance'
        ? (block.recoveryDistance ? `${Math.round(block.recoveryDistance * 1000)}m` : '')
        : (block.recoveryDuration ? `${block.recoveryDuration}` : '');
      const recPace = block.recoveryPace ? ` @ ${block.recoveryPace}` : '';
      if (rec) parts.push(`/ ${rec} récup${recPace}`);
    }
    return parts.filter(p => !!p).join(' ').trim() || '—';
  }

  // ---- Diff helpers ----
  private findOriginal(block: RunBlock): RunBlock | null {
    if (!this.compareTo || block.order == null) return null;
    return this.compareTo.find(b => b.order === block.order) || null;
  }

  hasDiff(block: RunBlock, field: keyof RunBlock): boolean {
    const orig = this.findOriginal(block);
    if (!orig) return false;
    return orig[field] !== block[field] && !(orig[field] == null && block[field] == null);
  }

  origValue(block: RunBlock, field: keyof RunBlock): any {
    const orig = this.findOriginal(block);
    return orig ? orig[field] : null;
  }

  origSummary(block: RunBlock): string {
    const orig = this.findOriginal(block);
    return orig ? this.blockSummary(orig) : '';
  }

  hasAnyDiff(block: RunBlock): boolean {
    const orig = this.findOriginal(block);
    if (!orig) return false;
    const fields: (keyof RunBlock)[] = ['mode', 'distance', 'duration', 'pace', 'repetitions', 'description',
      'recoveryMode', 'recoveryDistance', 'recoveryDuration', 'recoveryPace', 'recoveryDescription'];
    return fields.some(f => this.hasDiff(block, f));
  }
}
