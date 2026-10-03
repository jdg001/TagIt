import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';

export interface Tenant {
  tenantId: string;
  name: string;
  domain: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  userCount?: number;
}

export interface TenantCreateRequest {
  name: string;
  domain: string;
  isActive?: boolean;
}

export interface TenantUpdateRequest {
  name: string;
  domain: string;
  isActive: boolean;
}

export interface TenantSearchFilters {
  search?: string;
  isActive?: boolean;
  skip?: number;
  take?: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}

@Injectable({
  providedIn: 'root'
})
export class TenantManagementService {
  constructor(
    private http: HttpClient,
    private apiConfigService: ApiConfigService
  ) {}

  private getApiUrl(): Observable<string> {
    const apiUrl = this.apiConfigService.getCurrentApiUrl();
    if (!apiUrl) {
      return throwError(() => new Error('API URL not configured'));
    }
    return of(apiUrl);
  }

  private handleError = (error: any): Observable<never> => {
    console.error('TenantManagementService error:', error);
    return throwError(() => error);
  };

  /**
   * Search tenants with filters
   */
  searchTenants(filters: TenantSearchFilters): Observable<PagedResult<Tenant>> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        let params = new HttpParams();
        
        if (filters.search) params = params.set('search', filters.search);
        if (filters.isActive !== undefined) params = params.set('isActive', filters.isActive.toString());
        if (filters.skip !== undefined) params = params.set('skip', filters.skip.toString());
        if (filters.take !== undefined) params = params.set('take', filters.take.toString());

        return this.http.get<PagedResult<Tenant>>(`${apiUrl}/tenants`, { params }).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Get all tenants (basic endpoint)
   */
  getAllTenants(search?: string, isActive?: boolean, skip = 0, take = 50): Observable<PagedResult<Tenant>> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        let params = new HttpParams()
          .set('skip', skip.toString())
          .set('take', take.toString());
        
        if (search) params = params.set('search', search);
        if (isActive !== undefined) params = params.set('isActive', isActive.toString());

        return this.http.get<PagedResult<Tenant>>(`${apiUrl}/tenants`, { params }).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Get tenant by ID
   */
  getTenantById(tenantId: string): Observable<Tenant> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.get<Tenant>(`${apiUrl}/tenants/${tenantId}`).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Get tenant by domain
   */
  getTenantByDomain(domain: string): Observable<Tenant> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.get<Tenant>(`${apiUrl}/tenants/by-domain/${domain}`).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Create new tenant
   */
  createTenant(tenantData: TenantCreateRequest): Observable<Tenant> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.post<Tenant>(`${apiUrl}/tenants`, tenantData).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Update tenant
   */
  updateTenant(tenantId: string, tenantData: TenantUpdateRequest): Observable<Tenant> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.put<Tenant>(`${apiUrl}/tenants/${tenantId}`, tenantData).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Delete tenant
   */
  deleteTenant(tenantId: string): Observable<void> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.delete<void>(`${apiUrl}/tenants/${tenantId}`).pipe(
          catchError(this.handleError)
        );
      })
    );
  }
}
