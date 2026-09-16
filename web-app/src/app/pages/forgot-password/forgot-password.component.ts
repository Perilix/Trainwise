import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {
  email = '';
  isLoading = signal(false);
  success = signal(false);
  error = signal<string | null>(null);

  constructor(private authService: AuthService) {}

  onSubmit() {
    if (!this.email) {
      this.error.set('Veuillez saisir votre adresse email');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.authService.forgotPassword(this.email).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err.error?.error || 'Une erreur est survenue. Veuillez réessayer.');
      }
    });
  }
}
