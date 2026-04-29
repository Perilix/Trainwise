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
  MUSCLE_GROUP_LABELS,
  SESSION_TYPE_LABELS
} from '../../interfaces/strength.interfaces';
import { NavbarComponent } from '../../components/navbar/navbar.component';

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
    this.location.back();
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
        if (session.exercises?.length) {
          const library = this.exerciseLibrary();
          const entries: ExerciseEntry[] = session.exercises.map((e, i) => {
            let exercise: Exercise | string = e.exercise;
            if (typeof exercise === 'string' && library.length) {
              exercise = library.find(ex => ex._id === exercise) ?? exercise;
            }
            return {
              exercise,
              sets: e.sets?.length ? e.sets : [{ reps: 10, weight: 0 }],
              order: i,
              notes: e.notes
            };
          });
          this.exercises.set(entries);
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
        // Pre-populate exercises from coach's strength plan
        if (planned.strengthPlan?.exercises?.length) {
          this.buildEntriesFromPlan(planned.strengthPlan.exercises);
        }
      },
      error: (err) => {
        console.error('Failed to load planned session:', err);
      }
    });
  }

  buildEntriesFromPlan(planExercises: any[]) {
    const library = this.exerciseLibrary();
    const entries: ExerciseEntry[] = planExercises.map((pe, i) => {
      let exercise: Exercise | string = pe.exercise;
      // If backend didn't populate (string ID), resolve from already-loaded library
      if (typeof exercise === 'string') {
        exercise = library.find(e => e._id === exercise) ?? exercise;
      }
      return {
        exercise,
        order: i,
        sets: Array.from({ length: pe.targetSets ?? 3 }, () => ({
          reps: parseInt((pe.targetReps ?? '').split('-')[0]) || 10,
          weight: pe.targetWeight ?? undefined
        })),
        notes: pe.notes
      };
    });
    this.exercises.set(entries);
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
      },
      error: (err) => {
        console.error('Failed to load exercises:', err);
        this.isLoadingExercises.set(false);
      }
    });
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
    this.closeExercisePicker();
  }

  removeExercise(index: number) {
    this.exercises.update(list => list.filter((_, i) => i !== index));
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
    if (!plan?.exercises?.[index]) return null;
    const pe = plan.exercises[index];
    let hint = `${pe.targetSets} × ${pe.targetReps}`;
    if (pe.targetWeight) hint += ` @ ${pe.targetWeight}kg`;
    if (pe.targetRest) hint += ` — repos ${pe.targetRest}s`;
    return hint;
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

    const session: Partial<StrengthSession> = {
      date: new Date(this.sessionDate()),
      sessionType: this.sessionType(),
      duration: this.sessionDuration(),
      feeling: this.sessionFeeling(),
      notes: this.sessionNotes() || undefined,
      exercises: this.exercises().map((e, i) => ({
        exercise: typeof e.exercise === 'string' ? e.exercise : (e.exercise as Exercise)._id,
        sets: e.sets,
        order: i
      })),
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
