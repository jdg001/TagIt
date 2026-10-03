import { HttpInterceptorFn } from '@angular/common/http';

const TOKEN_KEY = 'tagit_auth_token';

/**
 * AuthInterceptor - Automatically adds JWT token to HTTP requests
 * 
 * This interceptor:
 * 1. Checks for JWT token in localStorage under 'tagit_auth_token' key
 * 2. If token exists, adds 'Authorization: Bearer <token>' header to outgoing requests
 * 3. If no token, passes request through unchanged
 * 4. Works with all HTTP requests made through Angular HttpClient
 */
export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  // Check if a JWT token exists in localStorage
  const token = localStorage.getItem(TOKEN_KEY);
  
  if (token) {
    // Clone the request and add the Authorization header
    const clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    
    // Return the modified request
    return next(clonedRequest);
  }
  
  // If no token found, pass the request through without modification
  return next(req);
};
