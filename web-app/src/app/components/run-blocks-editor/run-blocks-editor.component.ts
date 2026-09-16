import { Component, Input, Output, EventEmitter, computed, signal, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RunBlock, RunBlockMode, RunBlockRole } from '../../services/run.service';
import { SessionTemplateService } from '../../services/session-template.service';
import { PaceZone, PaceZoneKey } from '../../interfaces/session-template.interfaces';
import { WorkoutProfileComponent } from '../workout-profile/workout-profile.component';

type StepType = 'warm' | 'run' | 'rec' | 'cool' | 'rest';

const STEP_META: Record<StepType, { icon: string; label: string }> = {
  warm: { icon: '🔥', label: 'Échauffement' },
  run: { icon: '🏃', label: 'Course' },
  rec: { icon: '💧', label: 'Récupération' },
  cool: { icon: '🧊', label: 'Retour au calme' },
  rest: { icon: '⏸️', label: 'Repos' }
};

@Component({
  selector: 'app-run-blocks-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, WorkoutProfileComponent],
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
  // Affiche le bloc « Profil de la séance » (timeline + stats) en haut
  @Input() showProfile = true;
  // Active le mode zone VMA (toggle Zone / Allure fixe + slider)
  @Input() enableVmaPaces = false;
  // VMA de l'athlète pour résoudre les % en allures concrètes
  @Input() athleteVma: number | null = null;
  @Output() blocksChange = new EventEmitter<RunBlock[]>();

  zones = signal<PaceZone[]>([]);

  constructor(private templateService: SessionTemplateService) {}

  expandedKeys = signal<Set<string>>(new Set<string>());

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
      .map((b, i) => {
        const block = { ...b, order: b.order ?? i };
        if (block.children?.length) {
          block.children = block.children.map((c, ci) => ({ ...c, order: c.order ?? ci }));
        }
        return block;
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  warmupBlock = computed(() => this.internal().find(b => b.role === 'warmup') || null);
  mainBlocks = computed(() => this.internal().filter(b => b.role === 'main'));
  cooldownBlock = computed(() => this.internal().find(b => b.role === 'cooldown') || null);

  private emit() {
    // Rafraîchit la référence du tableau pour que les consommateurs liés à
    // internal() (profil, total) se recalculent même après une mutation en place.
    this.internal.update(list => [...list]);
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
    this.expandLast('warmup');
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
    this.expandLast('main');
  }

  addCooldown() {
    if (this.cooldownBlock()) return;
    this.commit(list => [
      ...list,
      { role: 'cooldown', mode: 'duration', duration: 10, pace: '', repetitions: 1, description: '', order: 999 }
    ]);
    this.expandLast('cooldown');
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
    // Groupe « Répéter » : somme des enfants × répétitions du groupe.
    if (this.isGroup(block)) {
      const inner = (block.children || []).reduce((acc, c) => acc + this.blockDistanceKm(c), 0);
      return inner * reps;
    }
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

  // ============= Garmin-style step helpers =============

  /** Ancien bloc « Répéter » à étape unique (effort + récup ×N), sans `children`. Rétro-compat. */
  isRepeat(block: RunBlock): boolean {
    return !this.isGroup(block) && block.role === 'main' && Math.max(1, block.repetitions || 1) > 1;
  }

  stepType(role: RunBlockRole): StepType {
    if (role === 'warmup') return 'warm';
    if (role === 'cooldown') return 'cool';
    return 'run';
  }

  stepIcon(type: StepType): string {
    return STEP_META[type].icon;
  }

  stepTypeLabel(block: RunBlock): string {
    if (block.role === 'warmup') return 'Échauffement';
    if (block.role === 'cooldown') return 'Retour au calme';
    return (block.description || '').trim() || 'Course';
  }

  /** Valeur principale d'une étape (effort) : distance ou durée. */
  stepValue(block: RunBlock): string {
    if (block.mode === 'distance') {
      return block.distance ? `${Math.round(block.distance * 1000)} m` : '—';
    }
    return block.duration ? `${block.duration} min` : '—';
  }

  /** Ligne « Cible · 4:00 /km · Z… ». */
  stepTarget(block: RunBlock): string {
    const parts: string[] = [];
    if (block.pace) parts.push(`${block.pace} /km`);
    const zone = block.paceSource?.zone;
    if (zone) parts.push(this.zoneShort(zone));
    if (!parts.length) return '';
    return `Cible · ${parts.join(' · ')}`;
  }

  recoveryValue(block: RunBlock): string {
    if (block.recoveryMode === 'distance') {
      return block.recoveryDistance ? `${Math.round(block.recoveryDistance * 1000)} m` : '—';
    }
    return block.recoveryDuration ? `${block.recoveryDuration}` : '—';
  }

  recoveryTarget(block: RunBlock): string {
    const parts: string[] = [];
    if (block.recoveryDescription) parts.push(block.recoveryDescription);
    if (block.recoveryPace) parts.push(`${block.recoveryPace} /km`);
    return parts.length ? `Récup · ${parts.join(' · ')}` : 'Récup';
  }

  private zoneShort(zone: string): string {
    const z = this.zones().find(x => x.key === zone);
    return z ? z.label : zone;
  }

  // ---- Compare (prévu → réalisé) sur la valeur d'étape ----
  stepValueChanged(block: RunBlock): boolean {
    const orig = this.findOriginal(block);
    return !!orig && this.stepValue(orig) !== this.stepValue(block);
  }

  origStepValue(block: RunBlock): string {
    const orig = this.findOriginal(block);
    return orig ? this.stepValue(orig) : '';
  }

  recoveryValueChanged(block: RunBlock): boolean {
    const orig = this.findOriginal(block);
    return !!orig && this.recoveryValue(orig) !== this.recoveryValue(block);
  }

  origRecoveryValue(block: RunBlock): string {
    const orig = this.findOriginal(block);
    return orig ? this.recoveryValue(orig) : '';
  }

  // ---- Compare DANS un groupe (enfant prévu → réalisé) ----
  private origGroupChild(group: RunBlock, index: number): RunBlock | null {
    const orig = this.findOriginal(group);
    if (!orig || !orig.children) return null;
    return orig.children[index] || null;
  }

  childValueChanged(group: RunBlock, child: RunBlock, index: number): boolean {
    const o = this.origGroupChild(group, index);
    return !!o && this.stepValue(o) !== this.stepValue(child);
  }

  origChildValue(group: RunBlock, index: number): string {
    const o = this.origGroupChild(group, index);
    return o ? this.stepValue(o) : '';
  }

  childRecoveryChanged(group: RunBlock, child: RunBlock, index: number): boolean {
    const o = this.origGroupChild(group, index);
    return !!o && this.recoveryValue(o) !== this.recoveryValue(child);
  }

  origChildRecoveryValue(group: RunBlock, index: number): string {
    const o = this.origGroupChild(group, index);
    return o ? this.recoveryValue(o) : '';
  }

  /** Nb de répétitions prévu (du groupe original), pour afficher « 8× → 6× ». */
  origRepetitions(block: RunBlock): number | null {
    const orig = this.findOriginal(block);
    return orig ? Math.max(1, orig.repetitions || 1) : null;
  }

  repetitionsChanged(block: RunBlock): boolean {
    const o = this.origRepetitions(block);
    return o !== null && o !== Math.max(1, block.repetitions || 1);
  }

  // ============= Repeat stepper =============

  incRepeat(block: RunBlock) {
    if (this.readonly) return;
    const v = Math.max(1, block.repetitions || 1);
    block.repetitions = Math.min(30, v + 1);
    this.emit();
  }

  decRepeat(block: RunBlock) {
    if (this.readonly) return;
    const v = Math.max(1, block.repetitions || 1);
    block.repetitions = Math.max(1, v - 1);
    this.emit();
  }

  private newChildStep(): RunBlock {
    return {
      role: 'main',
      mode: 'distance',
      distance: 0.4,
      pace: '',
      repetitions: 1,
      description: '',
      recoveryMode: 'duration',
      recoveryDuration: '1min',
      recoveryPace: null
    };
  }

  /** Insère un GROUPE « à répéter » (conteneur d'étapes), répété 8×. */
  addRepeat() {
    this.commit(list => {
      const insertAt = list.findIndex(b => b.role === 'cooldown');
      const block: RunBlock = {
        role: 'main',
        mode: 'distance',
        distance: null,
        pace: '',
        repetitions: 8,
        description: '',
        recoveryMode: null,
        children: [this.newChildStep()]
      };
      if (insertAt < 0) return [...list, block];
      const copy = [...list];
      copy.splice(insertAt, 0, block);
      return copy;
    });
  }

  /** Ajoute une étape enfant à un groupe « Répéter ». */
  addChild(group: RunBlock) {
    if (this.readonly) return;
    if (!group.children) group.children = [];
    group.children.push(this.newChildStep());
    this.reindexChildren(group);
    this.open(this.childKey(group, group.children.length - 1));
    this.emit();
  }

  /** Supprime une étape enfant ; si le groupe se vide, retire le groupe entier. */
  removeChild(group: RunBlock, child: RunBlock) {
    if (this.readonly) return;
    group.children = (group.children || []).filter(c => c !== child);
    if (group.children.length === 0) {
      this.removeBlock(group);
      return;
    }
    this.reindexChildren(group);
    this.emit();
  }

  moveChildUp(group: RunBlock, index: number) {
    if (this.readonly || !group.children || index <= 0) return;
    const c = group.children;
    [c[index - 1], c[index]] = [c[index], c[index - 1]];
    this.reindexChildren(group);
    this.emit();
  }

  moveChildDown(group: RunBlock, index: number) {
    if (this.readonly || !group.children || index >= group.children.length - 1) return;
    const c = group.children;
    [c[index + 1], c[index]] = [c[index], c[index + 1]];
    this.reindexChildren(group);
    this.emit();
  }

  private reindexChildren(group: RunBlock) {
    (group.children || []).forEach((c, i) => (c.order = i));
  }

  isGroup(block: RunBlock): boolean {
    return !!(block.children && block.children.length > 0);
  }

  childTypeLabel(child: RunBlock): string {
    return (child.description || '').trim() || 'Course';
  }

  /** Ouvre (déplie) le dernier bloc d'un rôle donné — utilisé après un ajout. */
  private expandLast(role: RunBlockRole) {
    const list = this.internal();
    const target = role === 'main'
      ? [...list].reverse().find(b => b.role === 'main')
      : list.find(b => b.role === role);
    if (target) this.open(this.keyFor(target));
  }

  // ---- Édition inline (déplier / replier) ----
  private keyFor(block: RunBlock): string {
    return 'b' + (block.order ?? 0);
  }

  childKey(parent: RunBlock, index: number): string {
    return 'c' + (parent.order ?? 0) + '-' + index;
  }

  private open(key: string) {
    const keys = new Set(this.expandedKeys());
    keys.add(key);
    this.expandedKeys.set(keys);
  }

  private toggle(key: string) {
    const keys = new Set(this.expandedKeys());
    if (keys.has(key)) keys.delete(key);
    else keys.add(key);
    this.expandedKeys.set(keys);
  }

  isExpanded(block: RunBlock): boolean {
    if (this.readonly) return false;
    return this.expandedKeys().has(this.keyFor(block));
  }

  toggleExpand(block: RunBlock) {
    if (this.readonly) return;
    this.toggle(this.keyFor(block));
  }

  isChildOpen(parent: RunBlock, index: number): boolean {
    if (this.readonly) return false;
    return this.expandedKeys().has(this.childKey(parent, index));
  }

  toggleChild(parent: RunBlock, index: number) {
    if (this.readonly) return;
    this.toggle(this.childKey(parent, index));
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
