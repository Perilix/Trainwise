import { Component, EventEmitter, Output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import {
  CompetitionService,
  CompetitionInput,
  CompetitionDiscipline,
  CompetitionPriority,
  DISCIPLINE_LABELS
} from '../../services/competition.service';
import { forkJoin } from 'rxjs';

type DayKey = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche';

type StepKind =
  | 'welcome'
  | 'sport'
  | 'runningLevel'
  | 'runningCompetitions'
  | 'runningFrequency'
  | 'muscuLevel'
  | 'muscuGoal'
  | 'muscuType'
  | 'muscuFrequency'
  | 'planning'
  | 'stats'
  | 'done';

const DAYS: { key: DayKey; short: string }[] = [
  { key: 'lundi', short: 'Lun' },
  { key: 'mardi', short: 'Mar' },
  { key: 'mercredi', short: 'Mer' },
  { key: 'jeudi', short: 'Jeu' },
  { key: 'vendredi', short: 'Ven' },
  { key: 'samedi', short: 'Sam' },
  { key: 'dimanche', short: 'Dim' },
];

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss'
})
export class OnboardingComponent {
  @Output() completed = new EventEmitter<void>();
  @Output() skipped = new EventEmitter<void>();

  private authService = inject(AuthService);
  private competitionService = inject(CompetitionService);

  step = signal(0);
  isSaving = signal(false);

  readonly days = DAYS;
  readonly disciplineLabels = DISCIPLINE_LABELS;

  // Sélection de sport
  disciplines = signal<string[]>([]);
  hasRunning = computed(() => this.disciplines().includes('running'));
  hasMuscu = computed(() => this.disciplines().includes('fitness'));

  // Données running
  runningLevel = signal<string>('');
  weeklyFrequency = signal<number>(3);

  // Compétitions saisies pendant l'onboarding (0..n)
  competitions = signal<CompetitionInput[]>([]);
  // Formulaire d'ajout inline
  showCompetitionForm = signal(false);
  newCompetitionName = signal<string>('');
  newCompetitionDate = signal<string>('');
  newCompetitionDiscipline = signal<CompetitionDiscipline | ''>('');
  newCompetitionPriority = signal<CompetitionPriority>('A');
  newCompetitionTargetTime = signal<string>('');

  // Données muscu
  strengthLevel = signal<string>('');
  strengthGoal = signal<string>('');
  strengthType = signal<string>('');
  strengthFrequency = signal<number>(2);

  // Données partagées
  availableDays = signal<DayKey[]>([]);
  preferredTime = signal<string>('flexible');
  age = signal<number | null>(null);
  gender = signal<string>('');
  height = signal<number | null>(null);
  weight = signal<number | null>(null);
  fcmax = signal<number | null>(null);
  vma = signal<number | null>(null);

  // Liste dynamique des étapes selon les sports sélectionnés
  steps = computed<StepKind[]>(() => {
    const list: StepKind[] = ['welcome', 'sport'];
    if (this.hasRunning()) list.push('runningLevel', 'runningCompetitions', 'runningFrequency');
    if (this.hasMuscu()) list.push('muscuLevel', 'muscuGoal', 'muscuType', 'muscuFrequency');
    list.push('planning', 'stats', 'done');
    return list;
  });

  currentKind = computed<StepKind>(() => this.steps()[this.step()] ?? 'welcome');

  // Progression : on exclut welcome et done du compte
  totalProgressSteps = computed(() => this.steps().length - 2);
  progressIndex = computed(() => Math.max(0, this.step() - 1));
  progressDots = computed(() => Array.from({ length: this.totalProgressSteps() }, (_, i) => i));

  showHeader = computed(() => {
    const k = this.currentKind();
    return k !== 'welcome' && k !== 'done';
  });

  readonly sports = [
    { value: 'running', label: 'Running', faIcon: 'fa-person-running', desc: 'Course, trail, marathon...' },
    { value: 'fitness', label: 'Muscu / Fitness', faIcon: 'fa-dumbbell', desc: 'Renfo, hypertrophie, calisthénie...' },
  ];

