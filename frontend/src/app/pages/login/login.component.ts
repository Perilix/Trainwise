import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  isLoading = signal(false);
  error = signal<string | null>(null);
  resetSuccess = signal(false);

  constructor(private authService: AuthService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit() {
    if (this.route.snapshot.queryParamMap.get('reset') === 'success') {
      this.resetSuccess.set(true);
    }
  }

  onSubmit() {
    if (!this.email || !this.password) {
      this.error.set('Veuillez remplir tous les champs');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const fallback = Capacitor.isNativePlatform() ? '/' : '/beta/feedback';
        this.router.navigateByUrl(returnUrl || fallback);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err.error?.error || 'Erreur de connexion');
      }
    });
  }
}
