import { Component, signal, computed } from '@angular/core';
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
  password = signal('');
  confirmPassword = '';

  // Step 2: Profile
  firstName = '';
  lastName = '';
  phone = '';

  currentStep = signal(1);
  isLoading = signal(false);
  error = signal<string | null>(null);

  showPassword = signal(false);
  showConfirmPassword = signal(false);

  passwordStrength = computed(() => {
    const pwd = this.password();
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (pwd.length >= 12) score++;
    return Math.min(score, 4);
  });

  passwordStrengthLabel = computed(() => {
    const s = this.passwordStrength();
    if (!this.password()) return '';
    return ['Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'][s];
  });

  constructor(private authService: AuthService, private router: Router) {}

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPassword() {
    this.showConfirmPassword.update(v => !v);
  }

  nextStep() {
    // Validate step 1
    if (!this.email || !this.password() || !this.confirmPassword) {
      this.error.set('Veuillez remplir tous les champs');
      return;
    }

    if (this.password() !== this.confirmPassword) {
      this.error.set('Les mots de passe ne correspondent pas');
      return;
    }

    if (this.password().length < 6) {
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
      password: this.password(),
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
