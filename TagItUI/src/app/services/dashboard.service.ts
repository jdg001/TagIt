import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, from, of } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';
import { AuthService, UserInfo } from './auth.service';

export interface User {
  userId: number;
  username: string;
  roles: string[];
}

export interface TemplateVersion {
  versionNumber: number;
  isPublished: boolean;
  publishedAt?: string;
  publishedBy?: string;
  designState: string;
  comments?: string;
  stateChangedAt: string;
  stateChangedBy: string;
}

export interface TemplateWithVersions {
  templateId: number;
  designStateId?: number;
  name: string;
  description?: string;
  paperWidth: number;
  paperHeight: number;
  unit: string;
  currentVersion: number;
  latestVersion: number;
  isPublished: boolean;
  publishedAt?: string;
  publishedBy?: string;
  designState: string;
  designerId: number;
  designerName: string;
  reviewerId?: number;
  reviewerName?: string;
  versions: TemplateVersion[];
  createdAt: string;
  updatedAt: string;
  hasConflicts: boolean;
  activeEditSessions: number;
}

export interface DashboardStats {
  totalTemplates: number;
  publishedTemplates: number;
  draftTemplates: number;
  underReviewTemplates: number;
  rejectedTemplates: number;
  totalUsers: number;
  activeUsers: number;
  conflictsResolved: number;
  pendingConflicts: number;
}

export interface ConcurrentEditWarning {
  templateId: number;
  templateName: string;
  activeUsers: string[];
  concurrentCount: number;
  warningMessage: string;
  allowEdit: boolean;
}

export interface TemplateConflict {
  conflictId: string;
  templateId: number;
  templateName: string;
  baseVersion: number;
  conflictingVersion1: number;
  conflictingVersion2: number;
  conflictType: string;
  status: string;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: number;
  resolvedByName?: string;
  resolution?: string;
}

