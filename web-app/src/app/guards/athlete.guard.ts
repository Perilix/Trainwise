import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const athleteGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Si l'utilisateur est un coach, rediriger vers l'espace coach
  if (authService.isCoach()) {
    router.navigate(['/coach']);
    return false;
  }

  return true;
};
