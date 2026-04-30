import { Component, Input, Output, EventEmitter, computed, signal, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RunBlock, RunBlockMode } from '../../services/run.service';

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
  @Output() blocksChange = new EventEmitter<RunBlock[]>();

  internal = signal<RunBlock[]>([]);

  totalDistance = computed(() => {
    return this.computeTotalKm(this.internal());
  });

  ngOnInit() {
    this.internal.set(this.normalize(this.blocks || []));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['blocks']) {
      this.internal.set(this.normalize(this.blocks || []));
    }
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
      block.recoveryDuration = 1;
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
    if (block.role === 'main' && block.recoveryMode) {
      // Récup s'effectue entre les répétitions, donc reps - 1 fois pour les fractionnés
      // Mais on facture aussi le tour de récup final si présent. Convention simple : reps fois.
      const recReps = reps;
      if (block.recoveryMode === 'distance') {
        recovery = (block.recoveryDistance || 0) * recReps;
      } else if (block.recoveryMode === 'duration' && block.recoveryPace) {
        const rp = this.paceToMinPerKm(block.recoveryPace);
        if (rp && rp > 0) {
          recovery = ((block.recoveryDuration || 0) / rp) * recReps;
        }
      }
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
}
