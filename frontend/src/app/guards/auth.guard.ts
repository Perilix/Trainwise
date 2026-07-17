import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};

// Racine du site : sur le web, un visiteur non connecté atterrit sur la vitrine ;
// dans l'app native, il garde l'écran de connexion.
export const homeGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate([Capacitor.isNativePlatform() ? '/login' : '/about']);
  return false;
};

export const guestGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  const returnUrl = state.root.queryParamMap.get('returnUrl');
  router.navigateByUrl(returnUrl || '/');
  return false;
};
