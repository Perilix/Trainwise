import { Component, Input, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnboardingService } from '../../services/onboarding.service';

export interface TourStep {
  faIcon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-tour-tooltip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tour-tooltip.component.html',
  styleUrl: './tour-tooltip.component.scss'
})
export class TourTooltipComponent implements OnInit {
  @Input({ required: true }) pageId!: string;
  // Mode simple (1 étape)
  @Input() faIcon: string = 'fa-lightbulb';
  @Input() title: string = '';
  @Input() description: string = '';
  // Mode multi-étapes (surcharge le mode simple si fourni)
  @Input() steps?: TourStep[];

  private onboardingService = inject(OnboardingService);

  isVisible = signal(false);
  currentStepIndex = signal(0);

  allSteps = computed<TourStep[]>(() => {
    if (this.steps?.length) return this.steps;
    return [{ faIcon: this.faIcon, title: this.title, description: this.description }];
  });

  currentStep = computed(() => this.allSteps()[this.currentStepIndex()]);
  isLastStep = computed(() => this.currentStepIndex() === this.allSteps().length - 1);
  isMultiStep = computed(() => this.allSteps().length > 1);

  ngOnInit() {
    if (!this.onboardingService.hasSeenTour(this.pageId)) {
      setTimeout(() => this.isVisible.set(true), 900);
    }
  }

  nextStep() {
    if (!this.isLastStep()) {
      this.currentStepIndex.update(i => i + 1);
    }
  }

  dismiss() {
    this.isVisible.set(false);
    this.onboardingService.markTourSeen(this.pageId);
  }
}
