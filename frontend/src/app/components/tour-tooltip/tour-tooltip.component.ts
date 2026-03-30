import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnboardingService } from '../../services/onboarding.service';

@Component({
  selector: 'app-tour-tooltip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tour-tooltip.component.html',
  styleUrl: './tour-tooltip.component.scss'
})
export class TourTooltipComponent implements OnInit {
  @Input({ required: true }) pageId!: string;
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
  @Input() icon: string = '💡';

  private onboardingService = inject(OnboardingService);

  isVisible = signal(false);

  ngOnInit() {
    if (!this.onboardingService.hasSeenTour(this.pageId)) {
      setTimeout(() => this.isVisible.set(true), 900);
    }
  }

  dismiss() {
    this.isVisible.set(false);
    this.onboardingService.markTourSeen(this.pageId);
  }
}
