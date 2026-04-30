import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PlanningService, PlannedSession } from '../../services/planning.service';
import { ExerciseService } from '../../services/exercise.service';
import {
  Exercise, StrengthPlanExercise, MuscleGroup, StrengthSessionType,
  MUSCLE_GROUP_LABELS, SESSION_TYPE_LABELS as STRENGTH_SESSION_LABELS
} from '../../interfaces/strength.interfaces';
import { NavbarComponent } from '../../components/navbar/navbar.component';

interface DraftMuscuSession {
  date: string;
  sessionType: StrengthSessionType;
  description: string;
}

const MUSCU_DRAFT_KEY = 'muscuPlanDetail.draftSession';

@Component({
  selector: 'app-muscu-plan-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './muscu-plan-detail.component.html',
  styleUrl: './muscu-plan-detail.component.scss'
})
export class MuscuPlanDetailComponent implements OnInit {
  sessionId = '';

  session = signal<PlannedSession | null>(null);
  draft = signal<DraftMuscuSession | null>(null);
  isLoading = signal(true);
  isSaving = signal(false);
  isDeleting = signal(false);
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
    private planningService: PlanningService,
    private exerciseService: ExerciseService
  ) {}

  ngOnInit() {
    this.sessionId = this.route.snapshot.paramMap.get('sessionId') || '';
    if (!this.sessionId) {
      this.error.set('Paramètres manquants');
      this.isLoading.set(false);
      return;
    }
    if (this.sessionId === 'new') {
      this.initDraft();
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
      this.router.navigate(['/planning']);
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
    this.planningService.getPlannedSessionById(this.sessionId).subscribe({
      next: (session) => {
        this.session.set(session);
        this.description.set(session.description || '');
        const exercises = session.strengthPlan?.exercises ?? [];
        this.planExercises.set(exercises as StrengthPlanExercise[]);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger la séance');
        this.isLoading.set(false);
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

  private buildStrengthPlan() {
    return {
      exercises: this.planExercises().map(e => ({
        exercise: typeof e.exercise === 'string' ? e.exercise : (e.exercise as Exercise)._id,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        targetWeight: e.targetWeight,
        targetRest: e.targetRest,
        notes: e.notes
      }))
    };
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
    this.planningService.updatePlannedSession(session._id, updates).subscribe({
      next: (updated) => {
        this.isSaving.set(false);
        this.session.set(updated);
        this.successMessage.set('Séance enregistrée');
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
      generatedBy: 'manual',
      status: 'planned'
    };
    this.planningService.createPlannedSession(payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        try { sessionStorage.removeItem(MUSCU_DRAFT_KEY); } catch {}
        const d = new Date(draft.date);
        const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        this.router.navigate(['/planning'], { queryParams: { openDay: dayKey } });
      },
      error: () => {
        this.isSaving.set(false);
        this.error.set('Erreur lors de la création');
      }
    });
  }

  deleteSession() {
    const session = this.session();
    if (!session?._id) return;
    if (!confirm('Supprimer cette séance ?')) return;
    this.isDeleting.set(true);
    this.planningService.deletePlannedSession(session._id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.goBack();
      },
      error: () => {
        this.isDeleting.set(false);
        this.error.set('Erreur lors de la suppression');
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
      targetReps: '10'
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
    const session = this.session();
    const date = session ? new Date(session.date) : this.draftDate();
    if (date) {
      const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      this.router.navigate(['/planning'], { queryParams: { openDay: dayKey } });
    } else {
      this.router.navigate(['/planning']);
    }
  }
}
