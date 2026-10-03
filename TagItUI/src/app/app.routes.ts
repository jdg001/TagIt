import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./components/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent)
  },
  {
    path: 'role-selector',
    loadComponent: () => import('./components/role-selector/role-selector.component').then(m => m.RoleSelectorComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'designer',
    loadComponent: () => import('./components/designer-page/designer-page.component').then(m => m.DesignerPageComponent),
    canActivate: [AuthGuard]
    },
  {
    path: 'live-preview',
    loadComponent: () => import('./components/live-preview-page/live-preview-page.component').then(m => m.LivePreviewPageComponent)
  },
    {
      path: 'login',
      loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
    },
];
