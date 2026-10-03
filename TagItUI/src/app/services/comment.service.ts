import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, from } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';

// Comment interfaces matching backend DTOs
export interface Comment {
  commentId: number;
  designStateId: number;
  commentText: string;
  positionX: number;  // Paper-relative X coordinate
  positionY: number;  // Paper-relative Y coordinate
  // [NEW] Paper layout context
  paperLayoutLeft: number;
  paperLayoutTop: number;
  paperLayoutWidth: number;
  paperLayoutHeight: number;
  createdBy: number;
  createdByName: string;
  createdAt: Date;
  updatedAt?: Date;
  updatedBy?: number;
  updatedByName?: string;
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: number;
  resolvedByName?: string;
  responseText?: string; // Designer's optional response
}

export interface CreateCommentRequest {
  designStateId: number;
  commentText: string;
  positionX: number;  // Paper-relative X coordinate
  positionY: number;  // Paper-relative Y coordinate
  // [NEW] Paper layout context
  paperLayoutLeft: number;
  paperLayoutTop: number;
  paperLayoutWidth: number;
  paperLayoutHeight: number;
  createdBy: number;
}

export interface UpdateCommentRequest {
  commentId: number;
  commentText: string;
  positionX: number;  // Paper-relative X coordinate
  positionY: number;  // Paper-relative Y coordinate
  // [NEW] Paper layout context
  paperLayoutLeft: number;
  paperLayoutTop: number;
  paperLayoutWidth: number;
  paperLayoutHeight: number;
  updatedBy: number;
}

export interface ResolveCommentRequest {
  commentId: number;
  resolvedBy: number;
  responseText?: string; // Optional designer response
}

export interface DeleteCommentRequest {
  commentId: number;
}

export interface CommentData {
  commentText: string;
  positionX: number;  // Paper-relative X coordinate
  positionY: number;  // Paper-relative Y coordinate
}

export interface BulkCreateCommentsRequest {
  designStateId: number;
  createdBy: number;
  // [NEW] Paper layout context for all comments in this bulk request
  paperLayoutLeft: number;
  paperLayoutTop: number;
  paperLayoutWidth: number;
  paperLayoutHeight: number;
  comments: CommentData[];
}

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {}

  /**
   * Get the dynamic API URL
   */
  private getApiUrl(): Observable<string> {
    return from(this.apiConfig.getApiUrl());
  }

  /**
   * Get all comments for a design state
   */
  getCommentsByDesignStateId(designStateId: number): Observable<Comment[]> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/comment/designstate/${designStateId}`;
        return this.http.get<Comment[]>(endpoint).pipe(
          map(comments => comments.map(comment => ({
            ...comment,
            createdAt: new Date(comment.createdAt),
            updatedAt: comment.updatedAt ? new Date(comment.updatedAt) : undefined,
            resolvedAt: comment.resolvedAt ? new Date(comment.resolvedAt) : undefined
          }))),
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Get a specific comment by ID
   */
  getCommentById(commentId: number): Observable<Comment> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/comment/${commentId}`;
        return this.http.get<Comment>(endpoint).pipe(
          map(comment => ({
            ...comment,
            createdAt: new Date(comment.createdAt),
            updatedAt: comment.updatedAt ? new Date(comment.updatedAt) : undefined,
            resolvedAt: comment.resolvedAt ? new Date(comment.resolvedAt) : undefined
          })),
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Create a new comment
   */
  createComment(request: CreateCommentRequest): Observable<Comment> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/comment`;
        return this.http.post<Comment>(endpoint, request).pipe(
          map(comment => ({
            ...comment,
            createdAt: new Date(comment.createdAt),
            updatedAt: comment.updatedAt ? new Date(comment.updatedAt) : undefined,
            resolvedAt: comment.resolvedAt ? new Date(comment.resolvedAt) : undefined
          })),
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Update an existing comment
   */
  updateComment(commentId: number, request: UpdateCommentRequest): Observable<Comment> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/comment/${commentId}`;
        return this.http.put<Comment>(endpoint, request).pipe(
          map(comment => ({
            ...comment,
            createdAt: new Date(comment.createdAt),
            updatedAt: comment.updatedAt ? new Date(comment.updatedAt) : undefined,
            resolvedAt: comment.resolvedAt ? new Date(comment.resolvedAt) : undefined
          })),
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Delete a comment (hard delete)
   */
  deleteComment(commentId: number, request: DeleteCommentRequest): Observable<void> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/comment/${commentId}`;
        return this.http.delete<void>(endpoint).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Resolve a comment (designer response)
   */
  resolveComment(commentId: number, request: ResolveCommentRequest): Observable<void> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/comment/${commentId}/resolve`;
        return this.http.put<void>(endpoint, request).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Bulk create comments (for rejection workflow)
   */
  bulkCreateComments(request: BulkCreateCommentsRequest): Observable<Comment[]> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/comment/bulk`;
        return this.http.post<Comment[]>(endpoint, request).pipe(
          map(comments => comments.map(comment => ({
            ...comment,
            createdAt: new Date(comment.createdAt),
            updatedAt: comment.updatedAt ? new Date(comment.updatedAt) : undefined,
            resolvedAt: comment.resolvedAt ? new Date(comment.resolvedAt) : undefined
          }))),
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Check if design state has unresolved comments
   */
  hasUnresolvedComments(designStateId: number): Observable<boolean> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/comment/designstate/${designStateId}/unresolved`;
        return this.http.get<boolean>(endpoint).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Get count of unresolved comments for a design state
   */
  getUnresolvedCommentCount(designStateId: number): Observable<number> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const endpoint = `${apiUrl}/comment/designstate/${designStateId}/unresolved/count`;
        return this.http.get<number>(endpoint).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.status === 401) {
        errorMessage = 'Unauthorized access';
      } else if (error.status === 403) {
        errorMessage = 'Forbidden - insufficient permissions';
      } else if (error.status === 404) {
        errorMessage = 'Resource not found';
      } else if (error.status === 500) {
        errorMessage = 'Internal server error';
      } else {
        errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      }
    }
    
    console.error('CommentService Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