  readonly levels = [
    { value: 'debutant', label: 'Débutant', faIcon: 'fa-seedling', desc: 'Je cours occasionnellement ou je débute' },
    { value: 'intermediaire', label: 'Intermédiaire', faIcon: 'fa-person-running', desc: 'Je cours régulièrement depuis 1-2 ans' },
    { value: 'confirme', label: 'Confirmé', faIcon: 'fa-bolt', desc: 'Je m\'entraîne sérieusement et régulièrement' },
    { value: 'expert', label: 'Expert', faIcon: 'fa-trophy', desc: 'Compétiteur ou coureur très expérimenté' },
  ];

  readonly disciplineOptions: { value: CompetitionDiscipline; label: string; faIcon: string }[] = [
    { value: '5km', label: '5 km', faIcon: 'fa-flag-checkered' },
    { value: '10km', label: '10 km', faIcon: 'fa-flag-checkered' },
    { value: 'semi_marathon', label: 'Semi-marathon', faIcon: 'fa-medal' },
    { value: 'marathon', label: 'Marathon', faIcon: 'fa-award' },
    { value: 'trail', label: 'Trail', faIcon: 'fa-mountain' },
    { value: 'ultra', label: 'Ultra', faIcon: 'fa-feather-pointed' },
    { value: 'autre', label: 'Autre', faIcon: 'fa-star' },
  ];

  readonly priorityOptions: { value: CompetitionPriority; label: string; desc: string }[] = [
    { value: 'A', label: 'A', desc: 'Objectif principal' },
    { value: 'B', label: 'B', desc: 'Course intermédiaire' },
    { value: 'C', label: 'C', desc: 'Préparation' },
  ];

  readonly muscuLevels = [
    { value: 'debutant', label: 'Débutant', faIcon: 'fa-seedling', desc: 'Je débute ou je m\'y remets' },
    { value: 'intermediaire', label: 'Intermédiaire', faIcon: 'fa-dumbbell', desc: 'Je m\'entraîne depuis 1-2 ans' },
    { value: 'confirme', label: 'Confirmé', faIcon: 'fa-bolt', desc: 'Plusieurs années d\'expérience' },
  ];

  readonly muscuGoals = [
    { value: 'force', label: 'Force', faIcon: 'fa-bolt' },
    { value: 'hypertrophie', label: 'Hypertrophie', faIcon: 'fa-dumbbell' },
    { value: 'endurance_musculaire', label: 'Endurance musculaire', faIcon: 'fa-arrows-spin' },
    { value: 'remise_en_forme', label: 'Remise en forme', faIcon: 'fa-heart-pulse' },
    { value: 'fonctionnel', label: 'Fonctionnel', faIcon: 'fa-person-walking' },
    { value: 'calisthenie', label: 'Calisthénie', faIcon: 'fa-child-reaching' },
  ];

  readonly muscuTypes = [
    { value: 'poids_libres', label: 'Poids libres', faIcon: 'fa-dumbbell' },
    { value: 'machines', label: 'Machines', faIcon: 'fa-gears' },
    { value: 'bodyweight', label: 'Poids du corps', faIcon: 'fa-child-reaching' },
    { value: 'crossfit', label: 'CrossFit', faIcon: 'fa-fire' },
    { value: 'mixte', label: 'Mixte', faIcon: 'fa-shuffle' },
  ];

  readonly times = [
    { value: 'matin', label: 'Matin', faIcon: 'fa-cloud-sun' },
    { value: 'midi', label: 'Midi', faIcon: 'fa-sun' },
    { value: 'soir', label: 'Soir', faIcon: 'fa-moon' },
    { value: 'flexible', label: 'Flexible', faIcon: 'fa-rotate' },
  ];

  toggleDiscipline(value: string) {
    const current = this.disciplines();
    if (current.includes(value)) {
      this.disciplines.set(current.filter(d => d !== value));
    } else {
      this.disciplines.set([...current, value]);
    }
  }

  isDisciplineSelected(value: string): boolean {
    return this.disciplines().includes(value);
  }

  canProceed(): boolean {
    switch (this.currentKind()) {
      case 'sport': return this.disciplines().length > 0;
      case 'runningLevel': return !!this.runningLevel();
      case 'runningCompetitions': return true; // étape optionnelle
      case 'muscuLevel': return !!this.strengthLevel();
      case 'muscuGoal': return !!this.strengthGoal();
      case 'muscuType': return !!this.strengthType();
      default: return true;
    }
  }

