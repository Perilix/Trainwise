import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { StrengthService } from '../../services/strength.service';
import { ExerciseService } from '../../services/exercise.service';
import { PlanningService, PlannedSession } from '../../services/planning.service';
import {
  Exercise,
  StrengthSession,
  ExerciseEntry,
  ExerciseSet,
  StrengthSessionType,
  MuscleGroup,
  StrengthPlanExercise,
  CircuitBlock,
  SupersetBlock,
  MUSCLE_GROUP_LABELS,
  SESSION_TYPE_LABELS
} from '../../interfaces/strength.interfaces';
import { NavbarComponent } from '../../components/navbar/navbar.component';

type EntryOrigin =
  | { kind: 'single'; index: number }
  | { kind: 'circuit'; index: number }
  | { kind: 'superset'; pairIndex: number; slot: 'a' | 'b' };

@Component({
  selector: 'app-strength-log',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent],
  templateUrl: './strength-log.component.html',
  styleUrl: './strength-log.component.scss'
})
export class StrengthLogComponent implements OnInit {
  // Form state
  sessionDate = signal(new Date().toISOString().split('T')[0]);
  sessionType = signal<StrengthSessionType>('full_body');
  sessionDuration = signal<number | undefined>(undefined);
  sessionFeeling = signal<number>(7);
  sessionNotes = signal('');
  exercises = signal<ExerciseEntry[]>([]);

  // Exercise library
  exerciseLibrary = signal<Exercise[]>([]);
  isLoadingExercises = signal(true);

  // Exercise picker modal
  showExercisePicker = signal(false);
  exerciseSearch = signal('');
  exerciseFilterMuscle = signal<MuscleGroup | ''>('');

  // Saving state
  isSaving = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  saved = signal(false); // true après le premier save réussi

  // Linked planned session
  linkedPlannedId = signal<string | null>(null);
  linkedPlannedSession = signal<PlannedSession | null>(null);

  // Origin of each entry, so we can render hints ("Circuit", "Super-set A/B")
  // and let the coach plan inform the athlete's logging UI.
  entryOrigins = signal<EntryOrigin[]>([]);

  // Méta du bloc Circuit / Super-set, soit copiée du plan coach, soit du save précédent
  // (en mode edit). Les exos sous-jacents sont reconstruits à partir des entries.
  sessionCircuit = signal<{ name?: string; rounds?: number; restBetweenRounds?: number } | null>(null);
  sessionSuperset = signal<{ name?: string; sets?: number; restBetweenSets?: number } | null>(null);

  plannedCircuit = computed<CircuitBlock | null>(() => {
    const c = this.linkedPlannedSession()?.strengthPlan?.circuit;
    if (c && c.exercises?.length) return c as CircuitBlock;
    // Pas de plan coach : reconstruit depuis les entries marquées 'circuit'
    return this.buildCircuitFromEntries();
  });
  plannedSuperset = computed<SupersetBlock | null>(() => {
    const s = this.linkedPlannedSession()?.strengthPlan?.superset;
    if (s && s.pairs?.length) return s as SupersetBlock;
    return this.buildSupersetFromEntries();
  });
  hasPlannedStructure = computed(() => !!this.plannedCircuit() || !!this.plannedSuperset());

  private buildCircuitFromEntries(): CircuitBlock | null {
    const meta = this.sessionCircuit();
    const origins = this.entryOrigins();
    const entries = this.exercises();
    const items: StrengthPlanExercise[] = [];
    origins.forEach((o, i) => {
      if (o?.kind === 'circuit') {
        const e = entries[i];
        if (!e) return;
        items.push({
          exercise: e.exercise,
          targetSets: e.target?.sets ?? meta?.rounds ?? e.sets.length,
          targetReps: e.target?.reps ?? String(e.sets[0]?.reps ?? ''),
          targetWeight: e.target?.weight ?? e.sets[0]?.weight,
          targetRest: e.target?.rest,
          notes: e.notes
        });
      }
    });
    if (!items.length) return null;
    return {
      name: meta?.name,
      rounds: meta?.rounds ?? items[0]?.targetSets ?? 3,
      restBetweenRounds: meta?.restBetweenRounds,
      exercises: items
    };
  }

