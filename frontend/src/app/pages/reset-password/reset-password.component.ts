import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit {
  password = '';
  confirmPassword = '';
  token = '';
  isLoading = signal(false);
  error = signal<string | null>(null);

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') || '';
  }

  onSubmit() {
    if (!this.password || !this.confirmPassword) {
      this.error.set('Veuillez remplir tous les champs');
      return;
    }

    if (this.password.length < 6) {
      this.error.set('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error.set('Les mots de passe ne correspondent pas');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.authService.resetPassword(this.token, this.password).subscribe({
      next: () => {
        this.router.navigate(['/login'], { queryParams: { reset: 'success' } });
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err.error?.error || 'Une erreur est survenue. Veuillez réessayer.');
      }
    });
  }
}
