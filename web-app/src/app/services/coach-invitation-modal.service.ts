import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CoachInvitationModalService {
  isOpen = signal(false);
  invitation = signal<any>(null);

  // Événements pour notifier les composants
  invitationAccepted$ = new Subject<string>();
  invitationRejected$ = new Subject<string>();

  open(invitation: any) {
    this.invitation.set(invitation);
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.invitation.set(null);
  }

  notifyAccepted(invitationId: string) {
    this.invitationAccepted$.next(invitationId);
  }

  notifyRejected(invitationId: string) {
    this.invitationRejected$.next(invitationId);
  }
}
