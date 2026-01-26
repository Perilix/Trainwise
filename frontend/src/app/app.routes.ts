import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';
import { coachGuard } from './guards/coach.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'analyse',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard]
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'planning',
    loadComponent: () => import('./pages/planning/planning.component').then(m => m.PlanningComponent),
    canActivate: [authGuard]
  },
  {
    path: 'run/:id',
    loadComponent: () => import('./pages/run-detail/run-detail.component').then(m => m.RunDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'chat',
    loadComponent: () => import('./pages/chat/conversations-list/conversations-list.component').then(m => m.ConversationsListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'chat/:id',
    loadComponent: () => import('./pages/chat/conversation-detail/conversation-detail.component').then(m => m.ConversationDetailComponent),
    canActivate: [authGuard]
  },
  // Routes Coach
  {
    path: 'coach',
    loadComponent: () => import('./pages/coach/coach-dashboard/coach-dashboard.component').then(m => m.CoachDashboardComponent),
    canActivate: [authGuard, coachGuard]
  },
  {
    path: 'coach/athletes/:id',
    loadComponent: () => import('./pages/coach/athlete-detail/athlete-detail.component').then(m => m.AthleteDetailComponent),
    canActivate: [authGuard, coachGuard]
  },
  {
    path: 'coach/athletes/:id/planning',
    loadComponent: () => import('./pages/coach/athlete-planning/athlete-planning.component').then(m => m.AthletePlanningComponent),
    canActivate: [authGuard, coachGuard]
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent),
    canActivate: [guestGuard]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
