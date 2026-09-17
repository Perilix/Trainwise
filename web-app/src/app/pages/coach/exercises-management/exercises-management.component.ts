import { Component, OnInit, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ExerciseService } from '../../../services/exercise.service';
import { SessionTemplateService } from '../../../services/session-template.service';
import { Exercise, MuscleGroup, Equipment, Difficulty, MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS, DIFFICULTY_LABELS } from '../../../interfaces/strength.interfaces';
import { SessionTemplate, Sport, TemplateRunBlock, PaceConfig, PaceZone, PaceZoneKey } from '../../../interfaces/session-template.interfaces';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { TemplateAssignmentModalComponent } from '../../../components/template-assignment-modal/template-assignment-modal.component';
import { WorkoutProfileComponent } from '../../../components/workout-profile/workout-profile.component';
import { CoachService } from '../../../services/coach.service';
import { Athlete } from '../../../interfaces/coach.interfaces';
import { RunBlock } from '../../../services/run.service';

type LibraryTab = 'exercises' | 'templates';

/** Un groupe de séances de la bibliothèque, par type. */
interface TemplateGroup {
  label: string;
  templates: SessionTemplate[];
}

@Component({
  selector: 'app-exercises-management',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, TemplateAssignmentModalComponent, WorkoutProfileComponent],
  templateUrl: './exercises-management.component.html',
  styleUrl: './exercises-management.component.scss'
})
export class ExercisesManagementComponent implements OnInit {
  // Au-delà de 1024px, la bibliothèque prend la mise en page des maquettes :
  // liste de séances à gauche, séance détaillée à droite.
  isDesktop = signal(typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);

  /** Séance affichée dans le panneau de détail (desktop). */
  selectedTemplate = signal<SessionTemplate | null>(null);

  /** Athlètes du coach, pour les allures individualisées. */
  athletes = signal<Athlete[]>([]);

  // Tabs
  activeTab = signal<LibraryTab>('exercises');
  sportFilter = signal<'all' | Sport>('all');

  // Templates
  templates = signal<SessionTemplate[]>([]);
  isLoadingTemplates = signal(false);
  templateToAssign = signal<SessionTemplate | null>(null);

  filteredTemplates = computed(() => {
    const sport = this.sportFilter();
    const search = this.searchQuery().toLowerCase();
    let result = this.templates();
    if (sport !== 'all') result = result.filter(t => t.sport === sport);
    if (search) {
      result = result.filter(t =>
        t.name.toLowerCase().includes(search) ||
        t.description?.toLowerCase().includes(search)
      );
    }
    return result;
  });
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

  constructor(
    private exerciseService: ExerciseService,
    private sessionTemplateService: SessionTemplateService,
    private coachService: CoachService,
    private router: Router
  ) {}

  ngOnInit() {
    if (typeof window !== 'undefined') {
      window.matchMedia('(min-width: 1024px)').addEventListener('change', event => this.isDesktop.set(event.matches));
    }
    this.loadExercises();
    this.loadTemplates();
    this.sessionTemplateService.getPaceZones().subscribe({
      next: zones => this.zones.set(zones ?? []),
      error: () => {}
    });
    // Les allures individualisées ont besoin de la VMA de chaque athlète.
    this.coachService.getAthletes().subscribe({
      next: list => this.athletes.set(list ?? []),
      error: () => {}
    });
  }

  // ===== Bibliothèque desktop : liste groupée + détail =====

  /** Les séances filtrées, rangées par type — l'ordre des groupes suit la liste. */
  templateGroups = computed<TemplateGroup[]>(() => {
    const groups = new Map<string, SessionTemplate[]>();
    for (const template of this.filteredTemplates()) {
      const label = this.sessionTypeLabel(template.sessionType);
      const bucket = groups.get(label);
      if (bucket) bucket.push(template);
      else groups.set(label, [template]);
    }
    return [...groups.entries()].map(([label, templates]) => ({ label, templates }));
  });

  selectTemplate(template: SessionTemplate) {
    this.selectedTemplate.set(template);
  }

  /** La séance affichée, ou la première de la liste tant qu'on n'a rien choisi. */
  shownTemplate = computed<SessionTemplate | null>(() => {
    const chosen = this.selectedTemplate();
    const visible = this.filteredTemplates();
    // Une séance filtrée hors liste ne doit pas rester affichée.
    if (chosen && visible.some(t => t._id === chosen._id)) return chosen;
    return visible[0] ?? null;
  });

