import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.user() ? true : router.createUrlTree(['/connexion']);
};

/** L'espace coach est réservé au rôle coach ; un athlète y est renvoyé vers son accueil. */
export const coachGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.user()) return router.createUrlTree(['/connexion']);
  return auth.isCoach() ? true : router.createUrlTree(['/accueil']);
};

export const athleteGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.user()) return router.createUrlTree(['/connexion']);
  return auth.isCoach() ? router.createUrlTree(['/coach']) : true;
};

/** Écrans de connexion : un utilisateur déjà connecté est renvoyé chez lui. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.user()) return true;
  return router.createUrlTree([auth.isCoach() ? '/coach' : '/accueil']);
};
