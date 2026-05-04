import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CoachService } from '../../../services/coach.service';
import { ExerciseService } from '../../../services/exercise.service';
import { PlannedSession } from '../../../services/planning.service';
import {
  Exercise, StrengthPlanExercise, CircuitBlock, SupersetBlock, SupersetPair,
  MuscleGroup, StrengthSessionType,
  MUSCLE_GROUP_LABELS, SESSION_TYPE_LABELS as STRENGTH_SESSION_LABELS
} from '../../../interfaces/strength.interfaces';
import { NavbarComponent } from '../../../components/navbar/navbar.component';

type WorkoutMode = 'single' | 'circuit' | 'superset';
type PickerTarget =
  | { kind: 'single' }
  | { kind: 'circuit' }
  | { kind: 'superset'; pairIndex: number; slot: 'a' | 'b' };

const DEFAULT_CIRCUIT: CircuitBlock = { name: 'Nouveau circuit', rounds: 3, restBetweenRounds: 60, exercises: [] };
const DEFAULT_SUPERSET: SupersetBlock = { name: 'Nouveau super-set', sets: 4, restBetweenSets: 90, pairs: [] };

interface DraftMuscuSession {
  date: string;
  sessionType: StrengthSessionType;
  description: string;
}

const MUSCU_DRAFT_KEY = 'muscuDetail.draftSession';

@Component({
  selector: 'app-muscu-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './muscu-detail.component.html',
  styleUrl: './muscu-detail.component.scss'
})
export class MuscuDetailComponent implements OnInit {
  athleteId = '';
  sessionId = '';

  session = signal<PlannedSession | null>(null);
  draft = signal<DraftMuscuSession | null>(null);
  completedSession = signal<any | null>(null);
  isStandalone = signal(false);
  isLoading = signal(true);
  isLoadingCompleted = signal(false);
  isSaving = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  draftSessionType = signal<StrengthSessionType>('full_body');
  draftDate = signal<Date | null>(null);
  description = signal('');

  isNew = computed(() => this.sessionId === 'new');

  currentSessionType = computed<string>(() => {
    if (this.isNew()) return this.draftSessionType();
    return this.session()?.sessionType || '';
  });

  currentDate = computed<Date | null>(() => {
    if (this.isNew()) return this.draftDate();
    const s = this.session();
    return s ? new Date(s.date) : null;
  });

  canEdit = computed<boolean>(() => {
    if (this.isNew()) return true;
    return this.session()?.status === 'planned';
  });

  hasContext = computed<boolean>(() => {
    return !!this.session() || (this.isNew() && !!this.draft());
  });

  planExercises = signal<StrengthPlanExercise[]>([]);
  circuit = signal<CircuitBlock>({ ...DEFAULT_CIRCUIT, exercises: [] });
  superset = signal<SupersetBlock>({ ...DEFAULT_SUPERSET, pairs: [] });
  activeMode = signal<WorkoutMode>('single');
  editingCircuitName = signal(false);
  editingSupersetName = signal(false);

  showExercisePicker = signal(false);
  pickerTarget = signal<PickerTarget>({ kind: 'single' });
  circuitDragIndex = signal<number | null>(null);
  circuitDragOverIndex = signal<number | null>(null);
  exerciseSearch = signal('');
  exerciseFilterMuscle = signal<MuscleGroup | ''>('');
  exerciseLibrary = signal<Exercise[]>([]);
  isLoadingExercises = signal(false);

  filteredExercises = computed(() => {
    const search = this.exerciseSearch().toLowerCase();
    const muscle = this.exerciseFilterMuscle();
    return this.exerciseLibrary().filter(e => {
      const matchSearch = !search || e.name.toLowerCase().includes(search);
      const matchMuscle = !muscle || e.muscleGroups.includes(muscle) || e.primaryMuscle === muscle;
      return matchSearch && matchMuscle;
    });
  });

