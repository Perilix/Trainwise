import { Routes } from '@angular/router';
import { authGuard, guestGuard, homeGuard } from './guards/auth.guard';
import { coachGuard } from './guards/coach.guard';
import { athleteGuard } from './guards/athlete.guard';

export const routes: Routes = [
  // Pages publiques (exigées par les stores — accessibles sans connexion)
  {
    path: 'privacy',
    loadComponent: () => import('./pages/legal/privacy.component').then(m => m.PrivacyComponent)
  },
  {
    path: 'support',
    loadComponent: () => import('./pages/legal/support.component').then(m => m.SupportComponent)
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent)
  },

  // Routes Athlète (bloquées pour les coachs)
  {
    path: '',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [homeGuard, athleteGuard]
  },
  {
    path: 'analyse',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
    canActivate: [authGuard, athleteGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard, athleteGuard]
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'planning',
    loadComponent: () => import('./pages/planning/planning.component').then(m => m.PlanningComponent),
    canActivate: [authGuard, athleteGuard]
  },
  {
    path: 'planning/running-detail/:sessionId',
    loadComponent: () => import('./pages/running-plan-detail/running-plan-detail.component').then(m => m.RunningPlanDetailComponent),
    canActivate: [authGuard, athleteGuard]
  },
  {
    path: 'planning/muscu-detail/:sessionId',
    loadComponent: () => import('./pages/muscu-plan-detail/muscu-plan-detail.component').then(m => m.MuscuPlanDetailComponent),
    canActivate: [authGuard, athleteGuard]
  },
  {
    path: 'strength/log',
    loadComponent: () => import('./pages/strength-log/strength-log.component').then(m => m.StrengthLogComponent),
    canActivate: [authGuard, athleteGuard]
  },
  {
    path: 'sorties',
    loadComponent: () => import('./pages/sorties/sorties.component').then(m => m.SortiesComponent),
    canActivate: [authGuard, athleteGuard]
  },
  {
    path: 'run/:id',
    loadComponent: () => import('./pages/run-detail/run-detail.component').then(m => m.RunDetailComponent),
    canActivate: [authGuard, athleteGuard]
  },
  {
    path: 'friends',
    loadComponent: () => import('./pages/friends/friends.component').then(m => m.FriendsComponent),
    canActivate: [authGuard, athleteGuard]
  },
  {
    path: 'shop',
    loadComponent: () => import('./pages/shop/shop.component').then(m => m.ShopComponent),
    canActivate: [authGuard, athleteGuard]
  },
  {
    path: 'discover-coach',
    loadComponent: () => import('./pages/discover-coach/discover-coach.component').then(m => m.DiscoverCoachComponent),
    canActivate: [authGuard, athleteGuard]
  },
  {
    path: 'user/:id',
    loadComponent: () => import('./pages/user-profile/user-profile.component').then(m => m.UserProfileComponent),
    canActivate: [authGuard, athleteGuard]
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
    path: 'coach/athletes/:athleteId/muscu-detail/:sessionId',
    loadComponent: () => import('./pages/coach/muscu-detail/muscu-detail.component').then(m => m.MuscuDetailComponent),
    canActivate: [authGuard, coachGuard]
  },
  {
    path: 'coach/athletes/:athleteId/running-detail/:sessionId',
    loadComponent: () => import('./pages/coach/running-detail/running-detail.component').then(m => m.RunningDetailComponent),
    canActivate: [authGuard, coachGuard]
  },
  {
    path: 'coach/athletes/:athleteId/run/:runId',
    loadComponent: () => import('./pages/coach/athlete-run-detail/athlete-run-detail.component').then(m => m.AthleteRunDetailComponent),
    canActivate: [authGuard, coachGuard]
  },
  {
    path: 'coach/exercises',
    loadComponent: () => import('./pages/coach/exercises-management/exercises-management.component').then(m => m.ExercisesManagementComponent),
    canActivate: [authGuard, coachGuard]
  },
  {
    path: 'coach/session-templates/new',
    loadComponent: () => import('./pages/coach/session-template-editor/session-template-editor.component').then(m => m.SessionTemplateEditorComponent),
    canActivate: [authGuard, coachGuard]
  },
  {
    path: 'coach/session-templates/:id/edit',
    loadComponent: () => import('./pages/coach/session-template-editor/session-template-editor.component').then(m => m.SessionTemplateEditorComponent),
    canActivate: [authGuard, coachGuard]
  },
  {
    path: 'coach/profile',
    loadComponent: () => import('./pages/coach/coach-profile/coach-profile.component').then(m => m.CoachProfileComponent),
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
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'reset-password/:token',
    loadComponent: () => import('./pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'impersonate',
    loadComponent: () => import('./pages/impersonate/impersonate.component').then(m => m.ImpersonateComponent)
  },
  {
    path: 'beta/feedback',
    loadComponent: () => import('./pages/beta-feedback/beta-feedback.component').then(m => m.BetaFeedbackComponent),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
