import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { AuthService } from '../../services/auth.service';

/**
 * Page support — publique (Support URL exigée par l'App Store).
 * URL : https://trainwise-app.com/support — même design que le reste de l'app.
 */
@Component({
  selector: 'app-support',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NavbarComponent],
  templateUrl: './support.component.html',
  styleUrls: ['./legal-pages.scss']
})
export class SupportComponent {
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