  resetCompetitionForm() {
    this.newCompetitionName.set('');
    this.newCompetitionDate.set('');
    this.newCompetitionDiscipline.set('');
    this.newCompetitionPriority.set('A');
    this.newCompetitionTargetTime.set('');
  }

  canAddCompetition(): boolean {
    return !!this.newCompetitionName().trim()
      && !!this.newCompetitionDate()
      && !!this.newCompetitionDiscipline();
  }

  addCompetition() {
    if (!this.canAddCompetition()) return;
    const c: CompetitionInput = {
      name: this.newCompetitionName().trim(),
      date: this.newCompetitionDate(),
      discipline: this.newCompetitionDiscipline() as CompetitionDiscipline,
      priority: this.newCompetitionPriority(),
      targetTime: this.newCompetitionTargetTime().trim() || null,
      status: 'upcoming'
    };
    this.competitions.update(list => [...list, c]);
    this.resetCompetitionForm();
    this.showCompetitionForm.set(false);
  }

  removeCompetition(index: number) {
    this.competitions.update(list => list.filter((_, i) => i !== index));
  }

  next() {
    if (!this.canProceed()) return;
    if (this.step() < this.steps().length - 1) {
      this.step.update(s => s + 1);
    }
  }

  prev() {
    if (this.step() > 1) {
      this.step.update(s => s - 1);
    }
  }

  toggleDay(day: DayKey) {
    const days = this.availableDays();
    if (days.includes(day)) {
      this.availableDays.set(days.filter(d => d !== day));
    } else {
      this.availableDays.set([...days, day]);
    }
  }

  isDaySelected(day: DayKey): boolean {
    return this.availableDays().includes(day);
  }

  incrementFrequency() {
    if (this.weeklyFrequency() < 14) this.weeklyFrequency.update(v => v + 1);
  }

  decrementFrequency() {
    if (this.weeklyFrequency() > 1) this.weeklyFrequency.update(v => v - 1);
  }

  incrementStrengthFrequency() {
    if (this.strengthFrequency() < 14) this.strengthFrequency.update(v => v + 1);
  }

  decrementStrengthFrequency() {
    if (this.strengthFrequency() > 1) this.strengthFrequency.update(v => v - 1);
  }

  skip() {
    this.saveAndClose(true);
  }

  complete() {
    // Saute à l'étape "done"
    this.step.set(this.steps().length - 1);
    this.saveAndClose(false);
  }

  private saveAndClose(skippedByUser: boolean) {
    this.isSaving.set(true);
    const payload: Record<string, unknown> = { hasCompletedOnboarding: true };

    if (this.disciplines().length) payload['disciplines'] = this.disciplines();

    if (this.hasRunning()) {
      if (this.runningLevel()) payload['runningLevel'] = this.runningLevel();
      if (this.weeklyFrequency()) payload['weeklyFrequency'] = this.weeklyFrequency();
      if (this.fcmax()) payload['fcmax'] = this.fcmax();
      if (this.vma()) payload['vma'] = this.vma();
    }

    if (this.hasMuscu()) {
      if (this.strengthLevel()) payload['strengthLevel'] = this.strengthLevel();
      if (this.strengthGoal()) payload['strengthGoal'] = this.strengthGoal();
      if (this.strengthType()) payload['strengthType'] = this.strengthType();
      if (this.strengthFrequency()) payload['strengthFrequency'] = this.strengthFrequency();
    }

    if (this.availableDays().length) payload['availableDays'] = this.availableDays();
    if (this.preferredTime()) payload['preferredTime'] = this.preferredTime();
    if (this.age()) payload['age'] = this.age();
    if (this.gender()) payload['gender'] = this.gender();
    if (this.height()) payload['height'] = this.height();
    if (this.weight()) payload['weight'] = this.weight();

    const finish = () => {
      this.isSaving.set(false);
      if (skippedByUser) {
        this.skipped.emit();
      } else {
        setTimeout(() => this.completed.emit(), 1200);
      }
    };

    this.authService.updateProfile(payload as any).subscribe({
      next: () => {
        const comps = this.competitions();
        if (skippedByUser || comps.length === 0) {
          finish();
          return;
        }
        // Crée les compétitions en parallèle puis ferme
        forkJoin(comps.map(c => this.competitionService.create(c))).subscribe({
          next: () => finish(),
          error: () => finish()
        });
      },
      error: () => finish()
    });
  }
}