  private buildSupersetFromEntries(): SupersetBlock | null {
    const meta = this.sessionSuperset();
    const origins = this.entryOrigins();
    const entries = this.exercises();
    const pairsMap = new Map<number, { a?: StrengthPlanExercise; b?: StrengthPlanExercise }>();
    origins.forEach((o, i) => {
      if (o?.kind !== 'superset') return;
      const e = entries[i];
      if (!e) return;
      const item: StrengthPlanExercise = {
        exercise: e.exercise,
        targetSets: e.target?.sets ?? meta?.sets ?? e.sets.length,
        targetReps: e.target?.reps ?? String(e.sets[0]?.reps ?? ''),
        targetWeight: e.target?.weight ?? e.sets[0]?.weight,
        targetRest: e.target?.rest,
        notes: e.notes
      };
      const cur = pairsMap.get(o.pairIndex) ?? {};
      cur[o.slot] = item;
      pairsMap.set(o.pairIndex, cur);
    });
    if (!pairsMap.size) return null;
    const pairs = Array.from(pairsMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, p]) => p);
    return {
      name: meta?.name,
      sets: meta?.sets ?? 4,
      restBetweenSets: meta?.restBetweenSets,
      pairs
    };
  }

  serializeCircuitMeta() {
    const hasCircuit = this.entryOrigins().some(o => o?.kind === 'circuit');
    if (!hasCircuit) return null;
    const fromPlan = this.linkedPlannedSession()?.strengthPlan?.circuit;
    return this.sessionCircuit() ?? (fromPlan ? {
      name: fromPlan.name,
      rounds: fromPlan.rounds,
      restBetweenRounds: fromPlan.restBetweenRounds
    } : { rounds: 3 });
  }

  serializeSupersetMeta() {
    const hasSuperset = this.entryOrigins().some(o => o?.kind === 'superset');
    if (!hasSuperset) return null;
    const fromPlan = this.linkedPlannedSession()?.strengthPlan?.superset;
    return this.sessionSuperset() ?? (fromPlan ? {
      name: fromPlan.name,
      sets: fromPlan.sets,
      restBetweenSets: fromPlan.restBetweenSets
    } : { sets: 4 });
  }

  // Edit existing session
  editSessionId = signal<string | null>(null);
  editSessionIsStrava = signal(false);

  // Analyse IA
  isAnalyzing = signal(false);
  analysis = signal<string | null>(null);
  analyzedAt = signal<Date | null>(null);
  analyzeError = signal<string | null>(null);

  // Labels
  sessionTypeLabels = SESSION_TYPE_LABELS;
  muscleGroupLabels = MUSCLE_GROUP_LABELS;

  sessionTypes: StrengthSessionType[] = ['upper_body', 'lower_body', 'full_body', 'push', 'pull', 'legs', 'core', 'hiit', 'other'];
  muscleGroups: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core', 'quadriceps', 'hamstrings', 'glutes', 'calves'];

  filteredExercises = computed(() => {
    let result = this.exerciseLibrary();
    const search = this.exerciseSearch().toLowerCase();
    const muscle = this.exerciseFilterMuscle();

    if (search) {
      result = result.filter(e => e.name.toLowerCase().includes(search));
    }
    if (muscle) {
      result = result.filter(e => e.muscleGroups.includes(muscle) || e.primaryMuscle === muscle);
    }

    return result;
  });

  constructor(
    private strengthService: StrengthService,
    private exerciseService: ExerciseService,
    private planningService: PlanningService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location
  ) {}

  goBack() {
    const dateStr = this.sessionDate();
    if (dateStr) {
      this.router.navigate(['/planning'], { queryParams: { openDay: dateStr } });
    } else {
      this.location.back();
    }
  }

  ngOnInit() {
    this.loadExerciseLibrary();

    // Check query params: edit existing session OR log from a planned session
    this.route.queryParams.subscribe(params => {
      const sessionId = params['sessionId'];
      if (sessionId) {
        this.editSessionId.set(sessionId);
        this.loadExistingSession(sessionId);
        return;
      }
      const plannedId = params['plannedId'];
      if (plannedId) {
        this.linkedPlannedId.set(plannedId);
        this.loadPlannedSession(plannedId);
      }
    });
  }

  loadExistingSession(id: string) {
    this.strengthService.getSession(id).subscribe({
      next: (session) => {
        this.editSessionIsStrava.set(!!session.stravaActivityId);
        if (session.date) {
          const d = new Date(session.date);
          this.sessionDate.set(d.toISOString().split('T')[0]);
        }
        if (session.sessionType) {
          this.sessionType.set(session.sessionType as StrengthSessionType);
        }
        if (session.duration) this.sessionDuration.set(session.duration);
        if (session.feeling) this.sessionFeeling.set(session.feeling);
        if (session.notes) this.sessionNotes.set(session.notes);
        if (session.circuit) this.sessionCircuit.set(session.circuit);
        if (session.superset) this.sessionSuperset.set(session.superset);
        if (session.exercises?.length) {
          const library = this.exerciseLibrary();
          const origins: EntryOrigin[] = [];
          const entries: ExerciseEntry[] = session.exercises.map((e, i) => {
            let exercise: Exercise | string = e.exercise;
            if (typeof exercise === 'string' && library.length) {
              exercise = library.find(ex => ex._id === exercise) ?? exercise;
            }
            const block = (e as any).block;
            if (block?.kind === 'circuit') {
              origins.push({ kind: 'circuit', index: origins.filter(o => o?.kind === 'circuit').length });
            } else if (block?.kind === 'superset') {
              origins.push({
                kind: 'superset',
                pairIndex: block.pairIndex ?? 0,
                slot: (block.slot ?? 'a') as 'a' | 'b'
              });
            } else {
              origins.push({ kind: 'single', index: i });
            }
            return {
              exercise,
              sets: e.sets?.length ? e.sets : [{ reps: 10, weight: 0 }],
              order: i,
              notes: e.notes,
              target: (e as any).target ?? undefined
            };
          });
          this.exercises.set(entries);
          this.entryOrigins.set(origins);
        }
        if (session.analysis) {
          this.analysis.set(session.analysis);
          this.analyzedAt.set(session.analyzedAt ? new Date(session.analyzedAt) : null);
        }
      },
      error: (err) => {
        console.error('Failed to load existing session:', err);
        this.error.set('Séance non trouvée');
      }
    });
  }

  loadPlannedSession(id: string) {
    this.planningService.getPlannedSessionById(id).subscribe({
      next: (planned) => {
        this.linkedPlannedSession.set(planned);
        if (planned.date) {
          const date = new Date(planned.date);
          this.sessionDate.set(date.toISOString().split('T')[0]);
        }
        if (planned.sessionType) {
          this.sessionType.set(planned.sessionType as StrengthSessionType);
        }
        if (planned.targetDuration) {
          this.sessionDuration.set(planned.targetDuration);
        }
        const plan = planned.strengthPlan;
        if (plan && (plan.exercises?.length || plan.circuit?.exercises?.length || plan.superset?.pairs?.length)) {
          this.buildEntriesFromPlan(plan);
        }
      },
      error: (err) => {
        console.error('Failed to load planned session:', err);
      }
    });
  }

  buildEntriesFromPlan(plan: any) {
    const library = this.exerciseLibrary();
    const resolveExercise = (raw: any): Exercise | string => {
      if (!raw) return '';
      if (typeof raw === 'string') return library.find(e => e._id === raw) ?? raw;
      return raw;
    };

    const buildSets = (pe: any, count?: number) => {
      const n = Math.max(1, count ?? pe.targetSets ?? 3);
      return Array.from({ length: n }, () => ({
        reps: parseInt((pe.targetReps ?? '').split('-')[0]) || 10,
        weight: pe.targetWeight ?? undefined
      }));
    };

    const buildTarget = (pe: any, sets?: number) => ({
      sets: sets ?? pe.targetSets,
      reps: pe.targetReps,
      weight: pe.targetWeight,
      rest: pe.targetRest
    });

    const entries: ExerciseEntry[] = [];
    const origins: EntryOrigin[] = [];
    let order = 0;

    (plan.exercises ?? []).forEach((pe: any, i: number) => {
      entries.push({
        exercise: resolveExercise(pe.exercise),
        order: order++,
        sets: buildSets(pe),
        notes: pe.notes,
        target: buildTarget(pe)
      });
      origins.push({ kind: 'single', index: i });
    });

    if (plan.circuit?.exercises?.length) {
      const rounds = plan.circuit.rounds ?? 3;
      plan.circuit.exercises.forEach((pe: any, i: number) => {
        entries.push({
          exercise: resolveExercise(pe.exercise),
          order: order++,
          sets: buildSets(pe, rounds),
          notes: pe.notes,
          target: buildTarget(pe, rounds)
        });
        origins.push({ kind: 'circuit', index: i });
      });
    }

    if (plan.superset?.pairs?.length) {
      const sets = plan.superset.sets ?? 4;
      plan.superset.pairs.forEach((pair: any, pairIndex: number) => {
        (['a', 'b'] as const).forEach(slot => {
          const pe = pair[slot];
          if (!pe) return;
          entries.push({
            exercise: resolveExercise(pe.exercise),
            order: order++,
            sets: buildSets(pe, sets),
            notes: pe.notes,
            target: buildTarget(pe, sets)
          });
          origins.push({ kind: 'superset', pairIndex, slot });
        });
      });
    }

    this.exercises.set(entries);
    this.entryOrigins.set(origins);
  }

  loadExerciseLibrary() {
    this.exerciseService.getExercises().subscribe({
      next: (exercises) => {
        this.exerciseLibrary.set(exercises);
        this.isLoadingExercises.set(false);
        // Re-resolve any exercises that came as string IDs before library was ready
        const pending = this.exercises();
        if (pending.some(e => typeof e.exercise === 'string')) {
          const resolved = pending.map(e => ({
            ...e,
            exercise: typeof e.exercise === 'string'
              ? (exercises.find(ex => ex._id === e.exercise) ?? e.exercise)
              : e.exercise
          }));
          this.exercises.set(resolved);
        }
        // Re-resolve exercises inside the planned circuit/superset blocks too
        const planned = this.linkedPlannedSession();
        if (planned?.strengthPlan) {
          this.linkedPlannedSession.set({ ...planned });
        }
      },
      error: (err) => {
        console.error('Failed to load exercises:', err);
        this.isLoadingExercises.set(false);
      }
    });
  }

  resolvePlannedExercise(raw: any): Exercise | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
      return this.exerciseLibrary().find(e => e._id === raw) ?? null;
    }
    return raw as Exercise;
  }

  getPlannedExerciseName(pe: StrengthPlanExercise | undefined | null): string {
    if (!pe) return '—';
    const ex = this.resolvePlannedExercise(pe.exercise);
    if (ex) return ex.name;
    if (typeof pe.exercise === 'string') return 'Exercice';
    return '—';
  }

  formatRest(seconds: number | undefined | null): string {
    if (!seconds) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s ? `${m}m${s.toString().padStart(2, '0')}` : `${m}min`;
  }

  openExercisePicker() {
    this.exerciseSearch.set('');
    this.exerciseFilterMuscle.set('');
    this.showExercisePicker.set(true);
  }

  closeExercisePicker() {
    this.showExercisePicker.set(false);
  }

  addExercise(exercise: Exercise) {
    const newEntry: ExerciseEntry = {
      exercise: exercise,
      sets: [{ reps: 10, weight: 0 }],
      order: this.exercises().length
    };
    this.exercises.update(list => [...list, newEntry]);
    // Manually-added entries have no plan origin
    this.entryOrigins.update(list => [...list, null as any]);
    this.closeExercisePicker();
  }

  removeExercise(index: number) {
    this.exercises.update(list => list.filter((_, i) => i !== index));
    this.entryOrigins.update(list => list.filter((_, i) => i !== index));
  }

  addSet(exerciseIndex: number) {
    this.exercises.update(list => {
      const updated = [...list];
      const lastSet = updated[exerciseIndex].sets[updated[exerciseIndex].sets.length - 1];
      updated[exerciseIndex].sets.push({
        reps: lastSet?.reps || 10,
        weight: lastSet?.weight || 0
      });
      return updated;
    });
  }

  removeSet(exerciseIndex: number, setIndex: number) {
    this.exercises.update(list => {
      const updated = [...list];
      if (updated[exerciseIndex].sets.length > 1) {
        updated[exerciseIndex].sets = updated[exerciseIndex].sets.filter((_, i) => i !== setIndex);
      }
      return updated;
    });
  }

  updateSet(exerciseIndex: number, setIndex: number, field: keyof ExerciseSet, value: number | undefined) {
    this.exercises.update(list => {
      const updated = [...list];
      (updated[exerciseIndex].sets[setIndex] as any)[field] = value;
      return updated;
    });
  }

  getExercise(entry: ExerciseEntry): Exercise {
    return entry.exercise as Exercise;
  }

  getPlanTarget(index: number): string | null {
    const plan = this.linkedPlannedSession()?.strengthPlan;
    if (!plan) return null;
    const origin = this.entryOrigins()[index];
    let pe: StrengthPlanExercise | undefined;
    let context = '';

    if (origin?.kind === 'circuit') {
      pe = plan.circuit?.exercises?.[origin.index] as StrengthPlanExercise | undefined;
      const rounds = plan.circuit?.rounds ?? 3;
      context = `Circuit · ${rounds} tours`;
    } else if (origin?.kind === 'superset') {
      const pair = plan.superset?.pairs?.[origin.pairIndex];
      pe = pair?.[origin.slot] as StrengthPlanExercise | undefined;
      const sets = plan.superset?.sets ?? 4;
      context = `Super-set · paire ${origin.pairIndex + 1}${origin.slot.toUpperCase()} · ${sets} séries`;
    } else if (origin?.kind === 'single' || !origin) {
      const i = origin?.index ?? index;
      pe = plan.exercises?.[i] as StrengthPlanExercise | undefined;
    }

    if (!pe) return null;
    const targets: string[] = [];
    if (pe.targetSets) targets.push(`${pe.targetSets} × ${pe.targetReps}`);
    else if (pe.targetReps) targets.push(pe.targetReps);
    if (pe.targetWeight) targets.push(`@ ${pe.targetWeight}kg`);
    if (pe.targetRest) targets.push(`repos ${pe.targetRest}`);
    const targetText = targets.join(' ');
    return context ? `${context} — ${targetText}` : targetText || null;
  }

  getEntryBadge(index: number): { label: string; kind: 'circuit' | 'superset' } | null {
    const origin = this.entryOrigins()[index];
    if (!origin) return null;
    if (origin.kind === 'circuit') return { label: 'Circuit', kind: 'circuit' };
    if (origin.kind === 'superset') {
      return {
        label: `Super-set ${origin.pairIndex + 1}${origin.slot.toUpperCase()}`,
        kind: 'superset'
      };
    }
    return null;
  }

  getMuscleLabel(muscle: MuscleGroup): string {
    return this.muscleGroupLabels[muscle] || muscle;
  }

  getSessionTypeLabel(type: StrengthSessionType): string {
    return this.sessionTypeLabels[type] || type;
  }

  calculateTotalSets(): number {
    return this.exercises().reduce((sum, e) => sum + e.sets.length, 0);
  }

  calculateTotalVolume(): number {
    return this.exercises().reduce((sum, e) => {
      return sum + e.sets.reduce((setSum, s) => setSum + (s.reps * (s.weight || 0)), 0);
    }, 0);
  }

  saveSession() {
    if (this.exercises().length === 0) {
      this.error.set('Ajoutez au moins un exercice');
      return;
    }

    this.isSaving.set(true);
    this.error.set(null);

    const plannedId = this.linkedPlannedId();
    const editId = this.editSessionId();

    const origins = this.entryOrigins();
    const session: Partial<StrengthSession> = {
      date: new Date(this.sessionDate()),
      sessionType: this.sessionType(),
      duration: this.sessionDuration(),
      feeling: this.sessionFeeling(),
      notes: this.sessionNotes() || undefined,
      exercises: this.exercises().map((e, i) => {
        const origin = origins[i];
        const block: ExerciseEntry['block'] = origin?.kind === 'circuit'
          ? { kind: 'circuit' }
          : origin?.kind === 'superset'
            ? { kind: 'superset', pairIndex: origin.pairIndex, slot: origin.slot }
            : { kind: 'single' };
        return {
          exercise: typeof e.exercise === 'string' ? e.exercise : (e.exercise as Exercise)._id,
          sets: e.sets,
          order: i,
          notes: e.notes,
          block,
          target: e.target
        } as any;
      }),
      circuit: this.serializeCircuitMeta(),
      superset: this.serializeSupersetMeta(),
      ...(plannedId && !editId ? { linkedPlannedSession: plannedId } : {})
    };

    const obs = editId
      ? this.strengthService.updateSession(editId, session)
      : this.strengthService.createSession(session);

    obs.subscribe({
      next: (saved) => {
        this.isSaving.set(false);
        this.saved.set(true);
        this.successMessage.set(editId ? 'Séance mise à jour !' : 'Séance enregistrée !');
        // Si c'était une création, on bascule en mode edit + on met à jour l'URL
        // pour que la page soit "sur" la séance enregistrée (refresh-safe, sharable)
        if (!editId && saved._id) {
          this.editSessionId.set(saved._id);
          this.linkedPlannedId.set(null);
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { sessionId: saved._id, plannedId: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
          });
          // Auto-déclenchement de l'analyse IA après la 1re sauvegarde
          this.analyzeSession();
        }
        setTimeout(() => this.successMessage.set(null), 4000);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur lors de l\'enregistrement');
        this.isSaving.set(false);
        console.error(err);
      }
    });
  }

  analyzeSession() {
    const id = this.editSessionId();
    if (!id) return;
    this.isAnalyzing.set(true);
    this.analyzeError.set(null);
    this.strengthService.analyzeSession(id).subscribe({
      next: (updated) => {
        this.isAnalyzing.set(false);
        if (updated.analysis) {
          this.analysis.set(updated.analysis);
          this.analyzedAt.set(updated.analyzedAt ? new Date(updated.analyzedAt) : new Date());
        }
      },
      error: (err) => {
        this.isAnalyzing.set(false);
        if (err.status === 402) {
          this.analyzeError.set('Crédits IA insuffisants');
        } else {
          this.analyzeError.set('Erreur lors de l\'analyse');
        }
        console.error(err);
      }
    });
  }
}
