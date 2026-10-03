import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  email: string = '';
  password: string = '';
  isDarkMode = true; // Default to dark mode
  isLoading = false; // Loading state for OAuth request
  errorMessage: string | null = null; // Error message from URL parameters
  showPasswordField = false; // Show password field for admin user
  isAdminUser = false; // Track if current user is admin

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private themeService: ThemeService
  ) {}

  ngOnInit() {
    this.initializeTheme();

    // Check for error message in URL parameters
    this.route.queryParams.subscribe(params => {
      if (params['error']) {
        this.errorMessage = decodeURIComponent(params['error']);
        // Clear the error from URL to prevent it from showing again on refresh
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { error: null },
          queryParamsHandling: 'merge'
        });
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

  toggleTheme() {
    // Use centralized theme service
    this.themeService.toggleTheme();
  }

  clearError() {
    this.errorMessage = null;
  }

  onEmailChange() {
    this.clearError();
    // Check if the email is the admin email
    this.isAdminUser = this.email.toLowerCase().trim() === 'admin@tagit.net';
    this.showPasswordField = this.isAdminUser;
    
    // Clear password when switching away from admin
    if (!this.isAdminUser) {
      this.password = '';
    }
  }

  getButtonText(): string {
    return this.isAdminUser ? 'Sign In' : 'Continue';
  }

  getLoadingText(): string {
    return this.isAdminUser ? 'Signing in...' : 'Connecting...';
  }

  getSubtitleText(): string {
    return this.isAdminUser ? 'Enter your credentials to sign in' : 'Enter your email to continue';
  }

  continueLogin() {
    // Clear any existing error message
    this.clearError();

    // Validate that an email is entered
    if (!this.email || this.email.trim() === '') {
      console.error('Please enter an email address');
      return;
    }

    // Validate email format
    const emailParts = this.email.split('@');
    if (emailParts.length !== 2) {
      console.error('Please enter a valid email address');
      return;
    }

    // Set loading state
    this.isLoading = true;

    // Handle admin user authentication
    if (this.isAdminUser) {
      // Validate password for admin user
      if (!this.password || this.password.trim() === '') {
        this.errorMessage = 'Please enter your password';
        this.isLoading = false;
        return;
      }

      // Call Google login API with password for admin user
      this.authService.requestGoogleLogin(this.email, this.password).subscribe({
        next: (response) => {
          console.log('Admin login successful:', response);
          // Redirect to the auth callback URL with JWT token
          window.location.href = response.authUrl;
        },
        error: (error) => {
          console.error('Error with admin login:', error);
          this.isLoading = false;
          
          // Display user-friendly error message
          if (error.status === 401) {
            this.errorMessage = 'Invalid email or password';
          } else if (error.status === 500) {
            this.errorMessage = 'Server error. Please try again later.';
          } else {
            this.errorMessage = 'Login failed. Please check your credentials and try again.';
          }
        }
      });
    } else {
      // Handle regular user authentication with Google OAuth
      const domain = emailParts[1];
      console.log(`Tenant domain: ${domain}`);

      // Call the AuthService to get Google OAuth URL
      this.authService.requestGoogleLogin(this.email).subscribe({
        next: (response) => {
          console.log('Google OAuth URL received:', response.authUrl);
          // Redirect to Google OAuth URL
          window.location.href = response.authUrl;
        },
        error: (error) => {
          console.error('Error requesting Google login:', error);
          this.isLoading = false;
          
          // Display user-friendly error message
          if (error.status === 400) {
            this.errorMessage = 'Invalid email format or missing email';
          } else if (error.status === 500) {
            this.errorMessage = 'Server error. Please try again later.';
          } else {
            this.errorMessage = 'Failed to initiate Google login. Please check your connection and try again.';
          }
        }
      });
    }
  }
}