  /** VMA de référence des aperçus, comme dans l'éditeur de séance. */
  previewVma = signal(16);

  /**
   * Blocs d'une séance au format de la timeline.
   *
   * Un modèle porte une allure *structurée* (% VMA, zone, ou absolue) là où la
   * timeline attend une chaîne « m:ss » : on la résout ici depuis la VMA
   * d'aperçu, sans quoi la timeline reçoit un objet et se casse.
   */
  blocksOf(template: SessionTemplate | null): RunBlock[] {
    const convert = (block: TemplateRunBlock): RunBlock => ({
      ...block,
      pace: this.resolvePace(block.pace),
      recoveryPace: this.resolvePace(block.recoveryPace),
      children: block.children?.map(convert),
    }) as unknown as RunBlock;
    return (template?.runBlocks ?? []).map(convert);
  }

  /** Une consigne d'allure ramenée à « m:ss » par kilomètre, ou null. */
  private resolvePace(pace: PaceConfig | null | undefined): string | null {
    if (!pace) return null;
    if (pace.mode === 'absolute') return pace.absolute ?? null;
    const percent = pace.mode === 'vmaPercent' ? pace.vmaPercent : this.zonePercent(pace.zone);
    if (!percent) return null;
    const speedKmh = (this.previewVma() * percent) / 100;
    return speedKmh > 0 ? this.clock(3600 / speedKmh) : null;
  }

  /** Pourcentage de VMA au centre d'une zone, d'après le référentiel du serveur. */
  private zonePercent(zone: PaceZoneKey | null | undefined): number | null {
    if (!zone) return null;
    return this.zones().find(z => z.key === zone)?.defaultPercent ?? null;
  }

  zones = signal<PaceZone[]>([]);

  /** « ≈ 11,8 km · ≈ 1 h 01 », d'après ce que la séance déclare. */
  templateSummary(template: SessionTemplate): string {
    const parts: string[] = [];
    if (template.targetDistance) parts.push(`≈ ${this.fr(template.targetDistance)} km`);
    if (template.targetDuration) parts.push(`≈ ${this.duration(template.targetDuration)}`);
    if (!parts.length && template.strengthPlan?.exercises?.length) {
      parts.push(`${template.strengthPlan.exercises.length} exercices`);
    }
    return parts.join(' · ');
  }

  /** Le bloc d'effort de référence : celui sur lequel se calent les allures. */
  referenceBlock(template: SessionTemplate | null): TemplateRunBlock | null {
    const blocks = template?.runBlocks ?? [];
    const mains = blocks.filter(b => b.role === 'main');
    const flattened = mains.flatMap(b => (b.children?.length ? b.children : [b]));
    return flattened.find(b => b.pace?.mode === 'vmaPercent' && b.pace.vmaPercent) ?? flattened[0] ?? null;
  }

  referenceLabel(template: SessionTemplate | null): string {
    const block = this.referenceBlock(template);
    if (!block) return '';
    if (block.mode === 'distance' && block.distance) return `${Math.round(block.distance * 1000)} m`;
    if (block.duration) return `${block.duration} min`;
    return 'Effort';
  }

  /**
   * Allure d'un athlète sur un bloc, en secondes par kilomètre.
   * `null` si l'allure ne dépend pas de la VMA ou si la VMA manque.
   */
  private paceSecPerKm(block: TemplateRunBlock | null, vma: number | null | undefined): number | null {
    if (!block || !vma) return null;
    const percent = block.pace?.mode === 'vmaPercent' ? block.pace.vmaPercent : null;
    if (!percent) return null;
    const speedKmh = (vma * percent) / 100;
    return speedKmh > 0 ? 3600 / speedKmh : null;
  }

  /** Allure de l'athlète sur le bloc de référence, « 3:32 ». */
  athletePace(template: SessionTemplate | null, athlete: Athlete): string | null {
    const seconds = this.paceSecPerKm(this.referenceBlock(template), athlete.vma);
    return seconds ? this.clock(seconds) : null;
  }

  /** Temps mis par l'athlète pour couvrir le bloc de référence, « 1:25 ». */
  athleteSplit(template: SessionTemplate | null, athlete: Athlete): string | null {
    const block = this.referenceBlock(template);
    const seconds = this.paceSecPerKm(block, athlete.vma);
    if (!seconds || !block?.distance) return null;
    return this.clock(seconds * block.distance);
  }

