import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { CoachSubscriptionModalComponent } from '../../components/coach-subscription-modal/coach-subscription-modal.component';
import { ChatService, PartnerCoachPreview } from '../../services/chat.service';
import { COACH_PACKAGES, PackageType } from '../../interfaces/package.interface';
import { AthleteService } from '../../services/athlete.service';

@Component({
  selector: 'app-discover-coach',
  standalone: true,
  imports: [CommonModule, NavbarComponent, CoachSubscriptionModalComponent],
  templateUrl: './discover-coach.component.html',
  styleUrl: './discover-coach.component.scss'
})
export class DiscoverCoachComponent implements OnInit {
  partnerCoach = signal<PartnerCoachPreview | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  isJoining = signal(false);
  showSubscriptionModal = signal(false);
  readonly packages = [COACH_PACKAGES.bronze, COACH_PACKAGES.silver, COACH_PACKAGES.gold];
  selectedPkgType = signal<PackageType>('silver');
  // Demande auprès du coach partenaire : 'requested' (en attente de validation) ou 'accepted' (coaché)
  requestStatus = signal<'requested' | 'accepted' | null>(null);
  pendingPackage = signal<PackageType | null>(null);

  get selectedPkg() {
    return COACH_PACKAGES[this.selectedPkgType()];
  }

  get pendingPkg() {
    const type = this.pendingPackage();
    return type ? COACH_PACKAGES[type] : null;
  }

  constructor(
    private chatService: ChatService,
    private athleteService: AthleteService,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit() {
    this.loadPartnerCoach();
    this.loadPendingRequest();
  }

  loadPendingRequest() {
    this.chatService.getCoachSubscriptionRequest().subscribe({
      next: (res) => {
        const type = res.request?.packageType as PackageType | undefined;
        if (type && res.request) {
          this.requestStatus.set(res.request.status);
          this.pendingPackage.set(type);
          this.selectedPkgType.set(type);
        }
      },
      error: () => {}
    });
  }

  onRequested(type: PackageType) {
    this.requestStatus.set('requested');
    this.pendingPackage.set(type);
    this.selectedPkgType.set(type);
  }

  selectPkg(type: PackageType) {
    // Une demande est en cours : on ne change plus de forfait depuis la page
    if (this.pendingPackage()) return;
    this.selectedPkgType.set(type);
  }

  goBack() {
    this.location.back();
  }

  loadPartnerCoach() {
    this.chatService.getPartnerCoach().subscribe({
      next: (coach) => {
        this.partnerCoach.set(coach);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Impossible de charger les informations du coach');
        this.isLoading.set(false);
      }
    });
  }

  contactCoach() {
    const coach = this.partnerCoach();
    if (!coach) return;

    this.chatService.getOrCreateConversation(coach._id).subscribe({
      next: (conversation) => {
        this.router.navigate(['/chat', conversation._id]);
      },
      error: (err) => {
        console.error('Erreur lors de la création de la conversation:', err);
        this.error.set('Impossible de contacter le coach');
      }
    });
  }
}
