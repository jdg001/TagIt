import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { ApiConfigService } from './api-config.service';

export interface GoogleLoginResponse {
  authUrl: string;
}

export interface UserInfo {
  sub: string;
  email: string;
  name: string;
  roles: string[];
  picture: string;
  tenant_domain: string;
  tenant_id: string;
  user_id: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'tagit_auth_token';
  private readonly USER_INFO_KEY = 'tagit_user_info';
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private userInfoSubject = new BehaviorSubject<UserInfo | null>(null);

  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  public userInfo$ = this.userInfoSubject.asObservable();

  constructor(
    private http: HttpClient,
    private apiConfigService: ApiConfigService
  ) {
    // Check for existing token on service initialization
    this.checkExistingAuth();
  }

  /**
   * Request Google OAuth login URL from the backend
   * @param email User's email address
   * @param password Optional password for admin users
   * @returns Observable containing the Google OAuth URL
   */
  requestGoogleLogin(email: string, password?: string): Observable<GoogleLoginResponse> {
    return new Observable(observer => {
      this.apiConfigService.getApiUrl().then(apiUrl => {
        // Construct the auth endpoint URL
        const authUrl = apiUrl.replace('/api', '/api/auth/google/login');
        
        // Include password in request body if provided
        const requestBody: any = { email };
        if (password) {
          requestBody.password = password;
        }
        
        this.http.post<GoogleLoginResponse>(authUrl, requestBody).subscribe({
          next: (response) => observer.next(response),
          error: (error) => observer.error(error),
          complete: () => observer.complete()
        });
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Set authentication token and decode user info
   * @param token JWT token from backend
   */
  setAuthToken(token: string): void {
    try {
      console.log('AuthService: Setting auth token...');
      
      // Store token
      localStorage.setItem(this.TOKEN_KEY, token);
      console.log('AuthService: Token stored in localStorage');
      
      // Decode JWT token to get user info
      const userInfo = this.decodeJwtToken(token);
      if (userInfo) {
        localStorage.setItem(this.USER_INFO_KEY, JSON.stringify(userInfo));
        this.userInfoSubject.next(userInfo);
        this.isAuthenticatedSubject.next(true);
        console.log('AuthService: User authenticated successfully:', userInfo);
      } else {
        console.error('AuthService: Failed to decode user info from token');
        this.clearAuth();
      }
    } catch (error) {
      console.error('AuthService: Error setting auth token:', error);
      this.clearAuth();
    }
  }

  /**
   * Get current authentication token
   * @returns JWT token or null
   */
  getAuthToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Get current user info
   * @returns User info or null
   */
  getUserInfo(): UserInfo | null {
    const userInfoStr = localStorage.getItem(this.USER_INFO_KEY);
    if (userInfoStr) {
      try {
        return JSON.parse(userInfoStr);
      } catch (error) {
        console.error('Error parsing user info:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Check if user is currently authenticated
   * @returns boolean
   */
  isAuthenticated(): boolean {
    const token = this.getAuthToken();
    if (!token) {
      console.log('AuthService: No token found');
      return false;
    }

    // Check if token is expired
    try {
      const userInfo = this.decodeJwtToken(token);
      if (!userInfo) {
        console.log('AuthService: Token validation failed - no user info');
        return false;
      }

      // Token is valid
      console.log('AuthService: Token is valid');
      return true;
    } catch (error) {
      console.error('AuthService: Error validating token:', error);
      this.clearAuth();
      return false;
    }
  }

  /**
   * Clear authentication data
   */
  clearAuth(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_INFO_KEY);
    this.isAuthenticatedSubject.next(false);
    this.userInfoSubject.next(null);
  }

  /**
   * Logout user
   */
  logout(): void {
    this.clearAuth();
    // Redirect to login page
    window.location.href = '/login';
  }

  /**
   * Extract roles from JWT claims with backward compatibility
   */
  private extractRolesFromClaims(claims: any): string[] {
    const roles: string[] = [];
    
    // Check for standard role claims (ClaimTypes.Role) - both full and shortened versions
    const fullRoleClaimType = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
    const shortRoleClaimType = 'role';
    
    // Check full claim type first
    if (claims[fullRoleClaimType]) {
      const roleClaim = claims[fullRoleClaimType];
      if (Array.isArray(roleClaim)) {
        roles.push(...roleClaim);
      } else {
        roles.push(roleClaim);
      }
    }
    
    // Check shortened claim type (JWT library often shortens well-known claim types)
    if (roles.length === 0 && claims[shortRoleClaimType]) {
      const roleClaim = claims[shortRoleClaimType];
      if (Array.isArray(roleClaim)) {
        roles.push(...roleClaim);
      } else {
        roles.push(roleClaim);
      }
    }
    
    // Fallback: check for custom "roles" claim (backward compatibility)
    if (roles.length === 0 && claims.roles) {
      return claims.roles.split(',').map((role: string) => role.trim());
    }
    
    return roles;
  }

  /**
   * Check for existing authentication on service initialization
   */
  private checkExistingAuth(): void {
    const token = this.getAuthToken();
    if (token && this.isAuthenticated()) {
      const userInfo = this.getUserInfo();
      if (userInfo) {
        this.userInfoSubject.next(userInfo);
        this.isAuthenticatedSubject.next(true);
        console.log('Existing authentication found:', userInfo);
      }
    }
  }

  /**
   * Decode JWT token to extract user information
   * @param token JWT token
   * @returns User info or null
   */
  private decodeJwtToken(token: string): UserInfo | null {
    try {
      console.log('AuthService: Decoding JWT token...');
      
      // JWT tokens have 3 parts separated by dots
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT token format - expected 3 parts, got ' + parts.length);
      }

      // Decode the payload (second part)
      const payload = parts[1];
      // Convert base64url to base64
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed for base64 decoding
      const paddedPayload = base64 + '='.repeat((4 - base64.length % 4) % 4);
      const decodedPayload = atob(paddedPayload);
      const claims = JSON.parse(decodedPayload);

      console.log('AuthService: JWT claims:', claims);

      // Check if token is expired
      const currentTime = Math.floor(Date.now() / 1000);
      if (claims.exp && claims.exp < currentTime) {
        console.warn('AuthService: Token has expired. Current time:', currentTime, 'Token exp:', claims.exp);
        return null;
      }

      // Extract user info from claims
      const userInfo: UserInfo = {
        sub: claims.sub || '',
        email: claims.email || '',
        name: claims.name || '',
        roles: this.extractRolesFromClaims(claims),
        picture: claims.picture || '',
        tenant_domain: claims.tenant_domain || '',
        tenant_id: claims.tenant_id || '',
        user_id: claims.user_id || '',
      };

      console.log('AuthService: Extracted user info:', userInfo);
      return userInfo;
    } catch (error) {
      console.error('AuthService: Error decoding JWT token:', error);
      return null;
    }
  }
}
