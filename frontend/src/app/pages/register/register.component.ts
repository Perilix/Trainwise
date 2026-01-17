import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  // Step 1: Credentials
  email = '';
  password = '';
  confirmPassword = '';

  // Step 2: Profile
  firstName = '';
  lastName = '';
  phone = '';

  currentStep = signal(1);
  isLoading = signal(false);
  error = signal<string | null>(null);

  constructor(private authService: AuthService, private router: Router) {}

  nextStep() {
    // Validate step 1
    if (!this.email || !this.password || !this.confirmPassword) {
      this.error.set('Veuillez remplir tous les champs');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error.set('Les mots de passe ne correspondent pas');
      return;
    }

    if (this.password.length < 6) {
      this.error.set('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(this.email)) {
      this.error.set('Email invalide');
      return;
    }

    this.error.set(null);
    this.currentStep.set(2);
  }

  previousStep() {
    this.currentStep.set(1);
    this.error.set(null);
  }

  onSubmit() {
    // Validate step 2
    if (!this.firstName || !this.lastName) {
      this.error.set('Veuillez remplir le nom et le prénom');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.authService.register({
      email: this.email,
      password: this.password,
      firstName: this.firstName,
      lastName: this.lastName,
      phone: this.phone || undefined
    }).subscribe({
      next: () => {
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err.error?.error || 'Erreur lors de l\'inscription');
      }
    });
  }
}