export interface EditSession {
  sessionId: string;
  templateId: number;
  templateName: string;
  userId: number;
  userName: string;
  sessionStart: string;
  lastActivity: string;
  isActive: boolean;
  editVersion: number;
  baseVersion: number;
  hasUnsavedChanges: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 30000; // 30 seconds cache

  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService,
    private authService: AuthService
  ) {}

  private getApiUrl(): Observable<string> {
    return from(this.apiConfig.getApiUrl());
  }

  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  private setCachedData<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private clearCache(): void {
    this.cache.clear();
  }

  // ==========================================
  // Dashboard Data APIs
  // ==========================================

  /**
   * Get dashboard data based on user role
   */
  getDashboardData(userId: number, userRole: string, forceRefresh: boolean = false): Observable<{
    templates: TemplateWithVersions[];
    users?: User[];
    conflicts?: TemplateConflict[];
    activeSessions?: EditSession[];
  }> {
    const userRoles = this.getCurrentUserRoles();
    const cacheKey = `dashboard_${userRoles.join('_')}_${userId}`;
    
    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cachedData = this.getCachedData<any>(cacheKey);
      if (cachedData) {
        return of(cachedData);
      }
    }

    // Return simplified dashboard data without stats
    const mockData = {
      templates: [], // Templates will be loaded separately
      users: [],
      conflicts: [],
      activeSessions: []
    };

    // Cache the data
    this.setCachedData(cacheKey, mockData);
    return of(mockData);
  }


  /**
   * Get templates for specific library type
   */
  getTemplatesByLibrary(
    userId: number, 
    libraryType: 'public' | 'local' | 'my-submitted' | 'all-submissions' | 'assigned' | 'all'
  ): Observable<TemplateWithVersions[]> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        // Map new library types to backend endpoints
        let backendLibraryType: string = libraryType;
        if (libraryType === 'my-submitted') {
          backendLibraryType = 'submitted'; // Designer's own submissions
        }
        // 'all-submissions' and 'assigned' map directly to backend
        
        const endpoint = `${apiUrl}/dashboard/templates/library/${backendLibraryType}/${userId}`;
        return this.http.get<any[]>(endpoint).pipe(
          map(dashboardTemplates => {
            // Map DashboardTemplateDto to TemplateWithVersions
            return dashboardTemplates.map(dt => ({
              templateId: dt.templateId,
              designStateId: dt.designStateId,
              name: dt.name,
              description: dt.description,
              paperWidth: 0, // Not available in DashboardTemplateDto
              paperHeight: 0, // Not available in DashboardTemplateDto
              unit: 'in', // Default unit
              currentVersion: dt.versionNumber,
              latestVersion: dt.versionNumber,
              isPublished: dt.state === 'Published',
              publishedAt: dt.publishedAt,
              publishedBy: undefined,
              designState: dt.state,
              designerId: dt.designerId || 0, // Use actual designer ID from backend
              designerName: dt.designerName || '',
              reviewerId: dt.reviewerId,
              reviewerName: dt.reviewerName,
              versions: [], // Empty for now
              createdAt: dt.createdAt,
              updatedAt: dt.createdAt, // Use createdAt as fallback
              hasConflicts: false,
              activeEditSessions: 0
            } as TemplateWithVersions));
          }),
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Map designStateId to designState string
   */
  private mapDesignStateIdToString(designStateId?: number): string {
    if (!designStateId) return 'Draft';
    
    switch (designStateId) {
      case 1: return 'Draft';
      case 2: return 'UnderReview';
      case 3: return 'Approved';
      case 4: return 'Rejected';
      case 5: return 'Published';
      default: return 'Draft';
    }
  }

  /**
   * Get template with all versions
   */
  getTemplateWithVersions(templateId: number): Observable<TemplateWithVersions> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/designstate/templates/${templateId}/current`;
        return this.http.get<any>(endpoint).pipe(
          map(designState => ({
            templateId: templateId,
            designStateId: designState.designStateId,
            name: '', // Not available from design state endpoint
            description: '', // Not available from design state endpoint
            paperWidth: 0, // Not available from design state endpoint
            paperHeight: 0, // Not available from design state endpoint
            unit: 'in', // Default unit
            currentVersion: designState.versionNumber,
            latestVersion: designState.versionNumber,
            isPublished: designState.isPublished,
            publishedAt: designState.publishedAt,
            publishedBy: designState.publishedBy,
            designState: designState.state, // Use 'state' property from DesignStateDto
            designerId: designState.designerId,
            designerName: designState.designerName,
            reviewerId: designState.reviewerId,
            reviewerName: designState.reviewerName,
            versions: [], // Empty for now
            createdAt: designState.stateChangedAt,
            updatedAt: designState.stateChangedAt,
            hasConflicts: false,
            activeEditSessions: 0
          } as TemplateWithVersions)),
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Get users list (Admin only)
   */
  getUsers(): Observable<User[]> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/users`;
        return this.http.get<User[]>(endpoint).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  // ==========================================
  // Template Management APIs
  // ==========================================

  /**
   * Create new template
   */
  createTemplate(templateData: {
    name: string;
    description?: string;
    paperWidth: number;
    paperHeight: number;
    unit: string;
    designerId: number;
  }): Observable<TemplateWithVersions> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/templates`;
        return this.http.post<TemplateWithVersions>(endpoint, templateData).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Update template
   */
  updateTemplate(templateId: number, templateData: any): Observable<TemplateWithVersions> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/templates/${templateId}`;
        return this.http.put<TemplateWithVersions>(endpoint, templateData).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Delete template
   */
  deleteTemplate(templateId: number): Observable<boolean> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/templates/${templateId}`;
        return this.http.delete<boolean>(endpoint).pipe(
          catchError(this.handleError)
        );
      })
    );
  }


  /**
   * Submit template for review
   */
  submitForReview(templateId: number, userId: number, reviewerId?: number): Observable<TemplateWithVersions> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/templates/${templateId}/submit-review`;
        return this.http.post<TemplateWithVersions>(endpoint, { userId, reviewerId }).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Approve template
   */
  approveTemplate(templateId: number, userId: number, comments?: string): Observable<TemplateWithVersions> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/templates/${templateId}/approve`;
        return this.http.post<TemplateWithVersions>(endpoint, { userId, comments }).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Reject template
   */
  rejectTemplate(templateId: number, userId: number, comments: string): Observable<TemplateWithVersions> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/templates/${templateId}/reject`;
        return this.http.post<TemplateWithVersions>(endpoint, { userId, comments }).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Assign template to reviewer
   */
  assignTemplateToReviewer(templateId: number, reviewerId: number): Observable<TemplateWithVersions> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        // First get the design state ID for this template
        const currentStateUrl = `${apiUrl}/designstate/templates/${templateId}/current`;
        return this.http.get<any>(currentStateUrl).pipe(
          switchMap((response: any) => {
            if (response && response.designStateId) {
              // Now call the assign endpoint with the design state ID
              const assignUrl = `${apiUrl}/designstate/${response.designStateId}/assign`;
              const request = { 
                reviewerId: reviewerId,
                assignedBy: this.getCurrentUserId(), // Get current user ID
                comments: null
              };
              return this.http.post<TemplateWithVersions>(assignUrl, request).pipe(
                catchError(this.handleError)
              );
            } else {
              return throwError(() => new Error('No design state found for template'));
            }
          }),
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Remove template assignment (clear reviewer ID)
   */
  removeTemplateAssignment(templateId: number): Observable<TemplateWithVersions> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        // First get the design state ID for this template
        const currentStateUrl = `${apiUrl}/designstate/templates/${templateId}/current`;
        return this.http.get<any>(currentStateUrl).pipe(
          switchMap((response: any) => {
            if (response && response.designStateId) {
              // Now call the unassign endpoint with the design state ID
              const unassignUrl = `${apiUrl}/designstate/${response.designStateId}/unassign`;
              const request = { 
                unassignedBy: this.getCurrentUserId(), // Get current user ID
                comments: null
              };
              return this.http.post<TemplateWithVersions>(unassignUrl, request).pipe(
                catchError(this.handleError)
              );
            } else {
              return throwError(() => new Error('No design state found for template'));
            }
          }),
          catchError(this.handleError)
        );
      })
    );
  }

  // ==========================================
  // Conflict Resolution APIs
  // ==========================================

  /**
   * Check for concurrent edits
   */
  checkConcurrentEdit(templateId: number, userId: number): Observable<ConcurrentEditWarning> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/optimisticconflict/templates/${templateId}/concurrent-edit/${userId}`;
        return this.http.get<ConcurrentEditWarning>(endpoint).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Start edit session
   */
  startEditSession(templateId: number, userId: number, baseVersion: number): Observable<EditSession> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/optimisticconflict/sessions`;
        return this.http.post<EditSession>(endpoint, {
          templateId,
          userId,
          baseVersion
        }).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * End edit session
   */
  endEditSession(sessionId: string): Observable<boolean> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/optimisticconflict/sessions/${sessionId}`;
        return this.http.delete<boolean>(endpoint).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Get active conflicts
   */
  getActiveConflicts(templateId: number): Observable<TemplateConflict[]> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/optimisticconflict/templates/${templateId}/active-conflicts`;
        return this.http.get<TemplateConflict[]>(endpoint).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Resolve conflict
   */
  resolveConflict(conflictId: string, resolvedBy: number, resolution: string): Observable<TemplateConflict> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/optimisticconflict/conflicts/${conflictId}/resolve`;
        return this.http.post<TemplateConflict>(endpoint, {
          conflictId,
          resolvedBy,
          resolution
        }).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  // ==========================================
  // User Management APIs (Admin only)
  // ==========================================

  /**
   * Create user
   */
  createUser(userData: {
    firstName: string;
    lastName: string;
    email: string;
    roles: string[];
  }): Observable<User> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/users`;
        return this.http.post<User>(endpoint, userData).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Update user
   */
  updateUser(userId: number, userData: any): Observable<User> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/users/${userId}`;
        return this.http.put<User>(endpoint, userData).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Delete user
   */
  deleteUser(userId: number): Observable<boolean> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/users/${userId}`;
        return this.http.delete<boolean>(endpoint).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Assign role to user
   */
  assignUserRole(userId: number, roleId: number, assignedBy: number): Observable<boolean> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/users/${userId}/roles`;
        return this.http.post<boolean>(endpoint, {
          roleId,
          assignedBy
        }).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  /**
   * Get user roles from AuthService or fallback to localStorage
   */
  getCurrentUserRoles(): string[] {
    const userInfo = this.authService.getUserInfo();
    if (userInfo) {
      return userInfo.roles;
    }

    // Fallback to localStorage for backward compatibility
    const rolesJson = localStorage.getItem('userRoles');
    if (rolesJson) {
      try {
        return JSON.parse(rolesJson);
      } catch (e) {
        console.error('Error parsing user roles from localStorage:', e);
      }
    }
    // Fallback to single role for backward compatibility
    const singleRole = localStorage.getItem('userRole');
    return singleRole ? [singleRole] : ['Designer'];
  }

  // /**
  //  * Get primary user role (for backward compatibility)
  //  */
  // getCurrentUserRole(): string {
  //   const roles = this.getCurrentUserRoles();
  //   // Priority: Admin > Designer > Reviewer
  //   if (roles.includes('Admin')) return 'Admin';
  //   if (roles.includes('Designer')) return 'Designer';
  //   if (roles.includes('Reviewer')) return 'Reviewer';
  //   return roles[0] || 'Designer';
  // }

  /**
   * Get current user ID from AuthService or fallback to localStorage
   */
  getCurrentUserId(): number {
    const userInfo = this.authService.getUserInfo();

    return parseInt(userInfo?.user_id || '1');
  }

  /**
   * Check if current user has a specific role
   */
  hasRole(role: string): boolean {
    return this.getCurrentUserRoles().includes(role);
  }

  /**
   * Check if current user has any of the specified roles
   */
  hasAnyRole(roles: string[]): boolean {
    const userRoles = this.getCurrentUserRoles();
    return roles.some(role => userRoles.includes(role));
  }

  /**
   * Check if current user has all of the specified roles
   */
  hasAllRoles(roles: string[]): boolean {
    const userRoles = this.getCurrentUserRoles();
    return roles.every(role => userRoles.includes(role));
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: any): Observable<never> => {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 0:
          errorMessage = 'Unable to connect to the server. Please check if the backend is running.';
          break;
        case 400:
          errorMessage = `Bad Request: ${error.error?.message || 'Invalid data sent to server'}`;
          break;
        case 404:
          errorMessage = 'API endpoint not found.';
          break;
        case 500:
          errorMessage = `Server Error: ${error.error?.message || 'Internal server error'}`;
          break;
        default:
          errorMessage = `Error ${error.status}: ${error.error?.message || error.message}`;
      }
    }
    
    console.error('Dashboard API Error:', error);
    return throwError(() => new Error(errorMessage));
  };

  /**
   * Publish a template (when reviewer approves)
   */
  publishTemplate(templateId: number, userId: number): Observable<any> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        // apiUrl is already http://localhost:5222/api, so just append the endpoint
        const endpoint = `${apiUrl}/designstate/${templateId}/publish`;
        const request = { stateChangedBy: userId };
        return this.http.post(endpoint, request).pipe(
          catchError(this.handleError)
        );
      })
    );
  }
}
