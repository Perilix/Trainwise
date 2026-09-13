import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { RunBlocksEditorComponent } from '../../../components/run-blocks-editor/run-blocks-editor.component';
import { RunBlock, RunBlockPaceSource } from '../../../services/run.service';
import { SessionTemplateService } from '../../../services/session-template.service';
import { ExerciseService } from '../../../services/exercise.service';
import {
  SessionTemplate, Sport, SessionType, TemplateRunBlock, PaceConfig,
  PaceZone, StrengthExerciseEntry, StrengthCircuit, StrengthSuperset
} from '../../../interfaces/session-template.interfaces';
import { Exercise } from '../../../interfaces/strength.interfaces';
import { parseDecimalInput } from '../../../utils/decimal.util';

@Component({
  selector: 'app-session-template-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, RunBlocksEditorComponent],
  templateUrl: './session-template-editor.component.html',
  styleUrl: './session-template-editor.component.scss'
})
export class SessionTemplateEditorComponent implements OnInit {
  templateId = signal<string | null>(null);
  isLoading = signal(false);
  isSaving = signal(false);
  error = signal<string | null>(null);

  zones = signal<PaceZone[]>([]);
  exercises = signal<Exercise[]>([]);

  // Form data
  name = signal('');
  description = signal('');
  sport = signal<Sport>('running');
  sessionType = signal<SessionType>('endurance');
  targetDistance = signal<number | null>(null);
  targetDuration = signal<number | null>(null);
  warmup = signal('');
  mainWorkout = signal('');
  cooldown = signal('');

  // Blocs au format de l'éditeur partagé (même UI que les plannings athlète/coach)
  editorBlocks = signal<RunBlock[]>([]);
  strengthExercises = signal<StrengthExerciseEntry[]>([]);
  strengthCircuit = signal<StrengthCircuit | null>(null);
  strengthSuperset = signal<StrengthSuperset | null>(null);

  // Preview VMA pour le pace-input (utilisé pour montrer un exemple d'allure)
  previewVma = signal(16);

  runSessionTypes: { value: SessionType; label: string }[] = [
    { value: 'endurance', label: 'Endurance' },
    { value: 'fractionne', label: 'Fractionné' },
    { value: 'tempo', label: 'Tempo' },
    { value: 'recuperation', label: 'Récupération' },
    { value: 'sortie_longue', label: 'Sortie longue' },
    { value: 'cotes', label: 'Côtes' },
    { value: 'fartlek', label: 'Fartlek' }
  ];

  strengthSessionTypes: { value: SessionType; label: string }[] = [
    { value: 'upper_body', label: 'Haut du corps' },
    { value: 'lower_body', label: 'Bas du corps' },
    { value: 'full_body', label: 'Full body' },
    { value: 'push', label: 'Push' },
    { value: 'pull', label: 'Pull' },
    { value: 'legs', label: 'Jambes' },
    { value: 'core', label: 'Gainage' },
    { value: 'hiit', label: 'HIIT' }
  ];

