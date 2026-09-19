import { Routes } from '@angular/router';

import { athleteGuard, authGuard, coachGuard, guestGuard } from './core/guards';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'accueil' },

  // ---- Écrans publics ----
  {
    path: 'connexion',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'inscription',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'mot-de-passe-oublie',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/forgot-password.page').then((m) => m.ForgotPasswordPage),
  },

  // ---- Application connectée ----
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      // Athlète
      {
        path: 'accueil',
        canActivate: [athleteGuard],
        loadComponent: () => import('./pages/athlete/home.page').then((m) => m.AthleteHomePage),
      },
      {
        path: 'planning',
        canActivate: [athleteGuard],
        loadComponent: () => import('./pages/athlete/planning.page').then((m) => m.AthletePlanningPage),
      },
      {
        path: 'sorties',
        canActivate: [athleteGuard],
        loadComponent: () => import('./pages/athlete/runs.page').then((m) => m.AthleteRunsPage),
      },
      {
        path: 'sorties/nouvelle',
        canActivate: [athleteGuard],
        loadComponent: () => import('./pages/athlete/log-run.page').then((m) => m.LogRunPage),
      },
      {
        path: 'sorties/:id/deroule',
        canActivate: [athleteGuard],
        loadComponent: () => import('./pages/athlete/run-blocks.page').then((m) => m.AthleteRunBlocksPage),
      },
      {
        path: 'sorties/:id',
        canActivate: [athleteGuard],
        loadComponent: () => import('./pages/athlete/run-detail.page').then((m) => m.RunDetailPage),
      },
      {
        path: 'seance/:id',
        canActivate: [athleteGuard],
        loadComponent: () => import('./pages/athlete/session-detail.page').then((m) => m.SessionDetailPage),
      },
      {
        path: 'muscu/:id',
        canActivate: [athleteGuard],
        loadComponent: () => import('./pages/athlete/strength.page').then((m) => m.AthleteStrengthPage),
      },
      {
        path: 'muscu-realisee/:id',
        canActivate: [athleteGuard],
        loadComponent: () => import('./pages/athlete/strength-done.page').then((m) => m.AthleteStrengthDonePage),
      },
      {
        path: 'compte',
        canActivate: [athleteGuard],
        loadComponent: () => import('./pages/athlete/account.page').then((m) => m.AthleteAccountPage),
      },
      {
        path: 'connecteurs',
        canActivate: [athleteGuard],
        loadComponent: () => import('./pages/athlete/connectors.page').then((m) => m.AthleteConnectorsPage),
      },
      {
        path: 'profil',
        canActivate: [athleteGuard],
        loadComponent: () => import('./pages/athlete/profile.page').then((m) => m.AthleteProfilePage),
      },

      // Coach
      {
        path: 'coach',
        canActivate: [coachGuard],
        loadComponent: () => import('./pages/coach/dashboard.page').then((m) => m.CoachDashboardPage),
      },
      {
        path: 'coach/profil',
        canActivate: [coachGuard],
        loadComponent: () => import('./pages/coach/profile.page').then((m) => m.CoachProfilePage),
      },
      {
        path: 'coach/abonnement',
        canActivate: [coachGuard],
        loadComponent: () => import('./pages/coach/billing.page').then((m) => m.CoachBillingPage),
      },
      {
        path: 'coach/stats',
        canActivate: [coachGuard],
        loadComponent: () => import('./pages/coach/stats.page').then((m) => m.CoachStatsPage),
      },
      {
        path: 'coach/bibliotheque',
        canActivate: [coachGuard],
        loadComponent: () => import('./pages/coach/library.page').then((m) => m.CoachLibraryPage),
      },
      {
        path: 'coach/bibliotheque/editeur',
        canActivate: [coachGuard],
        loadComponent: () => import('./pages/coach/session-editor.page').then((m) => m.CoachSessionEditorPage),
      },
      {
        path: 'coach/bibliotheque/editeur/:id',
        canActivate: [coachGuard],
        loadComponent: () => import('./pages/coach/session-editor.page').then((m) => m.CoachSessionEditorPage),
      },
      {
        path: 'coach/bibliotheque/muscu',
        canActivate: [coachGuard],
        loadComponent: () => import('./pages/coach/strength-editor.page').then((m) => m.CoachStrengthEditorPage),
      },
      {
        path: 'coach/bibliotheque/muscu/:id',
        canActivate: [coachGuard],
        loadComponent: () => import('./pages/coach/strength-editor.page').then((m) => m.CoachStrengthEditorPage),
      },
      {
        path: 'coach/exercices',
        canActivate: [coachGuard],
        loadComponent: () => import('./pages/coach/exercises.page').then((m) => m.CoachExercisesPage),
      },
      {
        path: 'coach/athletes/:id',
        canActivate: [coachGuard],
        loadComponent: () => import('./pages/coach/athlete-detail.page').then((m) => m.CoachAthletePage),
      },
      {
        path: 'coach/athletes/:id/planning',
        canActivate: [coachGuard],
        loadComponent: () => import('./pages/coach/athlete-planning.page').then((m) => m.CoachAthletePlanningPage),
      },
      {
        path: 'coach/athletes/:id/seance/:planId',
        canActivate: [coachGuard],
        loadComponent: () => import('./pages/coach/athlete-planned.page').then((m) => m.CoachAthletePlannedPage),
      },
      {
        path: 'coach/athletes/:id/sortie/:runId',
        canActivate: [coachGuard],
        loadComponent: () => import('./pages/coach/athlete-session.page').then((m) => m.CoachAthleteSessionPage),
      },
      {
        path: 'coach/athletes/:id/muscu/:sessionId',
        canActivate: [coachGuard],
        loadComponent: () => import('./pages/coach/athlete-strength.page').then((m) => m.CoachAthleteStrengthPage),
      },

      // Écrans partagés par les deux rôles
      {
        path: 'messages',
        loadComponent: () => import('./pages/chat/messages.page').then((m) => m.MessagesPage),
      },
      {
        path: 'notifications',
        loadComponent: () => import('./pages/shared/notifications.page').then((m) => m.NotificationsPage),
      },
      {
        path: 'boutique',
        loadComponent: () => import('./pages/shared/shop.page').then((m) => m.ShopPage),
      },
    ],
  },

  { path: '**', redirectTo: 'accueil' },
];
