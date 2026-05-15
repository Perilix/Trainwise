import { Component, OnInit, inject, signal, computed, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CompetitionService,
  Competition,
  CompetitionInput,
  CompetitionDiscipline,
  CompetitionPriority,
  CompetitionStatus,
  DISCIPLINE_LABELS
} from '../../services/competition.service';

@Component({
  selector: 'app-competitions-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './competitions-manager.component.html',
  styleUrl: './competitions-manager.component.scss'
})
export class CompetitionsManagerComponent implements OnInit {
  private competitionService = inject(CompetitionService);

  // Mode lecture seule (vue coach)
  @Input() readonly = false;
  // Si fourni, charge les compétitions d'un athlète (pour le coach)
  @Input() athleteId: string | null = null;

  competitions = signal<Competition[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  filter = signal<CompetitionStatus | 'all'>('upcoming');

  // Form state — ajout / édition
  formOpen = signal(false);
  editingId = signal<string | null>(null);
  form = signal<CompetitionInput>(this.emptyForm());

  readonly disciplineLabels = DISCIPLINE_LABELS;

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

  filteredCompetitions = computed(() => {
    const list = this.competitions();
    const f = this.filter();
    if (f === 'all') return list;
    return list.filter(c => c.status === f);
  });

  ngOnInit() {
    this.load();
  }

  private emptyForm(): CompetitionInput {
    return {
      name: '',
      date: '',
      discipline: '5km',
      distance: null,
      elevationGain: null,
      targetTime: null,
      priority: 'A',
      location: '',
      notes: '',
      status: 'upcoming'
    };
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    const obs = this.athleteId
      ? this.competitionService.listForAthlete(this.athleteId)
      : this.competitionService.list();
    obs.subscribe({
      next: (list) => {
        this.competitions.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur lors du chargement');
        this.loading.set(false);
      }
    });
  }

  openAddForm() {
    this.editingId.set(null);
    this.form.set(this.emptyForm());
    this.formOpen.set(true);
  }

  openEditForm(c: Competition) {
    this.editingId.set(c._id!);
    this.form.set({
      name: c.name,
      date: c.date ? c.date.substring(0, 10) : '',
      discipline: c.discipline,
      distance: c.distance ?? null,
      elevationGain: c.elevationGain ?? null,
      targetTime: c.targetTime ?? null,
      priority: c.priority,
      location: c.location ?? '',
      notes: c.notes ?? '',
      status: c.status
    });
    this.formOpen.set(true);
  }

  closeForm() {
    this.formOpen.set(false);
    this.editingId.set(null);
    this.form.set(this.emptyForm());
  }

  canSubmit(): boolean {
    const f = this.form();
    return !!f.name.trim() && !!f.date && !!f.discipline;
  }

  submit() {
    if (!this.canSubmit()) return;
    const id = this.editingId();
    const data = this.form();
    const obs = id
      ? this.competitionService.update(id, data)
      : this.competitionService.create(data);
    obs.subscribe({
      next: () => {
        this.closeForm();
        this.load();
      },
      error: (err) => this.error.set(err.error?.error || 'Erreur lors de la sauvegarde')
    });
  }

  remove(c: Competition) {
    if (!c._id) return;
    if (!confirm(`Supprimer "${c.name}" ?`)) return;
    this.competitionService.delete(c._id).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(err.error?.error || 'Erreur lors de la suppression')
    });
  }

  updateField<K extends keyof CompetitionInput>(key: K, value: CompetitionInput[K]) {
    this.form.update(f => ({ ...f, [key]: value }));
  }
}
