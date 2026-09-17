import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { NavbarComponent } from '../navbar/navbar.component';
import { AuthService } from '../../services/auth.service';

/**
 * Chrome des pages publiques (à propos, support, confidentialité) : bandeau en
 * haut, sidebar à partir de 1024px — le même repère que l'app connectée, à qui
 * on rend la main dès qu'une session existe.
 */
@Component({
  selector: 'app-public-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NavbarComponent],
  templateUrl: './public-nav.component.html',
  styleUrl: './public-nav.component.scss'
})
export class PublicNavComponent {
  authService = inject(AuthService);

  // Lien App Store — à renseigner une fois l'app approuvée :
  // 'https://apps.apple.com/app/id<APP_STORE_ID>' (ID dans App Store Connect → App Information).
  // Tant que c'est null, le badge affiche « Bientôt sur l'App Store ».
  appStoreUrl: string | null = null;
}
