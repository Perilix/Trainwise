import { Component, Input, OnInit, OnDestroy, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnboardingService } from '../../services/onboarding.service';

export interface TourStep {
  /** Clé `data-tour="..."` de l'élément à mettre en avant. Si absent → étape centrée (sans spotlight). */
  anchor?: string;
  faIcon: string;
  title: string;
  description: string;
}

interface BoxStyle {
  top: string;
  left: string;
  width: string;
  height: string;
}

@Component({
  selector: 'app-tour-tooltip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tour-tooltip.component.html',
  styleUrl: './tour-tooltip.component.scss'
})
export class TourTooltipComponent implements OnInit, OnDestroy {
  @Input({ required: true }) pageId!: string;
  // Mode simple (1 étape)
  @Input() faIcon: string = 'fa-lightbulb';
  @Input() title: string = '';
  @Input() description: string = '';
  // Mode multi-étapes (surcharge le mode simple si fourni)
  @Input() steps?: TourStep[];

  private onboardingService = inject(OnboardingService);

  /** Marge (px) entre l'élément ciblé et le bord du trou lumineux. */
  private readonly PAD = 8;

  isVisible = signal(false);
  currentStepIndex = signal(0);
  /** Position de l'élément ciblé ; null = pas d'ancre / introuvable → carte centrée en bas. */
  targetRect = signal<DOMRect | null>(null);

  allSteps = computed<TourStep[]>(() => {
    if (this.steps?.length) return this.steps;
    return [{ faIcon: this.faIcon, title: this.title, description: this.description }];
  });

  currentStep = computed(() => this.allSteps()[this.currentStepIndex()]);
  isLastStep = computed(() => this.currentStepIndex() === this.allSteps().length - 1);
  isFirstStep = computed(() => this.currentStepIndex() === 0);
  isMultiStep = computed(() => this.allSteps().length > 1);

  /** Géométrie du trou lumineux (null = pas d'ancre). */
  spotlightStyle = computed<BoxStyle | null>(() => {
    const r = this.targetRect();
    if (!r) return null;
    return {
      top: `${r.top - this.PAD}px`,
      left: `${r.left - this.PAD}px`,
      width: `${r.width + this.PAD * 2}px`,
      height: `${r.height + this.PAD * 2}px`,
    };
  });

  /** Position de la bulle à côté de l'élément (null = positionnement par défaut via CSS). */
  tooltipStyle = computed<{ top: string; left: string } | null>(() => {
    const r = this.targetRect();
    if (!r) return null;
    const margin = 12;
    const cardW = Math.min(360, window.innerWidth - margin * 2);
    const estCardH = 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = r.left + r.width / 2 - cardW / 2;
    left = Math.max(margin, Math.min(left, vw - cardW - margin));

    const spaceBelow = vh - r.bottom;
    let top: number;
    if (spaceBelow > estCardH + 24) {
      top = r.bottom + this.PAD + 14;
    } else {
      top = r.top - this.PAD - 14 - estCardH;
      if (top < margin) top = margin;
    }
    return { top: `${top}px`, left: `${left}px` };
  });

  private onReposition = () => this.measure(false);

  constructor() {
    // Re-mesure dès que l'étape change (et que le tour est visible).
    effect(() => {
      this.currentStepIndex();
      if (this.isVisible()) {
        queueMicrotask(() => this.measure(true));
      }
    });
  }

  ngOnInit() {
    if (!this.onboardingService.hasSeenTour(this.pageId)) {
      setTimeout(() => {
        this.isVisible.set(true);
        this.measure(true);
        window.addEventListener('resize', this.onReposition);
        window.addEventListener('scroll', this.onReposition, true);
      }, 900);
    }
  }

  ngOnDestroy() {
    this.teardownListeners();
  }

  /**
   * Localise l'élément de l'étape courante, le scrolle en vue puis met à jour `targetRect`.
   * @param scroll Si vrai, scrolle l'élément au centre avant de mesurer.
   */
  private measure(scroll: boolean) {
    const step = this.currentStep();
    if (!step?.anchor) {
      this.targetRect.set(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`);
    if (!el) {
      this.targetRect.set(null);
      return;
    }
    if (scroll) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => this.targetRect.set(el.getBoundingClientRect()), 350);
    } else {
      this.targetRect.set(el.getBoundingClientRect());
    }
  }

  nextStep() {
    if (!this.isLastStep()) {
      this.currentStepIndex.update(i => i + 1);
    }
  }

  prevStep() {
    if (!this.isFirstStep()) {
      this.currentStepIndex.update(i => i - 1);
    }
  }

  dismiss() {
    this.isVisible.set(false);
    this.teardownListeners();
    this.onboardingService.markTourSeen(this.pageId);
  }

  private teardownListeners() {
    window.removeEventListener('resize', this.onReposition);
    window.removeEventListener('scroll', this.onReposition, true);
  }
}
