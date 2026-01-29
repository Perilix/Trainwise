import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StrengthService } from '../../services/strength.service';
import { ExerciseService } from '../../services/exercise.service';
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
    private router: Router
  ) {}

  ngOnInit() {
    this.loadExerciseLibrary();
  }

  loadExerciseLibrary() {
    this.exerciseService.getExercises().subscribe({
      next: (exercises) => {
        this.exerciseLibrary.set(exercises);
        this.isLoadingExercises.set(false);
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
      }))
    };

    this.strengthService.createSession(session).subscribe({
      next: () => {
        this.successMessage.set('Séance enregistrée !');
        setTimeout(() => {
          this.router.navigate(['/planning']);
        }, 1500);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur lors de l\'enregistrement');
        this.isSaving.set(false);
        console.error(err);
      }
    });
  }
}
