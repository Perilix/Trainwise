import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { AuthService } from '../../services/auth.service';

/**
 * Page vitrine — publique (Marketing URL affichée sur l'App Store).
 * URL : https://www.trainwise-app.com/about — même design que le reste de l'app.
 */
@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NavbarComponent],
  templateUrl: './about.component.html',
  styleUrls: ['../legal/legal-pages.scss']
})
export class AboutComponent {
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
