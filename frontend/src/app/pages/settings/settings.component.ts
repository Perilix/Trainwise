import { Component, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  isSaving = signal(false);
  isUploadingAvatar = signal(false);
  saveSuccess = signal(false);
  saveError = signal<string | null>(null);

  formData = {
    firstName: '',
    lastName: '',
    phone: ''
  };

  constructor(
    public authService: AuthService,
    private router: Router,
    private location: Location
  ) {
    this.initForm();
  }

  initForm() {
    const user = this.authService.currentUser();
    if (user) {
      this.formData = {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || ''
      };
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.saveError.set('Veuillez sélectionner une image');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      this.saveError.set('L\'image ne doit pas dépasser 5 Mo');
      return;
    }

    this.uploadAvatar(file);
  }

  uploadAvatar(file: File) {
    this.isUploadingAvatar.set(true);
    this.saveError.set(null);

    this.authService.uploadAvatar(file).subscribe({
      next: () => {
        this.isUploadingAvatar.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: (err) => {
        this.isUploadingAvatar.set(false);
        this.saveError.set('Erreur lors de l\'upload de la photo');
        console.error(err);
      }
    });
  }

  deleteAvatar() {
    if (!confirm('Supprimer votre photo de profil ?')) return;

    this.isUploadingAvatar.set(true);
    this.authService.deleteAvatar().subscribe({
      next: () => {
        this.isUploadingAvatar.set(false);
      },
      error: (err) => {
        this.isUploadingAvatar.set(false);
        this.saveError.set('Erreur lors de la suppression');
        console.error(err);
      }
    });
  }

  saveProfile() {
    this.isSaving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    this.authService.updateProfile(this.formData).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.saveError.set('Erreur lors de la sauvegarde');
        console.error(err);
      }
    });
  }

  getUserInitials(): string {
    const user = this.authService.currentUser();
    if (!user) return '?';
    const first = user.firstName?.charAt(0) || '';
    const last = user.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
  }

  goBack() {
    this.location.back();
  }

  triggerFileInput() {
    if (!this.isUploadingAvatar()) {
      this.fileInput?.nativeElement.click();
    }
  }
}
