import { Component, OnInit, AfterViewInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';

@Component({
    standalone: true,
    selector: 'app-root',
    imports: [
    RouterOutlet,
    RouterModule,
    CommonModule,
    FormsModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, AfterViewInit {

  // Theme and UI state
  isDarkMode = true;

  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);

  ngOnInit() {
    this.initializeTheme();
    // Delay authentication check to avoid interfering with auth callback
    setTimeout(() => {
      this.checkAuthenticationStatus();
    }, 50);
  }

  ngAfterViewInit() {
    // Set the theme state after view initialization
    if (this.cdr) {
      this.cdr.detectChanges();
    }
  }

  private initializeTheme(): void {
    // Initialize theme from centralized service
    this.isDarkMode = this.themeService.initializeComponentTheme();
    
    // Subscribe to theme changes
    this.themeService.onThemeChange().subscribe(isDarkMode => {
      this.isDarkMode = isDarkMode;
      this.cdr.detectChanges();
    });
  }

  private checkAuthenticationStatus(): void {
    // Check if user is authenticated and redirect accordingly
    const currentUrl = this.router.url;
    
    console.log('App component checking auth status for URL:', currentUrl);
    
    // Don't redirect if we're already on auth callback or login page
    if (currentUrl.includes('/auth/callback') || currentUrl.includes('/login')) {
      console.log('Skipping redirect for auth callback or login page');
      return;
    }

    // Check if we have a token in the URL (might be in the middle of auth process)
    if (currentUrl.includes('token=')) {
      console.log('Token detected in URL, skipping redirect');
      return;
    }

    const isAuthenticated = this.authService.isAuthenticated();
    console.log('User authenticated:', isAuthenticated);

    // If user is authenticated and on root path, redirect to dashboard
    if (isAuthenticated && currentUrl === '/') {
      console.log('Redirecting authenticated user from root to dashboard');
      this.router.navigate(['/dashboard']);
    }
    // For all other cases, let the AuthGuard handle the protection
    // The routes will handle showing the login page for unauthenticated users
  }
}
