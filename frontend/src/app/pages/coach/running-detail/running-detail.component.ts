import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CoachService } from '../../../services/coach.service';
import { PlannedSession, RUNNING_SESSION_LABELS, RunningSessionType } from '../../../services/planning.service';
import { RunBlock } from '../../../services/run.service';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { RunBlocksEditorComponent } from '../../../components/run-blocks-editor/run-blocks-editor.component';

@Component({
  selector: 'app-running-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, RunBlocksEditorComponent],
  templateUrl: './running-detail.component.html',
  styleUrl: './running-detail.component.scss'
})
export class RunningDetailComponent implements OnInit {
  athleteId = '';
  sessionId = '';

  session = signal<PlannedSession | null>(null);
  blocks = signal<RunBlock[]>([]);
  description = signal('');
  isLoading = signal(true);
  isSaving = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private coachService: CoachService
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
        this.blocks.set([...(session.runBlocks || [])]);
        this.description.set(session.description || '');
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
    const session = this.session();
    if (!session?._id) return;
    this.isSaving.set(true);
    const updates: Partial<PlannedSession> = {
      runBlocks: this.blocks(),
      description: this.description() || undefined
    };
    this.coachService.updateAthleteSession(this.athleteId, session._id, updates).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.successMessage.set('Séance enregistrée');
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: () => {
        this.isSaving.set(false);
        this.error.set('Erreur lors de la sauvegarde');
      }
    });
  }

  getSessionTypeLabel(type: string): string {
    return RUNNING_SESSION_LABELS[type as RunningSessionType] || type;
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
