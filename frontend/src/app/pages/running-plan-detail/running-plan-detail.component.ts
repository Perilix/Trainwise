import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PlanningService, PlannedSession, RUNNING_SESSION_LABELS, RunningSessionType } from '../../services/planning.service';
import { RunBlock } from '../../services/run.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { RunBlocksEditorComponent } from '../../components/run-blocks-editor/run-blocks-editor.component';

interface DraftSession {
  date: string;
  sessionType: RunningSessionType;
  description: string;
}

const DRAFT_STORAGE_KEY = 'runningPlanDetail.draftSession';

@Component({
  selector: 'app-running-plan-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, RunBlocksEditorComponent],
  templateUrl: './running-plan-detail.component.html',
  styleUrl: './running-plan-detail.component.scss'
})
export class RunningPlanDetailComponent implements OnInit {
  sessionId = '';

  session = signal<PlannedSession | null>(null);
  draft = signal<DraftSession | null>(null);
  blocks = signal<RunBlock[]>([]);
  description = signal('');
  sessionType = signal<RunningSessionType>('endurance');
  date = signal<Date | null>(null);
  isLoading = signal(true);
  isSaving = signal(false);
  isDeleting = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  isNew = computed(() => this.sessionId === 'new');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private planningService: PlanningService
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
    let draft: DraftSession | null = navState?.draftSession || null;

    if (!draft) {
      try {
        const stored = sessionStorage.getItem(DRAFT_STORAGE_KEY);
        if (stored) draft = JSON.parse(stored);
      } catch {}
    } else {
      try { sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft)); } catch {}
    }

    if (!draft) {
      this.router.navigate(['/planning']);
      return;
    }

    this.draft.set(draft);
    this.date.set(new Date(draft.date));
    this.sessionType.set(draft.sessionType);
    this.description.set(draft.description || '');
    this.blocks.set([]);
    this.isLoading.set(false);
  }

  loadSession() {
    this.isLoading.set(true);
    this.planningService.getPlannedSessionById(this.sessionId).subscribe({
      next: (session) => {
        this.session.set(session);
        this.blocks.set([...(session.runBlocks || [])]);
        this.description.set(session.description || '');
        this.sessionType.set(session.sessionType as RunningSessionType);
        this.date.set(new Date(session.date));
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger la séance');
        this.isLoading.set(false);
      }
    });
  }

  onBlocksChange(blocks: RunBlock[]) {
    this.blocks.set(blocks);
  }

  saveSession() {
    if (this.isNew()) {
      this.createSession();
    } else {
      this.updateSession();
    }
  }

  private createSession() {
    const draft = this.draft();
    if (!draft) return;
    this.isSaving.set(true);
    const payload: Partial<PlannedSession> = {
      date: new Date(draft.date),
      activityType: 'running',
      sessionType: this.sessionType(),
      description: this.description() || undefined,
      runBlocks: this.blocks(),
      generatedBy: 'manual',
      status: 'planned'
    };
    this.planningService.createPlannedSession(payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        try { sessionStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
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

  private updateSession() {
    const session = this.session();
    if (!session?._id) return;
    this.isSaving.set(true);
    const updates: Partial<PlannedSession> = {
      runBlocks: this.blocks(),
      description: this.description() || undefined
    };
    this.planningService.updatePlannedSession(session._id, updates).subscribe({
      next: (updated) => {
        this.isSaving.set(false);
        this.session.set(updated);
        this.successMessage.set('Séance enregistrée');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: () => {
        this.isSaving.set(false);
        this.error.set('Erreur lors de la sauvegarde');
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

  getSessionTypeLabel(type: string): string {
    return RUNNING_SESSION_LABELS[type as RunningSessionType] || type;
  }

  formatDate(date: Date | null): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  goBack() {
    const d = this.date();
    if (d) {
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      this.router.navigate(['/planning'], { queryParams: { openDay: dayKey } });
    } else {
      this.router.navigate(['/planning']);
    }
  }
}
