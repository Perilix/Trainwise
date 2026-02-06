import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { AuthService } from '../../../services/auth.service';

interface CoachProfile {
  disciplines: string[];
  experience: number | null;
  diplomas: string[];
  bio: string;
}

@Component({
  selector: 'app-coach-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent],
  templateUrl: './coach-profile.component.html',
  styleUrl: './coach-profile.component.scss'
})
export class CoachProfileComponent implements OnInit {
  isEditing = signal(false);
  isSaving = signal(false);
  saveSuccess = signal(false);
  saveError = signal<string | null>(null);

  // Options
  disciplineOptions = [
    { value: 'running', label: 'Course à pied' },
    { value: 'trail', label: 'Trail' },
    { value: 'triathlon', label: 'Triathlon' },
    { value: 'marathon', label: 'Marathon' },
    { value: 'ultra', label: 'Ultra-trail' },
    { value: 'track', label: 'Piste / Athlétisme' },
    { value: 'cross', label: 'Cross-country' },
    { value: 'fitness', label: 'Fitness / Renforcement' },
    { value: 'cycling', label: 'Cyclisme' },
    { value: 'swimming', label: 'Natation' }
  ];

  diplomaOptions = [
    { value: 'bpjeps', label: 'BPJEPS' },
    { value: 'dejeps', label: 'DEJEPS' },
    { value: 'desjeps', label: 'DESJEPS' },
    { value: 'staps', label: 'Licence/Master STAPS' },
    { value: 'ffa', label: 'Diplôme FFA' },
    { value: 'fftri', label: 'Diplôme FFTri' },
    { value: 'cqp', label: 'CQP ALS' },
    { value: 'other', label: 'Autre certification' }
  ];

  profileForm: CoachProfile = {
    disciplines: [],
    experience: null,
    diplomas: [],
    bio: ''
  };

  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    const user = this.authService.currentUser();
    if (user) {
      this.profileForm = {
        disciplines: user.disciplines || [],
        experience: user.experience || null,
        diplomas: user.diplomas || [],
        bio: user.bio || ''
      };
    }
  }

  toggleEdit() {
    if (this.isEditing()) {
      this.loadProfile();
    }
    this.isEditing.update(v => !v);
    this.saveSuccess.set(false);
    this.saveError.set(null);
  }

  toggleDiscipline(discipline: string) {
    const index = this.profileForm.disciplines.indexOf(discipline);
    if (index === -1) {
      this.profileForm.disciplines.push(discipline);
    } else {
      this.profileForm.disciplines.splice(index, 1);
    }
  }

  isDisciplineSelected(discipline: string): boolean {
    return this.profileForm.disciplines.includes(discipline);
  }

  toggleDiploma(diploma: string) {
    const index = this.profileForm.diplomas.indexOf(diploma);
    if (index === -1) {
      this.profileForm.diplomas.push(diploma);
    } else {
      this.profileForm.diplomas.splice(index, 1);
    }
  }

  isDiplomaSelected(diploma: string): boolean {
    return this.profileForm.diplomas.includes(diploma);
  }

  getDisciplineLabel(value: string): string {
    return this.disciplineOptions.find(d => d.value === value)?.label || value;
  }

  getDiplomaLabel(value: string): string {
    return this.diplomaOptions.find(d => d.value === value)?.label || value;
  }

  async saveProfile() {
    this.isSaving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    try {
      await this.authService.updateProfile(this.profileForm).toPromise();
      this.saveSuccess.set(true);
      this.isEditing.set(false);
      setTimeout(() => this.saveSuccess.set(false), 3000);
    } catch (error: any) {
      this.saveError.set(error?.error?.message || 'Erreur lors de la sauvegarde');
    } finally {
      this.isSaving.set(false);
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
