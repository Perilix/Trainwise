import { Component, Input, Output, EventEmitter, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { COACH_PACKAGES, CoachPackage } from '../../interfaces/package.interface';

@Component({
  selector: 'app-coach-invitation-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coach-invitation-modal.component.html',
  styleUrl: './coach-invitation-modal.component.scss'
})
export class CoachInvitationModalComponent implements OnInit, OnDestroy {
  @Input() invitation: any;
  @Output() accept = new EventEmitter<void>();
  @Output() reject = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  ngOnInit() {
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
  }

  // Get package details based on invitation
  get packageDetails(): CoachPackage {
    const packageType = this.invitation?.packageType || 'bronze';
    // Vérifier que le type est valide, sinon utiliser bronze par défaut
    const validTypes: string[] = ['bronze', 'silver', 'gold'];
    const type = validTypes.includes(packageType) ? packageType : 'bronze';
    return COACH_PACKAGES[type as keyof typeof COACH_PACKAGES];
  }

  onAccept() {
    this.accept.emit();
  }

  onReject() {
    this.reject.emit();
  }

  onClose() {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
