import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';

export interface CreateDesignStateRequest {
  templateId: number;
  designerId: number;
  reviewerId?: number;
  state: string;
  versionNumber: number;
  comments?: string;
  stateChangedBy: number;
}

export interface UpdateDesignStateRequest {
  newState: string;
  comments?: string;
  reviewerId?: number;
  stateChangedBy: number;
}

export interface PublishTemplateRequest {
  stateChangedBy: number;
}

export interface DesignStateResponse {
  designStateId: number;
  message: string;
  templateId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class DesignStateService {
  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {}

  /**
   * Get the API base URL
   */
  private getApiUrl(): Observable<string> {
    return from(this.apiConfig.getApiUrl());
  }

  /**
   * Create a new design state (when designer saves)
   */
  createDesignState(request: CreateDesignStateRequest): Observable<DesignStateResponse> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/designstate`;
        return this.http.post<DesignStateResponse>(endpoint, request).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Update an existing design state
   */
  updateDesignState(designStateId: number, request: UpdateDesignStateRequest): Observable<DesignStateResponse> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/designstate/${designStateId}`;
        return this.http.put<DesignStateResponse>(endpoint, request).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Publish a template (when reviewer approves)
   */
  publishTemplate(designStateId: number, request: PublishTemplateRequest): Observable<DesignStateResponse> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/designstate/${designStateId}/publish`;
        return this.http.post<DesignStateResponse>(endpoint, request).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: any): Observable<never> => {
    console.error('DesignState API Error:', error);
    let errorMessage = 'An error occurred';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  };
}

