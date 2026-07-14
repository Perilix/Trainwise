import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PlanGenerationService } from '../../services/plan-generation.service';

/**
 * Pastille flottante globale : suit la génération de plan IA en tâche de fond.
 * Visible partout dans l'app tant qu'un job est actif (progression réelle),
 * cliquable quand le plan est prêt.
 */
@Component({
  selector: 'app-plan-generation-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (planGen.status() !== 'idle') {
      <div class="plan-gen-pill" [class.pill-done]="planGen.status() === 'done'" [class.pill-error]="planGen.status() === 'error'">

        @if (planGen.status() === 'running') {
          <button class="pill-body pill-action" (click)="openTracking()">
            <div class="pill-row">
              <i class="fa-solid fa-wand-magic-sparkles pill-icon spin-pulse"></i>
              <span class="pill-text">Génération de ton plan… <strong>{{ planGen.progress() }}%</strong></span>
            </div>
            <div class="pill-progress">
              <div class="pill-progress-fill" [style.width.%]="planGen.progress()"></div>
            </div>
          </button>
        }

        @if (planGen.status() === 'done') {
          <button class="pill-row pill-action" (click)="openPlan()">
            <i class="fa-solid fa-circle-check pill-icon"></i>
            <span class="pill-text">Ton plan est prêt !</span>
            <span class="pill-cta">Voir</span>
          </button>
        }

        @if (planGen.status() === 'error') {
          <div class="pill-row">
            <i class="fa-solid fa-triangle-exclamation pill-icon"></i>
            <span class="pill-text">{{ planGen.error() }}</span>
            <button class="pill-close" (click)="planGen.clear()">×</button>
          </div>
        }

      </div>
    }
  `,
  styles: [`
    .plan-gen-pill {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      bottom: calc(var(--bottom-nav-height, 60px) + var(--safe-bottom, 0px) + 12px);
      z-index: 9000;
      background: #003554;
      color: #F6F4F0;
      border-radius: 16px;
      padding: 10px 16px 8px;
      min-width: 240px;
      max-width: calc(100vw - 32px);
      box-shadow: 0 8px 28px rgba(0, 53, 84, 0.35);
      font-family: 'Poppins', sans-serif;
      animation: pillIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes pillIn {
      from { transform: translateX(-50%) translateY(20px); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }

    .pill-done { background: #14532d; }
    .pill-error { background: #7f1d1d; padding-bottom: 10px; }

    .pill-row {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      background: none;
      border: none;
      color: inherit;
      font-family: inherit;
      padding: 0;
    }

    .pill-action { cursor: pointer; }

    .pill-body {
      display: block;
      width: 100%;
      background: none;
      border: none;
      color: inherit;
      font-family: inherit;
      padding: 0;
      text-align: left;
    }

    .pill-icon { font-size: 0.9rem; color: #00A6FB; flex-shrink: 0; }
    .pill-done .pill-icon { color: #4ade80; }
    .pill-error .pill-icon { color: #fca5a5; }

    .spin-pulse { animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @media (prefers-reduced-motion: reduce) {
      .spin-pulse { animation: none; }
      .plan-gen-pill { animation: none; }
    }

    .pill-text {
      font-size: 0.8rem;
      flex: 1;
      text-align: left;
      strong { font-variant-numeric: tabular-nums; }
    }

    .pill-cta {
      background: #4ade80;
      color: #052e16;
      font-size: 0.75rem;
      font-weight: 700;
      border-radius: 10px;
      padding: 4px 12px;
      flex-shrink: 0;
    }

    .pill-close {
      background: none;
      border: none;
      color: #fca5a5;
      font-size: 1.1rem;
      cursor: pointer;
      padding: 0 2px;
      flex-shrink: 0;
    }

    .pill-progress {
      margin-top: 7px;
      height: 4px;
      border-radius: 2px;
      background: rgba(246, 244, 240, 0.18);
      overflow: hidden;
    }

    .pill-progress-fill {
      height: 100%;
      border-radius: 2px;
      background: linear-gradient(90deg, #00A6FB, #4ade80);
      transition: width 0.4s ease;
    }
  `]
})
export class PlanGenerationIndicatorComponent {
  planGen = inject(PlanGenerationService);
  private router = inject(Router);

  openPlan() {
    this.router.navigate(['/planning'], { queryParams: { preview: 1 } });
  }

  openTracking() {
    this.planGen.requestTrackingModal();
    this.router.navigate(['/planning']);
  }
}
