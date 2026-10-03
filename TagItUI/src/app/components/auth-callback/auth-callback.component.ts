import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Full-screen auth callback page -->
    <div class="auth-callback-container" [class.dark-theme]="isDarkMode">
      <!-- Centered card -->
      <div class="auth-callback-card">
        <!-- Card header -->
        <div class="auth-callback-header">
          <div class="auth-callback-logo">
            <img src="assets/tagit-logo.svg" alt="TagIt Logo" width="80" height="80">
          </div>
          <h1 class="auth-callback-title">Completing Authentication</h1>
          <p class="auth-callback-subtitle">Please wait while we complete your login</p>
        </div>

        <!-- Card content -->
        <div class="auth-callback-content">
          <div class="loading-spinner">
            <svg class="spinner" width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
              </circle>
            </svg>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./auth-callback.component.scss']
})
export class AuthCallbackComponent implements OnInit {
  isDarkMode = true; // Default to dark mode

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.initializeTheme();
    // Get the token from query parameters
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      
      if (token) {
        console.log('Received JWT token from callback:', token.substring(0, 50) + '...');
        
        try {
          // Store the token and user info
          this.authService.setAuthToken(token);
          
          // Wait a bit for the authentication state to be fully processed
          setTimeout(() => {
            // Verify authentication was successful
            if (this.authService.isAuthenticated()) {
              console.log('Authentication successful, redirecting to dashboard');
              // Redirect to dashboard after successful authentication
              this.router.navigate(['/dashboard']);
            } else {
              console.error('Authentication failed after setting token');
              this.router.navigate(['/login']);
            }
          }, 100); // Small delay to ensure auth state is processed
        } catch (error) {
          console.error('Error during authentication:', error);
          this.router.navigate(['/login']);
        }
      } else {
        console.error('No token received in callback');
        // Redirect to login if no token
        this.router.navigate(['/login']);
      }
    });
  }

  private initializeTheme(): void {
    // Initialize theme from centralized service
    this.isDarkMode = this.themeService.initializeComponentTheme();
    
    // Subscribe to theme changes
    this.themeService.onThemeChange().subscribe(isDarkMode => {
      this.isDarkMode = isDarkMode;
    });
  }
}
