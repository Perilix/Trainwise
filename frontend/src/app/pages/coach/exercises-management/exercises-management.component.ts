import { Component, OnInit, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ExerciseService } from '../../../services/exercise.service';
import { Exercise, MuscleGroup, Equipment, Difficulty, MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS, DIFFICULTY_LABELS } from '../../../interfaces/strength.interfaces';
import { NavbarComponent } from '../../../components/navbar/navbar.component';

@Component({
  selector: 'app-exercises-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent],
  templateUrl: './exercises-management.component.html',
  styleUrl: './exercises-management.component.scss'
})
export class ExercisesManagementComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  exercises = signal<Exercise[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Filters
  filterMuscle = signal<MuscleGroup | ''>('');
  filterEquipment = signal<Equipment | ''>('');
  searchQuery = signal('');

  // Modal state
  showModal = signal(false);
  editingExercise = signal<Exercise | null>(null);
  isSaving = signal(false);

  // Image upload state
  selectedFile = signal<File | null>(null);
  imagePreview = signal<string | null>(null);
  isUploadingImage = signal(false);

  // Form data
  formData = signal<Partial<Exercise>>({
    name: '',
    description: '',
    instructions: '',
    muscleGroups: [],
    primaryMuscle: undefined,
    equipment: 'bodyweight',
    difficulty: 'intermediate',
    videoUrl: '',
    imageUrl: '',
    isPublic: true
  });

  // Labels for display
  muscleGroupLabels = MUSCLE_GROUP_LABELS;
  equipmentLabels = EQUIPMENT_LABELS;
  difficultyLabels = DIFFICULTY_LABELS;

  muscleGroups: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'full_body'];
  equipmentOptions: Equipment[] = ['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'resistance_band', 'other'];
  difficultyOptions: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

  filteredExercises = computed(() => {
    let result = this.exercises();
    const muscle = this.filterMuscle();
    const equipment = this.filterEquipment();
    const search = this.searchQuery().toLowerCase();

    if (muscle) {
      result = result.filter(e => e.muscleGroups.includes(muscle) || e.primaryMuscle === muscle);
    }
    if (equipment) {
      result = result.filter(e => e.equipment === equipment);
    }
    if (search) {
      result = result.filter(e =>
        e.name.toLowerCase().includes(search) ||
        e.description?.toLowerCase().includes(search)
      );
    }

    return result;
  });

  constructor(private exerciseService: ExerciseService) {}

  ngOnInit() {
    this.loadExercises();
  }

  loadExercises() {
    this.isLoading.set(true);
    this.exerciseService.getExercises().subscribe({
      next: (exercises) => {
        this.exercises.set(exercises);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Erreur lors du chargement des exercices');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }

  openCreateModal() {
    this.editingExercise.set(null);
    this.formData.set({
      name: '',
      description: '',
      instructions: '',
      muscleGroups: [],
      primaryMuscle: undefined,
      equipment: 'bodyweight',
      difficulty: 'intermediate',
      videoUrl: '',
      imageUrl: '',
      isPublic: true
    });
    this.showModal.set(true);
  }

  openEditModal(exercise: Exercise) {
    this.editingExercise.set(exercise);
    this.formData.set({
      name: exercise.name,
      description: exercise.description || '',
      instructions: exercise.instructions || '',
      muscleGroups: [...exercise.muscleGroups],
      primaryMuscle: exercise.primaryMuscle,
      equipment: exercise.equipment,
      difficulty: exercise.difficulty,
      videoUrl: exercise.videoUrl || '',
      imageUrl: exercise.imageUrl || '',
      isPublic: exercise.isPublic
    });
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingExercise.set(null);
    this.error.set(null);
    this.selectedFile.set(null);
    this.imagePreview.set(null);
  }

  updateFormField<K extends keyof Exercise>(field: K, value: Exercise[K]) {
    this.formData.update(data => ({ ...data, [field]: value }));
  }

  toggleMuscleGroup(muscle: MuscleGroup) {
    const current = this.formData().muscleGroups || [];
    const updated = current.includes(muscle)
      ? current.filter(m => m !== muscle)
      : [...current, muscle];
    this.formData.update(data => ({ ...data, muscleGroups: updated }));

    // Auto-set primary muscle if only one selected
    if (updated.length === 1) {
      this.formData.update(data => ({ ...data, primaryMuscle: updated[0] }));
    }
  }

  saveExercise() {
    const data = this.formData();
    if (!data.name || !data.primaryMuscle || !data.muscleGroups?.length) {
      this.error.set('Nom, muscle principal et groupes musculaires requis');
      return;
    }

    this.isSaving.set(true);
    const editing = this.editingExercise();
    const file = this.selectedFile();

    // If there's a file to upload, upload it first
    if (file) {
      this.isUploadingImage.set(true);
      this.exerciseService.uploadImage(file).subscribe({
        next: (result) => {
          this.isUploadingImage.set(false);
          // Update imageUrl with the uploaded URL
          const updatedData = { ...data, imageUrl: result.url };
          this.performSave(updatedData, editing);
        },
        error: (err) => {
          this.isUploadingImage.set(false);
          this.isSaving.set(false);
          this.error.set('Erreur lors de l\'upload de l\'image');
          console.error(err);
        }
      });
    } else {
      this.performSave(data, editing);
    }
  }

  private performSave(data: Partial<Exercise>, editing: Exercise | null) {
    const request = editing
      ? this.exerciseService.updateExercise(editing._id, data)
      : this.exerciseService.createExercise(data);

    request.subscribe({
      next: () => {
        this.successMessage.set(editing ? 'Exercice modifié' : 'Exercice créé');
        this.closeModal();
        this.loadExercises();
        this.isSaving.set(false);
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur lors de la sauvegarde');
        this.isSaving.set(false);
        console.error(err);
      }
    });
  }

  deleteExercise(exercise: Exercise) {
    if (!confirm(`Supprimer l'exercice "${exercise.name}" ?`)) {
      return;
    }

    this.exerciseService.deleteExercise(exercise._id).subscribe({
      next: () => {
        this.successMessage.set('Exercice supprimé');
        this.loadExercises();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err) => {
        this.error.set('Erreur lors de la suppression');
        console.error(err);
      }
    });
  }

  getMuscleLabel(muscle: MuscleGroup): string {
    return this.muscleGroupLabels[muscle] || muscle;
  }

  getEquipmentLabel(equipment: Equipment): string {
    return this.equipmentLabels[equipment] || equipment;
  }

  getDifficultyLabel(difficulty: Difficulty): string {
    return this.difficultyLabels[difficulty] || difficulty;
  }

  getDifficultyClass(difficulty: Difficulty): string {
    const classes: Record<Difficulty, string> = {
      beginner: 'easy',
      intermediate: 'medium',
      advanced: 'hard'
    };
    return classes[difficulty] || '';
  }

  // Image upload methods
  triggerFileInput() {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.error.set('Veuillez sélectionner une image');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      this.error.set('L\'image ne doit pas dépasser 5 Mo');
      return;
    }

    this.selectedFile.set(file);
    this.error.set(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreview.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  removeSelectedImage() {
    this.selectedFile.set(null);
    this.imagePreview.set(null);
    this.formData.update(data => ({ ...data, imageUrl: '' }));
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }
}