  availableSessionTypes = computed(() =>
    this.sport() === 'running' ? this.runSessionTypes : this.strengthSessionTypes
  );

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private templateService: SessionTemplateService,
    private exerciseService: ExerciseService
  ) {}

  ngOnInit() {
    this.templateService.getPaceZones().subscribe({
      next: (z) => this.zones.set(z),
      error: (err) => console.error('zones load failed', err)
    });
    this.exerciseService.getExercises({ limit: 200 }).subscribe({
      next: (list) => this.exercises.set(list),
      error: (err) => console.error('exercises load failed', err)
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.templateId.set(id);
      this.loadTemplate(id);
    }
  }

  loadTemplate(id: string) {
    this.isLoading.set(true);
    this.templateService.get(id).subscribe({
      next: (tpl) => {
        this.name.set(tpl.name);
        this.description.set(tpl.description || '');
        this.sport.set(tpl.sport);
        this.sessionType.set(tpl.sessionType);
        this.targetDistance.set(tpl.targetDistance ?? null);
        this.targetDuration.set(tpl.targetDuration ?? null);
        this.warmup.set(tpl.warmup || '');
        this.mainWorkout.set(tpl.mainWorkout || '');
        this.cooldown.set(tpl.cooldown || '');
        this.editorBlocks.set(this.templateToRunBlocks(tpl.runBlocks || []));
        const strExos = tpl.strengthPlan?.exercises || [];
        this.strengthExercises.set(strExos.map(e => ({
          ...e,
          exercise: typeof e.exercise === 'string' ? e.exercise : (e.exercise as any)?._id
        })));
        // Circuit
        if (tpl.strengthPlan?.circuit?.exercises?.length) {
          this.strengthCircuit.set({
            ...tpl.strengthPlan.circuit,
            exercises: tpl.strengthPlan.circuit.exercises.map(e => ({
              ...e,
              exercise: typeof e.exercise === 'string' ? e.exercise : (e.exercise as any)?._id
            }))
          });
        }
        // Superset
        if (tpl.strengthPlan?.superset?.pairs?.length) {
          this.strengthSuperset.set({
            ...tpl.strengthPlan.superset,
            pairs: tpl.strengthPlan.superset.pairs.map(p => ({
              a: { ...p.a, exercise: typeof p.a.exercise === 'string' ? p.a.exercise : (p.a.exercise as any)?._id },
              b: { ...p.b, exercise: typeof p.b.exercise === 'string' ? p.b.exercise : (p.b.exercise as any)?._id }
            }))
          });
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur de chargement');
        this.isLoading.set(false);
      }
    });
  }

  // ===== Run blocks (éditeur partagé) =====
  onBlocksChange(blocks: RunBlock[]) {
    this.editorBlocks.set(blocks);
  }

  // --- Conversion template (PaceConfig) → éditeur (pace string + paceSource) ---

  private computePaceString(percent: number | null | undefined): string | null {
    const vma = this.previewVma();
    if (!vma || !percent) return null;
    const speed = vma * (percent / 100);
    if (speed <= 0) return null;
    const secPerKm = 3600 / speed;
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private paceConfigToEditor(pc: PaceConfig | null | undefined): { pace: string | null; source: RunBlockPaceSource | undefined } {
    if (!pc) return { pace: null, source: undefined };
    if (pc.mode === 'absolute') {
      return { pace: pc.absolute ?? null, source: { mode: 'absolute' } };
    }
    const percent = pc.vmaPercent ?? this.zones().find(z => z.key === pc.zone)?.defaultPercent ?? null;
    return {
      pace: this.computePaceString(percent),
      source: {
        mode: 'zone',
        zone: pc.zone ?? null,
        vmaPercent: percent,
        resolvedFromVma: this.previewVma()
      }
    };
  }

  private templateToRunBlocks(list: TemplateRunBlock[]): RunBlock[] {
    return (list || []).map((t, i) => {
      const main = this.paceConfigToEditor(t.pace);
      const rec = this.paceConfigToEditor(t.recoveryPace);
      const block: RunBlock = {
        role: t.role,
        mode: t.mode,
        distance: t.distance ?? null,
        duration: t.duration ?? null,
        pace: main.pace,
        paceSource: main.source,
        repetitions: t.repetitions ?? 1,
        description: t.description || '',
        recoveryMode: t.recoveryMode ?? null,
        recoveryDistance: t.recoveryDistance ?? null,
        recoveryDuration: t.recoveryDuration ?? null,
        recoveryPace: rec.pace,
        recoveryPaceSource: rec.source,
        recoveryDescription: t.recoveryDescription || '',
        order: t.order ?? i
      };
      if (t.children?.length) {
        block.children = this.templateToRunBlocks(t.children);
      }
      return block;
    });
  }

  // --- Conversion éditeur → template (on stocke la config zone/%, pas l'allure résolue) ---

  private editorPaceToConfig(pace: string | null | undefined, source: RunBlockPaceSource | undefined): PaceConfig {
    if (source?.mode === 'zone' || source?.mode === 'vmaPercent') {
      return {
        mode: 'zone',
        zone: (source.zone as PaceConfig['zone']) ?? null,
        vmaPercent: source.vmaPercent ?? null,
        absolute: null
      };
    }
    return { mode: 'absolute', zone: null, vmaPercent: null, absolute: pace || null };
  }

  private runBlocksToTemplate(list: RunBlock[]): TemplateRunBlock[] {
    return (list || []).map((b, i) => {
      const block: TemplateRunBlock = {
        role: b.role,
        mode: b.mode,
        distance: b.distance ?? null,
        duration: b.duration ?? null,
        pace: this.editorPaceToConfig(b.pace, b.paceSource),
        repetitions: Math.max(1, b.repetitions || 1),
        description: b.description || '',
        recoveryMode: b.recoveryMode ?? null,
        recoveryDistance: b.recoveryDistance ?? null,
        recoveryDuration: b.recoveryDuration ?? null,
        recoveryPace: b.recoveryMode ? this.editorPaceToConfig(b.recoveryPace, b.recoveryPaceSource) : null,
        recoveryDescription: b.recoveryDescription || '',
        order: i
      };
      if (b.children?.length) {
        block.children = this.runBlocksToTemplate(b.children);
      }
      return block;
    });
  }

  // ===== Strength =====
  addStrengthExercise() {
    const next = [...this.strengthExercises(), {
      exercise: '',
      targetSets: 3,
      targetReps: '8-12',
      targetWeight: undefined,
      targetRest: '60s',
      notes: ''
    }];
    this.strengthExercises.set(next);
  }

  removeStrengthExercise(index: number) {
    this.strengthExercises.set(this.strengthExercises().filter((_, i) => i !== index));
  }

  // Charge décimale : accepte "10,5" comme "10.5" (clavier iOS français)
  parseWeight(raw: string): number | undefined {
    return parseDecimalInput(raw);
  }

  updateStrengthEntry(index: number, field: keyof StrengthExerciseEntry, value: any) {
    const next = [...this.strengthExercises()];
    next[index] = { ...next[index], [field]: value };
    this.strengthExercises.set(next);
  }

  moveStrengthExercise(index: number, delta: -1 | 1) {
    const list = this.strengthExercises();
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    this.strengthExercises.set(next);
  }

  // ===== Circuit =====
  addCircuit() {
    if (this.strengthCircuit()) return;
    this.strengthCircuit.set({
      name: 'Circuit',
      rounds: 3,
      restBetweenRounds: 60,
      exercises: []
    });
  }

  removeCircuit() {
    this.strengthCircuit.set(null);
  }

  updateCircuitField<K extends keyof StrengthCircuit>(field: K, value: StrengthCircuit[K]) {
    const c = this.strengthCircuit();
    if (!c) return;
    this.strengthCircuit.set({ ...c, [field]: value });
  }

  addCircuitExercise() {
    const c = this.strengthCircuit();
    if (!c) return;
    this.strengthCircuit.set({
      ...c,
      exercises: [...c.exercises, { exercise: '', targetSets: 1, targetReps: '12', targetRest: '0s' }]
    });
  }

  removeCircuitExercise(index: number) {
    const c = this.strengthCircuit();
    if (!c) return;
    this.strengthCircuit.set({ ...c, exercises: c.exercises.filter((_, i) => i !== index) });
  }

  updateCircuitExercise(index: number, field: keyof StrengthExerciseEntry, value: any) {
    const c = this.strengthCircuit();
    if (!c) return;
    const next = [...c.exercises];
    next[index] = { ...next[index], [field]: value };
    this.strengthCircuit.set({ ...c, exercises: next });
  }

  moveCircuitExercise(index: number, delta: -1 | 1) {
    const c = this.strengthCircuit();
    if (!c) return;
    const target = index + delta;
    if (target < 0 || target >= c.exercises.length) return;
    const next = [...c.exercises];
    [next[index], next[target]] = [next[target], next[index]];
    this.strengthCircuit.set({ ...c, exercises: next });
  }

  // ===== Superset =====
  addSuperset() {
    if (this.strengthSuperset()) return;
    this.strengthSuperset.set({
      name: 'Super-set',
      sets: 4,
      restBetweenSets: 90,
      pairs: []
    });
  }

  removeSuperset() {
    this.strengthSuperset.set(null);
  }

  updateSupersetField<K extends keyof StrengthSuperset>(field: K, value: StrengthSuperset[K]) {
    const s = this.strengthSuperset();
    if (!s) return;
    this.strengthSuperset.set({ ...s, [field]: value });
  }

  addSupersetPair() {
    const s = this.strengthSuperset();
    if (!s) return;
    this.strengthSuperset.set({
      ...s,
      pairs: [...s.pairs, {
        a: { exercise: '', targetSets: 1, targetReps: '10' },
        b: { exercise: '', targetSets: 1, targetReps: '10' }
      }]
    });
  }

  removeSupersetPair(index: number) {
    const s = this.strengthSuperset();
    if (!s) return;
    this.strengthSuperset.set({ ...s, pairs: s.pairs.filter((_, i) => i !== index) });
  }

  updateSupersetPairSlot(index: number, slot: 'a' | 'b', field: keyof StrengthExerciseEntry, value: any) {
    const s = this.strengthSuperset();
    if (!s) return;
    const next = [...s.pairs];
    next[index] = { ...next[index], [slot]: { ...next[index][slot], [field]: value } };
    this.strengthSuperset.set({ ...s, pairs: next });
  }

  moveSupersetPair(index: number, delta: -1 | 1) {
    const s = this.strengthSuperset();
    if (!s) return;
    const target = index + delta;
    if (target < 0 || target >= s.pairs.length) return;
    const next = [...s.pairs];
    [next[index], next[target]] = [next[target], next[index]];
    this.strengthSuperset.set({ ...s, pairs: next });
  }

  // Steppers (delta) — UX cohérente avec muscu-detail
  setCircuitRounds(delta: number) {
    const c = this.strengthCircuit();
    if (!c) return;
    const next = Math.max(1, (c.rounds ?? 3) + delta);
    this.strengthCircuit.set({ ...c, rounds: next });
  }
  setCircuitRest(delta: number) {
    const c = this.strengthCircuit();
    if (!c) return;
    const next = Math.max(0, (c.restBetweenRounds ?? 60) + delta);
    this.strengthCircuit.set({ ...c, restBetweenRounds: next });
  }
  setSupersetSets(delta: number) {
    const s = this.strengthSuperset();
    if (!s) return;
    const next = Math.max(1, (s.sets ?? 4) + delta);
    this.strengthSuperset.set({ ...s, sets: next });
  }
  setSupersetRest(delta: number) {
    const s = this.strengthSuperset();
    if (!s) return;
    const next = Math.max(0, (s.restBetweenSets ?? 90) + delta);
    this.strengthSuperset.set({ ...s, restBetweenSets: next });
  }

  // Édition inline du nom dans la banner
  editingCircuitName = signal(false);
  editingSupersetName = signal(false);
  setCircuitName(name: string) { this.updateCircuitField('name', name); }
  setSupersetName(name: string) { this.updateSupersetField('name', name); }

  // Helpers d'affichage
  formatRest(seconds?: number): string {
    if (seconds == null) return '—';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? `${m} min` : `${m}min${s.toString().padStart(2, '0')}`;
  }

  getExerciseName(entry: StrengthExerciseEntry | null | undefined): string {
    if (!entry || !entry.exercise) return '—';
    const id = typeof entry.exercise === 'string' ? entry.exercise : (entry.exercise as any)?._id;
    if (!id) return '—';
    const found = this.exercises().find(e => e._id === id);
    return found?.name || '—';
  }

  // ===== Sport switch =====
  setSport(sport: Sport) {
    this.sport.set(sport);
    // Reset session type to a valid one
    this.sessionType.set(sport === 'running' ? 'endurance' : 'full_body');
  }

  // ===== Save / cancel =====
  save() {
    if (!this.name()) {
      this.error.set('Le nom est requis');
      return;
    }
    this.isSaving.set(true);
    this.error.set(null);

    const payload: Partial<SessionTemplate> = {
      name: this.name(),
      description: this.description(),
      sport: this.sport(),
      sessionType: this.sessionType(),
      targetDistance: this.targetDistance(),
      targetDuration: this.targetDuration(),
      warmup: this.warmup(),
      mainWorkout: this.mainWorkout(),
      cooldown: this.cooldown(),
      runBlocks: this.sport() === 'running' ? this.runBlocksToTemplate(this.editorBlocks()) : [],
      strengthPlan: this.sport() === 'strength' ? {
        exercises: this.strengthExercises().filter(e => !!e.exercise),
        circuit: this.strengthCircuit() && this.strengthCircuit()!.exercises.some(e => !!e.exercise)
          ? {
              ...this.strengthCircuit()!,
              exercises: this.strengthCircuit()!.exercises.filter(e => !!e.exercise)
            }
          : undefined,
        superset: this.strengthSuperset() && this.strengthSuperset()!.pairs.some(p => p.a.exercise && p.b.exercise)
          ? {
              ...this.strengthSuperset()!,
              pairs: this.strengthSuperset()!.pairs.filter(p => p.a.exercise && p.b.exercise)
            }
          : undefined,
        estimatedDuration: this.targetDuration() || undefined
      } : null
    };

    const id = this.templateId();
    const obs = id
      ? this.templateService.update(id, payload)
      : this.templateService.create(payload);

    obs.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.router.navigate(['/coach/exercises']);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur lors de la sauvegarde');
        this.isSaving.set(false);
      }
    });
  }

  cancel() {
    this.router.navigate(['/coach/exercises']);
  }
}
