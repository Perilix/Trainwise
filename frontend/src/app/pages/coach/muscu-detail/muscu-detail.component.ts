import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CoachService } from '../../../services/coach.service';
import { ExerciseService } from '../../../services/exercise.service';
import { PlannedSession } from '../../../services/planning.service';
import {
  Exercise, StrengthPlanExercise, MuscleGroup,
  MUSCLE_GROUP_LABELS, SESSION_TYPE_LABELS as STRENGTH_SESSION_LABELS
} from '../../../interfaces/strength.interfaces';
import { NavbarComponent } from '../../../components/navbar/navbar.component';

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
  completedSession = signal<any | null>(null);
  isLoading = signal(true);
  isLoadingCompleted = signal(false);
  isSaving = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  planExercises = signal<StrengthPlanExercise[]>([]);
  showExercisePicker = signal(false);
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
    if (this.athleteId && this.sessionId) {
      this.loadSession();
    }
  }

  loadSession() {
    this.isLoading.set(true);
    this.coachService.getAthletePlannedSession(this.athleteId, this.sessionId).subscribe({
      next: (session) => {
        this.session.set(session);
        const exercises = session.strengthPlan?.exercises ?? [];
        this.planExercises.set(exercises as StrengthPlanExercise[]);
        this.isLoading.set(false);
        if (session.status === 'completed') {
          this.loadCompletedSession();
        }
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
    const session = this.session();
    if (!session?._id) return;

    this.isSaving.set(true);
    const strengthPlan = {
      exercises: this.planExercises().map(e => ({
        exercise: typeof e.exercise === 'string' ? e.exercise : (e.exercise as Exercise)._id,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        targetWeight: e.targetWeight,
        targetRest: e.targetRest,
        notes: e.notes
      })),
      estimatedDuration: session.targetDuration
    };

    this.coachService.updateAthleteSession(this.athleteId, session._id, { strengthPlan } as any).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.successMessage.set('Exercices sauvegardés');
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: () => {
        this.error.set('Erreur lors de la sauvegarde');
        this.isSaving.set(false);
      }
    });
  }

  openExercisePicker() {
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

  addPlanExercise(exercise: Exercise) {
    const entry: StrengthPlanExercise = {
      exercise,
      targetSets: 3,
      targetReps: '10',
      targetRest: 60
    };
    this.planExercises.update(list => [...list, entry]);
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

  getExerciseName(entry: StrengthPlanExercise): string {
    if (typeof entry.exercise === 'string') return entry.exercise;
    return (entry.exercise as Exercise).name;
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
    this.router.navigate(['/coach/athletes', this.athleteId, 'planning']);
  }
}
