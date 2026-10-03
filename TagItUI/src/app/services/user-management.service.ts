import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';

export interface User {
  userId: number;
  email: string;
  tenantId: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface UserCreateRequest {
  tenantId: string; // String GUID format that backend will convert
  email: string;
  roleIds: number[];
}

export interface UserUpdateRequest {
  email: string;
  isActive: boolean;
  roleIds: number[];
}

export interface UserSearchFilters {
  search?: string;
  roles?: string[];
  isActive?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  skip?: number;
  take?: number;
  tenantId?: string;
}

export interface PagedResult<T> {
  items: T[];
  skip: number;
  take: number;
  total: number;
}

export interface Role {
  roleId: number;
  roleName: string;
  roleDescription?: string;
  isActive: boolean;
}

export interface AssignMultipleRolesRequest {
  roleIds: number[];
  expiresAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {}

  private getApiUrl(): Observable<string> {
    return from(this.apiConfig.getApiUrl());
  }

  private handleError = (error: any): Observable<never> => {
    console.error('UserManagementService error:', error);
    return throwError(() => error);
  };

  // ==========================================
  // User Management APIs
  // ==========================================

  /**
   * Search users with filters
   */
  searchUsers(filters: UserSearchFilters): Observable<PagedResult<User>> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        let params = new HttpParams();
        
        if (filters.search) params = params.set('search', filters.search);
        if (filters.roles?.length) params = params.set('roles', filters.roles.join(','));
        if (filters.isActive !== undefined) params = params.set('isActive', filters.isActive.toString());
        if (filters.createdAfter) params = params.set('createdAfter', filters.createdAfter.toISOString());
        if (filters.createdBefore) params = params.set('createdBefore', filters.createdBefore.toISOString());
        if (filters.skip !== undefined) params = params.set('skip', filters.skip.toString());
        if (filters.take !== undefined) params = params.set('take', filters.take.toString());
        if (filters.tenantId) params = params.set('tenantId', filters.tenantId);

        return this.http.get<PagedResult<User>>(`${apiUrl}/users/search`, { params }).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Get all users (basic endpoint)
   */
  getAllUsers(tenantId?: string, search?: string, isActive?: boolean, skip = 0, take = 50): Observable<PagedResult<User>> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        let params = new HttpParams()
          .set('skip', skip.toString())
          .set('take', take.toString());
        
        if (tenantId) params = params.set('tenantId', tenantId);
        if (search) params = params.set('search', search);
        if (isActive !== undefined) params = params.set('isActive', isActive.toString());

        return this.http.get<PagedResult<User>>(`${apiUrl}/users`, { params }).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Get user by ID
   */
  getUserById(userId: number): Observable<User> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.get<User>(`${apiUrl}/users/${userId}`).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Create new user
   */
  createUser(userData: UserCreateRequest): Observable<User> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.post<User>(`${apiUrl}/users`, userData).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Update user
   */
  updateUser(userId: number, userData: UserUpdateRequest): Observable<User> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.put<User>(`${apiUrl}/users/${userId}`, userData).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Delete user
   */
  deleteUser(userId: number): Observable<void> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.delete<void>(`${apiUrl}/users/${userId}`).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Activate user
   */
  activateUser(userId: number): Observable<void> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.post<void>(`${apiUrl}/users/${userId}:activate`, {}).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Deactivate user
   */
  deactivateUser(userId: number): Observable<void> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.post<void>(`${apiUrl}/users/${userId}:deactivate`, {}).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  // ==========================================
  // Role Management APIs
  // ==========================================

  /**
   * Get all available roles
   */
  getAllRoles(): Observable<Role[]> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.get<Role[]>(`${apiUrl}/role`).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Assign multiple roles to user
   */
  assignMultipleRoles(userId: number, request: AssignMultipleRolesRequest): Observable<void> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.post<void>(`${apiUrl}/users/${userId}/roles/bulk`, request).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Remove role from user
   */
  removeUserRole(userId: number, roleId: number): Observable<void> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.delete<void>(`${apiUrl}/users/${userId}/roles/${roleId}`).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Get user roles
   */
  getUserRoles(userId: number): Observable<Role[]> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.get<Role[]>(`${apiUrl}/roles/users/${userId}`).pipe(
          catchError(this.handleError)
        );
      })
    );
  }
}
