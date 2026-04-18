import { Component, EventEmitter, Output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

type DayKey = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche';

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

  step = signal(0);
  isSaving = signal(false);

  readonly TOTAL_STEPS = 4; // étapes 1-4 (hors welcome et done)
  readonly days = DAYS;

  // Données du formulaire
  runningLevel = signal<string>('');
  goal = signal<string>('');
  availableDays = signal<DayKey[]>([]);
  weeklyFrequency = signal<number>(3);
  preferredTime = signal<string>('flexible');
  age = signal<number | null>(null);
  gender = signal<string>('');
  height = signal<number | null>(null);
  weight = signal<number | null>(null);
  fcmax = signal<number | null>(null);
  vma = signal<number | null>(null);

  readonly levels = [
    { value: 'debutant', label: 'Débutant', faIcon: 'fa-seedling', desc: 'Je cours occasionnellement ou je débute' },
    { value: 'intermediaire', label: 'Intermédiaire', faIcon: 'fa-person-running', desc: 'Je cours régulièrement depuis 1-2 ans' },
    { value: 'confirme', label: 'Confirmé', faIcon: 'fa-bolt', desc: 'Je m\'entraîne sérieusement et régulièrement' },
    { value: 'expert', label: 'Expert', faIcon: 'fa-trophy', desc: 'Compétiteur ou coureur très expérimenté' },
  ];

  readonly goals = [
    { value: 'remise_en_forme', label: 'Remise en forme', faIcon: 'fa-heart-pulse' },
    { value: '5km', label: '5 km', faIcon: 'fa-flag-checkered' },
    { value: '10km', label: '10 km', faIcon: 'fa-flag-checkered' },
    { value: 'semi_marathon', label: 'Semi-marathon', faIcon: 'fa-medal' },
    { value: 'marathon', label: 'Marathon', faIcon: 'fa-award' },
    { value: 'trail', label: 'Trail', faIcon: 'fa-mountain' },
    { value: 'ultra', label: 'Ultra', faIcon: 'fa-feather-pointed' },
    { value: 'autre', label: 'Autre', faIcon: 'fa-star' },
  ];

  readonly times = [
    { value: 'matin', label: 'Matin', faIcon: 'fa-cloud-sun' },
    { value: 'midi', label: 'Midi', faIcon: 'fa-sun' },
    { value: 'soir', label: 'Soir', faIcon: 'fa-moon' },
    { value: 'flexible', label: 'Flexible', faIcon: 'fa-rotate' },
  ];

  get currentStep() { return this.step(); }
  get progressStep() { return Math.max(0, Math.min(this.step() - 1, this.TOTAL_STEPS)); }

  canProceed(): boolean {
    switch (this.step()) {
      case 1: return !!this.runningLevel();
      case 2: return !!this.goal();
      default: return true;
    }
  }

  next() {
    if (!this.canProceed()) return;
    if (this.step() < 5) {
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

  skip() {
    this.saveAndClose(true);
  }

  complete() {
    this.step.set(5);
    this.saveAndClose(false);
  }

  private saveAndClose(skippedByUser: boolean) {
    this.isSaving.set(true);
    const payload: Record<string, unknown> = { hasCompletedOnboarding: true };

    if (this.runningLevel()) payload['runningLevel'] = this.runningLevel();
    if (this.goal()) payload['goal'] = this.goal();
    if (this.availableDays().length) payload['availableDays'] = this.availableDays();
    if (this.weeklyFrequency()) payload['weeklyFrequency'] = this.weeklyFrequency();
    if (this.preferredTime()) payload['preferredTime'] = this.preferredTime();
    if (this.age()) payload['age'] = this.age();
    if (this.gender()) payload['gender'] = this.gender();
    if (this.height()) payload['height'] = this.height();
    if (this.weight()) payload['weight'] = this.weight();
    if (this.fcmax()) payload['fcmax'] = this.fcmax();
    if (this.vma()) payload['vma'] = this.vma();

    this.authService.updateProfile(payload as any).subscribe({
      next: () => {
        this.isSaving.set(false);
        if (skippedByUser) {
          this.skipped.emit();
        } else {
          setTimeout(() => this.completed.emit(), 1200);
        }
      },
      error: () => {
        this.isSaving.set(false);
        if (skippedByUser) {
          this.skipped.emit();
        } else {
          setTimeout(() => this.completed.emit(), 1200);
        }
      }
    });
  }
}
