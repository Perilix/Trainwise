import { Component, Input, Output, EventEmitter, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CoachService } from '../../services/coach.service';
import { SessionTemplateService } from '../../services/session-template.service';
import { Athlete } from '../../interfaces/coach.interfaces';
import {
  SessionTemplate,
  AthleteAssignmentPreview,
  BlockOverride,
  AssignmentEntry
} from '../../interfaces/session-template.interfaces';

type Step = 'select' | 'review';

@Component({
  selector: 'app-template-assignment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-assignment-modal.component.html',
  styleUrl: './template-assignment-modal.component.scss'
})
export class TemplateAssignmentModalComponent implements OnInit {
  @Input({ required: true }) template!: SessionTemplate;
  @Output() close = new EventEmitter<void>();
  @Output() assigned = new EventEmitter<void>();

  step = signal<Step>('select');
  athletes = signal<Athlete[]>([]);
  selectedAthleteIds = signal<Set<string>>(new Set());
  date = signal<string>(new Date().toISOString().slice(0, 10));

  isLoading = signal(false);
  isSaving = signal(false);
  error = signal<string | null>(null);

  previews = signal<AthleteAssignmentPreview[]>([]);
  // Overrides indexés par athleteId puis blockIndex
  overrides = signal<Record<string, Record<number, BlockOverride>>>({});

  selectedCount = computed(() => this.selectedAthleteIds().size);

  constructor(
    private coachService: CoachService,
    private templateService: SessionTemplateService
  ) {}

  ngOnInit() {
    this.loadAthletes();
  }

  loadAthletes() {
    this.isLoading.set(true);
    this.coachService.getAthletes().subscribe({
      next: (list) => {
        this.athletes.set(list);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur de chargement des athlètes');
        this.isLoading.set(false);
      }
    });
  }

  toggleAthlete(athleteId: string) {
    const next = new Set(this.selectedAthleteIds());
    if (next.has(athleteId)) next.delete(athleteId);
    else next.add(athleteId);
    this.selectedAthleteIds.set(next);
  }

  isSelected(athleteId: string): boolean {
    return this.selectedAthleteIds().has(athleteId);
  }

  goToReview() {
    if (this.selectedCount() === 0 || !this.date()) {
      this.error.set('Sélectionnez au moins un athlète et une date');
      return;
    }
    this.error.set(null);

    // Pour les séances strength, pas besoin de preview
    if (this.template.sport === 'strength') {
      this.assign();
      return;
    }

    this.isLoading.set(true);
    const ids = Array.from(this.selectedAthleteIds());
    this.templateService.preview(this.template._id, ids).subscribe({
      next: (resp) => {
        this.previews.set(resp.previews);
        this.isLoading.set(false);
        this.step.set('review');
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur lors du calcul des allures');
        this.isLoading.set(false);
      }
    });
  }

  goBack() {
    this.step.set('select');
  }

  setOverride(athleteId: string, blockIndex: number, field: 'pace' | 'recoveryPace', value: string | null) {
    const current = this.overrides();
    const next = { ...current };
    next[athleteId] = { ...(next[athleteId] || {}) };
    next[athleteId][blockIndex] = { ...(next[athleteId][blockIndex] || {}), [field]: value || null };
    this.overrides.set(next);
  }

  getOverride(athleteId: string, blockIndex: number, field: 'pace' | 'recoveryPace'): string | null | undefined {
    return this.overrides()[athleteId]?.[blockIndex]?.[field];
  }

  // Valeur affichée dans l'input : override > resolved
  displayPace(athleteId: string, blockIndex: number, resolved: string | null, field: 'pace' | 'recoveryPace'): string {
    const ov = this.getOverride(athleteId, blockIndex, field);
    if (ov !== undefined) return ov || '';
    return resolved || '';
  }

  isOverridden(athleteId: string, blockIndex: number, field: 'pace' | 'recoveryPace'): boolean {
    return this.getOverride(athleteId, blockIndex, field) !== undefined;
  }

  assign() {
    this.isSaving.set(true);
    this.error.set(null);

    const dateStr = this.date();
    const ids = Array.from(this.selectedAthleteIds());

    const assignments: AssignmentEntry[] = ids.map(athleteId => ({
      athleteId,
      date: new Date(dateStr).toISOString(),
      paceOverrides: this.overrides()[athleteId] || {}
    }));

    this.templateService.assign(this.template._id, assignments).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.assigned.emit();
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur lors de l\'assignation');
        this.isSaving.set(false);
      }
    });
  }

  closeModal() {
    this.close.emit();
  }

  blockLabel(role: string, idx: number): string {
    if (role === 'warmup') return 'Échauffement';
    if (role === 'cooldown') return 'Retour au calme';
    return `Bloc principal #${idx}`;
  }
}
