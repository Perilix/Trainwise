import { Injectable, inject, signal } from '@angular/core';
import { SocketService } from './socket.service';
import { PlanningService } from './planning.service';
import { PlannedSession } from './planning.service';

export type PlanGenerationStatus = 'idle' | 'running' | 'done' | 'error';

/**
 * Suivi global de la génération de plan IA (tâche de fond côté backend).
 * La progression arrive par socket ; l'état est repris depuis le backend
 * après un reload via resume().
 */
@Injectable({ providedIn: 'root' })
export class PlanGenerationService {
  private socketService = inject(SocketService);
  private planningService = inject(PlanningService);

  status = signal<PlanGenerationStatus>('idle');
  progress = signal(0);
  sessions = signal<Partial<PlannedSession>[] | null>(null);
  error = signal<string | null>(null);

  constructor() {
    this.socketService.on<{ percent: number }>('planGeneration:progress').subscribe((data) => {
      this.status.set('running');
      this.progress.set(data.percent);
    });

    this.socketService.on<{ sessions: Partial<PlannedSession>[] }>('planGeneration:done').subscribe((data) => {
      this.progress.set(100);
      this.sessions.set(data.sessions);
      this.status.set('done');
    });

    this.socketService.on<{ error: string }>('planGeneration:error').subscribe((data) => {
      this.error.set(data.error || 'La génération a échoué');
      this.status.set('error');
    });
  }

  /** Appelé juste après le 202 du backend */
  start() {
    this.status.set('running');
    this.progress.set(2);
    this.sessions.set(null);
    this.error.set(null);
  }

  /** Reprend l'état d'un job en cours après un reload de l'app */
  resume() {
    this.planningService.getGenerationStatus().subscribe({
      next: (res) => {
        const job = res.job;
        if (!job) return;
        if (job.status === 'running') {
          this.status.set('running');
          this.progress.set(job.progress || 2);
        } else if (job.status === 'done' && job.sessions?.length) {
          this.sessions.set(job.sessions);
          this.progress.set(100);
          this.status.set('done');
        } else if (job.status === 'error') {
          this.error.set(job.error);
          this.status.set('error');
        }
      },
      error: () => {}
    });
  }

  /** Remet à zéro (après confirmation, annulation ou fermeture de l'erreur) */
  clear() {
    this.status.set('idle');
    this.progress.set(0);
    this.sessions.set(null);
    this.error.set(null);
    this.planningService.dismissGeneration().subscribe({ next: () => {}, error: () => {} });
  }
}
