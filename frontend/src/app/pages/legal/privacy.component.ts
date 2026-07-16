import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { AuthService } from '../../services/auth.service';

/**
 * Politique de confidentialité — page publique (exigée par l'App Store et Google Play).
 * URL : https://trainwise-app.com/privacy — même design que le reste de l'app.
 */
@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [NavbarComponent],
  templateUrl: './privacy.component.html',
  styleUrls: ['./legal-pages.scss']
})
export class PrivacyComponent {
  authService = inject(AuthService);
  private location = inject(Location);
  private router = inject(Router);

  currentYear = new Date().getFullYear();

  goBack() {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }
}