  private clock(seconds: number): string {
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  private duration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
  }

  private fr(value: number): string {
    return value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  }

  /** Nom d'un exercice, qu'il soit peuplé ou réduit à son identifiant. */
  getExerciseLabel(exercise: string | Exercise): string {
    if (typeof exercise === 'string') {
      return this.exercises().find(e => e._id === exercise)?.name ?? 'Exercice';
    }
    return exercise?.name ?? 'Exercice';
  }

  /** Libellé d'un bloc dans la structure : « Échauffement · 20 min ». */
  blockTitle(block: TemplateRunBlock): string {
    const role = block.role === 'warmup' ? 'Échauffement' : block.role === 'cooldown' ? 'Retour au calme' : 'Effort';
    const measure = block.mode === 'distance' && block.distance
      ? `${this.fr(block.distance)} km`
      : block.duration ? `${block.duration} min` : '';
    return measure ? `${role} · ${measure}` : role;
  }

  /** Sous-titre d'un bloc : sa consigne d'allure. */
  blockPace(block: TemplateRunBlock): string {
    const pace = block.pace;
    if (!pace) return '';
    if (pace.mode === 'absolute' && pace.absolute) return `${pace.absolute} /km`;
    if (pace.mode === 'vmaPercent' && pace.vmaPercent) return `${pace.vmaPercent} % VMA`;
    if (pace.mode === 'zone' && pace.zone) return `Zone ${pace.zone}`;
    return '';
  }

  // ===== Templates =====
  loadTemplates() {
    this.isLoadingTemplates.set(true);
    this.sessionTemplateService.list({ scope: 'mine' }).subscribe({
      next: (list) => {
        this.templates.set(list);
        this.isLoadingTemplates.set(false);
      },
      error: (err) => {
        console.error(err);
        this.isLoadingTemplates.set(false);
      }
    });
  }

  setTab(tab: LibraryTab) {
    this.activeTab.set(tab);
  }

  setSportFilter(sport: 'all' | Sport) {
    this.sportFilter.set(sport);
  }

  createTemplate() {
    this.router.navigate(['/coach/session-templates/new']);
  }

  editTemplate(template: SessionTemplate) {
    this.router.navigate(['/coach/session-templates', template._id, 'edit']);
  }

  duplicateTemplate(template: SessionTemplate) {
    const copy: Partial<SessionTemplate> = {
      ...template,
      name: `${template.name} (copie)`,
    };
    delete (copy as any)._id;
    delete (copy as any).createdAt;
    delete (copy as any).updatedAt;
    delete (copy as any).usageCount;
    delete (copy as any).lastUsedAt;
    this.sessionTemplateService.create(copy).subscribe({
      next: () => {
        this.successMessage.set('Séance dupliquée');
        this.loadTemplates();
        setTimeout(() => this.successMessage.set(null), 2500);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur lors de la duplication');
      }
    });
  }

  deleteTemplate(template: SessionTemplate) {
    if (!confirm(`Supprimer la séance "${template.name}" ?`)) return;
    this.sessionTemplateService.delete(template._id).subscribe({
      next: () => {
        this.successMessage.set('Séance supprimée');
        this.loadTemplates();
        setTimeout(() => this.successMessage.set(null), 2500);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur lors de la suppression');
      }
    });
  }

  openAssignModal(template: SessionTemplate) {
    this.templateToAssign.set(template);
  }

  closeAssignModal() {
    this.templateToAssign.set(null);
  }

  onAssignmentDone() {
    this.successMessage.set('Séance(s) assignée(s)');
    this.templateToAssign.set(null);
    this.loadTemplates();
    setTimeout(() => this.successMessage.set(null), 2500);
  }

  sportLabel(sport: Sport): string {
    return sport === 'running' ? 'Course' : 'Muscu';
  }

  sessionTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      endurance: 'Endurance', fractionne: 'Fractionné', tempo: 'Tempo',
      recuperation: 'Récup', sortie_longue: 'Sortie longue', cotes: 'Côtes', fartlek: 'Fartlek',
      upper_body: 'Haut du corps', lower_body: 'Bas du corps', full_body: 'Full body',
      push: 'Push', pull: 'Pull', legs: 'Jambes', core: 'Gainage', hiit: 'HIIT'
    };
    return labels[type] || type;
  }
  // ===== End templates =====


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
