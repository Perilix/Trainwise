import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-impersonate',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="impersonate-container">
      <div class="impersonate-card">
        @if (status() === 'loading') {
          <div class="spinner"></div>
          <h2>Connexion en cours...</h2>
          <p>Récupération de la session utilisateur.</p>
        } @else if (status() === 'error') {
          <div class="error-icon">⚠️</div>
          <h2>Erreur d'impersonation</h2>
          <p>{{ errorMessage() }}</p>
          <button (click)="goLogin()">Retour à la connexion</button>
        }
      </div>
    </div>
  `,
  styles: [`
    .impersonate-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #F6F4F0;
      padding: 1rem;
      font-family: 'Poppins', sans-serif;
    }
    .impersonate-card {
      background: #fff;
      border-radius: 16px;
      padding: 2.5rem;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      text-align: center;
      max-width: 420px;
      width: 100%;
    }
    h2 {
      font-size: 1.25rem;
      color: #003554;
      margin: 1rem 0 0.5rem;
    }
    p {
      color: #666;
      font-size: 0.95rem;
      margin: 0 0 1.25rem;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e5e7eb;
      border-top-color: #0582ca;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-icon {
      font-size: 2.5rem;
    }
    button {
      background: #0582ca;
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 0.75rem 1.5rem;
      font-weight: 600;
      cursor: pointer;
      font-family: 'Poppins', sans-serif;
    }
    button:hover { background: #003554; }
  `]
})
export class ImpersonateComponent implements OnInit {
  status = signal<'loading' | 'error'>('loading');
  errorMessage = signal<string>('');

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    const token = this.extractTokenFromHash();

    if (!token) {
      this.fail('Token manquant dans l\'URL');
      return;
    }

    this.authService.loginWithToken(token).subscribe({
      next: (user) => {
        history.replaceState(null, '', window.location.pathname);
        const destination = user.role === 'coach' ? '/coach' : '/';
        this.router.navigateByUrl(destination, { replaceUrl: true });
      },
      error: (err) => {
        console.error('Impersonate failed', err);
        this.fail('Token invalide ou expiré. Redemande une session depuis le back-office.');
      }
    });
  }

  private extractTokenFromHash(): string | null {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    return params.get('token');
  }

  private fail(msg: string): void {
    this.errorMessage.set(msg);
    this.status.set('error');
  }

  goLogin(): void {
    this.router.navigate(['/login']);
  }
}