  muscleGroupLabels = MUSCLE_GROUP_LABELS;
  muscleGroups: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core', 'quadriceps', 'hamstrings', 'glutes', 'calves'];
  strengthSessionLabels = STRENGTH_SESSION_LABELS;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private coachService: CoachService,
    private exerciseService: ExerciseService
  ) {}

  ngOnInit() {
    this.athleteId = this.route.snapshot.paramMap.get('athleteId') || '';
    this.sessionId = this.route.snapshot.paramMap.get('sessionId') || '';
    const type = this.route.snapshot.queryParamMap.get('type');
    if (!this.athleteId || !this.sessionId) {
      this.error.set('Paramètres manquants');
      this.isLoading.set(false);
      return;
    }
    if (this.sessionId === 'new') {
      this.initDraft();
    } else if (type === 'strength') {
      this.loadStandaloneStrengthSession();
    } else {
      this.loadSession();
    }
  }

  private initDraft() {
    const navState = (this.router.getCurrentNavigation()?.extras?.state || history.state) as any;
    let draft: DraftMuscuSession | null = navState?.draftSession || null;
    if (!draft) {
      try {
        const stored = sessionStorage.getItem(MUSCU_DRAFT_KEY);
        if (stored) draft = JSON.parse(stored);
      } catch {}
    } else {
      try { sessionStorage.setItem(MUSCU_DRAFT_KEY, JSON.stringify(draft)); } catch {}
    }
    if (!draft) {
      this.router.navigate(['/coach/athletes', this.athleteId, 'planning']);
      return;
    }
    this.draft.set(draft);
    this.draftDate.set(new Date(draft.date));
    this.draftSessionType.set(draft.sessionType);
    this.description.set(draft.description || '');
    this.planExercises.set([]);
    this.isLoading.set(false);
  }

  loadSession() {
    this.isLoading.set(true);
    this.coachService.getAthletePlannedSession(this.athleteId, this.sessionId).subscribe({
      next: (session) => {
        this.session.set(session);
        this.description.set(session.description || '');
        const exercises = session.strengthPlan?.exercises ?? [];
        this.planExercises.set(exercises as StrengthPlanExercise[]);
        const c = session.strengthPlan?.circuit;
        if (c && c.exercises?.length) {
          this.circuit.set({
            name: c.name || DEFAULT_CIRCUIT.name,
            rounds: c.rounds ?? DEFAULT_CIRCUIT.rounds,
            restBetweenRounds: c.restBetweenRounds ?? DEFAULT_CIRCUIT.restBetweenRounds,
            exercises: c.exercises as StrengthPlanExercise[]
          });
        }
        const s = session.strengthPlan?.superset;
        if (s && s.pairs?.length) {
          this.superset.set({
            name: s.name || DEFAULT_SUPERSET.name,
            sets: s.sets ?? DEFAULT_SUPERSET.sets,
            restBetweenSets: s.restBetweenSets ?? DEFAULT_SUPERSET.restBetweenSets,
            pairs: s.pairs as SupersetPair[]
          });
        }
        this.isLoading.set(false);
        if (session.status === 'completed') {
          this.loadCompletedSession();
        }
      },
      error: (err) => {
        if (err?.status === 404) {
          this.loadStandaloneStrengthSession();
        } else {
          this.error.set('Impossible de charger la séance');
          this.isLoading.set(false);
        }
      }
    });
  }

  loadStandaloneStrengthSession() {
    this.isLoading.set(true);
    this.coachService.getAthleteStrengthSessionById(this.athleteId, this.sessionId).subscribe({
      next: (session) => {
        this.completedSession.set(session);
        this.isStandalone.set(true);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger la séance');
        this.isLoading.set(false);
      }
    });
  }

  loadCompletedSession() {
    this.isLoadingCompleted.set(true);
    this.coachService.getAthleteStrengthSession(this.athleteId, this.sessionId).subscribe({
      next: (session) => {
        this.completedSession.set(session);
        this.isLoadingCompleted.set(false);
      },
      error: () => {
        this.isLoadingCompleted.set(false);
      }
    });
  }

  saveExercises() {
    if (this.isNew()) {
      this.createSession();
    } else {
      this.updateSession();
    }
  }

  private serializeExercise(e: StrengthPlanExercise) {
    return {
      exercise: typeof e.exercise === 'string' ? e.exercise : (e.exercise as Exercise)._id,
      targetSets: e.targetSets,
      targetReps: e.targetReps,
      targetWeight: e.targetWeight,
      targetRest: e.targetRest,
      notes: e.notes
    };
  }

  private buildStrengthPlan(): any {
    const plan: any = {
      exercises: this.planExercises().map(e => this.serializeExercise(e))
    };

    const c = this.circuit();
    if (c.exercises.length > 0) {
      plan.circuit = {
        name: c.name,
        rounds: c.rounds,
        restBetweenRounds: c.restBetweenRounds,
        exercises: c.exercises.map(e => this.serializeExercise(e))
      };
    } else {
      plan.circuit = null;
    }

    const s = this.superset();
    const filledPairs = s.pairs.filter(p => p.a || p.b);
    if (filledPairs.length > 0) {
      plan.superset = {
        name: s.name,
        sets: s.sets,
        restBetweenSets: s.restBetweenSets,
        pairs: filledPairs.map(p => ({
          a: p.a ? this.serializeExercise(p.a) : undefined,
          b: p.b ? this.serializeExercise(p.b) : undefined
        }))
      };
    } else {
      plan.superset = null;
    }

    return plan;
  }

  private updateSession() {
    const session = this.session();
    if (!session?._id) return;
    this.isSaving.set(true);
    const strengthPlan = {
      ...this.buildStrengthPlan(),
      estimatedDuration: session.targetDuration
    };
    const updates: any = { strengthPlan, description: this.description() || undefined };
    this.coachService.updateAthleteSession(this.athleteId, session._id, updates).subscribe({
      next: (updated) => {
        this.isSaving.set(false);
        this.session.set(updated);
        this.successMessage.set('Exercices sauvegardés');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: () => {
        this.error.set('Erreur lors de la sauvegarde');
        this.isSaving.set(false);
      }
    });
  }

  private createSession() {
    const draft = this.draft();
    if (!draft) return;
    this.isSaving.set(true);
    const payload: any = {
      date: new Date(draft.date),
      activityType: 'strength',
      sessionType: this.draftSessionType(),
      description: this.description() || undefined,
      strengthPlan: this.buildStrengthPlan(),
      status: 'planned'
    };
    this.coachService.createAthleteSession(this.athleteId, payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        try { sessionStorage.removeItem(MUSCU_DRAFT_KEY); } catch {}
        const d = new Date(draft.date);
        const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        this.router.navigate(
          ['/coach/athletes', this.athleteId, 'planning'],
          { queryParams: { openDay: dayKey } }
        );
      },
      error: () => {
        this.isSaving.set(false);
        this.error.set('Erreur lors de la création');
      }
    });
  }

  openExercisePicker(target: PickerTarget = { kind: 'single' }) {
    this.pickerTarget.set(target);
    this.exerciseSearch.set('');
    this.exerciseFilterMuscle.set('');
    this.showExercisePicker.set(true);
    if (this.exerciseLibrary().length === 0) {
      this.isLoadingExercises.set(true);
      this.exerciseService.getExercises().subscribe({
        next: (exercises) => {
          this.exerciseLibrary.set(exercises);
          this.isLoadingExercises.set(false);
        },
        error: () => this.isLoadingExercises.set(false)
      });
    }
  }

  closeExercisePicker() {
    this.showExercisePicker.set(false);
  }

  pickExercise(exercise: Exercise) {
    const target = this.pickerTarget();
    const entry: StrengthPlanExercise = { exercise, targetSets: 3, targetReps: '10' };
    if (target.kind === 'single') {
      this.planExercises.update(list => [...list, entry]);
    } else if (target.kind === 'circuit') {
      this.circuit.update(c => ({ ...c, exercises: [...c.exercises, entry] }));
    } else {
      this.superset.update(s => {
        const pairs = s.pairs.map((p, i) =>
          i === target.pairIndex ? { ...p, [target.slot]: entry } : p
        );
        return { ...s, pairs };
      });
    }
    this.closeExercisePicker();
  }

  removePlanExercise(index: number) {
    this.planExercises.update(list => list.filter((_, i) => i !== index));
  }

  updatePlanExercise(index: number, field: keyof StrengthPlanExercise, value: any) {
    this.planExercises.update(list => {
      const updated = [...list];
      (updated[index] as any)[field] = value;
      return updated;
    });
  }

  // ---------- Circuit helpers ----------
  setCircuitName(name: string) {
    this.circuit.update(c => ({ ...c, name }));
  }
  setCircuitRounds(delta: number) {
    this.circuit.update(c => ({
      ...c,
      rounds: Math.min(20, Math.max(1, c.rounds + delta))
    }));
  }
  setCircuitRest(delta: number) {
    this.circuit.update(c => ({
      ...c,
      restBetweenRounds: Math.min(600, Math.max(0, (c.restBetweenRounds ?? 0) + delta))
    }));
  }
  removeCircuitExercise(index: number) {
    this.circuit.update(c => ({ ...c, exercises: c.exercises.filter((_, i) => i !== index) }));
  }
  moveCircuitExercise(from: number, to: number) {
    if (from === to) return;
    this.circuit.update(c => {
      if (from < 0 || from >= c.exercises.length || to < 0 || to >= c.exercises.length) return c;
      const exercises = [...c.exercises];
      const [moved] = exercises.splice(from, 1);
      exercises.splice(to, 0, moved);
      return { ...c, exercises };
    });
  }
  // Drag-and-drop handlers (circuit reorder)
  onCircuitDragStart(index: number, ev: DragEvent) {
    this.circuitDragIndex.set(index);
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', String(index));
      const node = (ev.target as HTMLElement)?.closest?.('.flow-node') as HTMLElement | null;
      if (node) ev.dataTransfer.setDragImage(node, 20, 20);
    }
  }
  onCircuitDragOver(index: number, ev: DragEvent) {
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    this.circuitDragOverIndex.set(index);
  }
  onCircuitDrop(index: number, ev: DragEvent) {
    ev.preventDefault();
    const from = this.circuitDragIndex();
    if (from !== null) this.moveCircuitExercise(from, index);
    this.circuitDragIndex.set(null);
    this.circuitDragOverIndex.set(null);
  }
  onCircuitDragEnd() {
    this.circuitDragIndex.set(null);
    this.circuitDragOverIndex.set(null);
  }
  updateCircuitExercise(index: number, field: keyof StrengthPlanExercise, value: any) {
    this.circuit.update(c => {
      const exercises = [...c.exercises];
      (exercises[index] as any)[field] = value;
      return { ...c, exercises };
    });
  }
  resetCircuit() {
    this.circuit.set({ ...DEFAULT_CIRCUIT, exercises: [] });
  }

  // ---------- Super-set helpers ----------
  setSupersetName(name: string) {
    this.superset.update(s => ({ ...s, name }));
  }
  setSupersetSets(delta: number) {
    this.superset.update(s => ({
      ...s,
      sets: Math.min(20, Math.max(1, s.sets + delta))
    }));
  }
  setSupersetRest(delta: number) {
    this.superset.update(s => ({
      ...s,
      restBetweenSets: Math.min(600, Math.max(0, (s.restBetweenSets ?? 0) + delta))
    }));
  }
  addSupersetPair() {
    this.superset.update(s => ({ ...s, pairs: [...s.pairs, {}] }));
  }
  removeSupersetPair(index: number) {
    this.superset.update(s => ({ ...s, pairs: s.pairs.filter((_, i) => i !== index) }));
  }
  moveSupersetPair(index: number, dir: -1 | 1) {
    this.superset.update(s => {
      const target = index + dir;
      if (target < 0 || target >= s.pairs.length) return s;
      const pairs = [...s.pairs];
      [pairs[index], pairs[target]] = [pairs[target], pairs[index]];
      return { ...s, pairs };
    });
  }
  removeSupersetSlot(pairIndex: number, slot: 'a' | 'b') {
    this.superset.update(s => {
      const pairs = s.pairs.map((p, i) => {
        if (i !== pairIndex) return p;
        const np = { ...p };
        delete np[slot];
        return np;
      });
      return { ...s, pairs };
    });
  }
  updateSupersetSlot(pairIndex: number, slot: 'a' | 'b', field: keyof StrengthPlanExercise, value: any) {
    this.superset.update(s => {
      const pairs = s.pairs.map((p, i) => {
        if (i !== pairIndex) return p;
        const current = p[slot];
        if (!current) return p;
        return { ...p, [slot]: { ...current, [field]: value } };
      });
      return { ...s, pairs };
    });
  }

  getExerciseName(entry: StrengthPlanExercise): string {
    if (typeof entry.exercise === 'string') return entry.exercise;
    return (entry.exercise as Exercise).name;
  }

  formatRest(seconds: number | undefined): string {
    if (!seconds) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s ? `${m}m${s.toString().padStart(2, '0')}` : `${m}min`;
  }

  getSessionTypeLabel(type: string): string {
    return (this.strengthSessionLabels as any)[type] ?? type;
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  goBack() {
    const session = this.session();
    const date = session ? new Date(session.date) : this.draftDate();
    if (date) {
      const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      this.router.navigate(
        ['/coach/athletes', this.athleteId, 'planning'],
        { queryParams: { openDay: dayKey } }
      );
    } else {
      this.router.navigate(['/coach/athletes', this.athleteId, 'planning']);
    }
  }
}
