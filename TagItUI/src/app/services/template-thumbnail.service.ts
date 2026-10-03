import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, BehaviorSubject, from } from 'rxjs';
import { map, catchError, tap, shareReplay, switchMap } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';

export interface ThumbnailCache {
  [templateId: number]: {
    data: string; // base64 encoded image
    timestamp: number;
    expiresAt: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class TemplateThumbnailService {
  private cache: ThumbnailCache = {};
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private readonly CACHE_KEY = 'tagit_thumbnail_cache';
  private loadingThumbnails = new Set<number>();

  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {
    this.loadCacheFromStorage();
  }

  /**
   * Get thumbnail URL for a template
   * Returns cached thumbnail if available, otherwise fetches from backend
   */
  getThumbnailUrl(templateId: number): Observable<string> {
    // Check cache first
    const cached = this.getCachedThumbnail(templateId);
    if (cached) {
      return of(cached);
    }

    // Check if already loading
    if (this.loadingThumbnails.has(templateId)) {
      return this.waitForThumbnail(templateId);
    }

    // Fetch from backend
    return this.fetchThumbnailFromBackend(templateId);
  }

  /**
   * Get thumbnail URL synchronously (returns cached only)
   */
  getCachedThumbnailUrl(templateId: number): string | null {
    return this.getCachedThumbnail(templateId);
  }

  /**
   * Check if thumbnail is cached
   */
  isThumbnailCached(templateId: number): boolean {
    const cached = this.cache[templateId];
    return cached && cached.expiresAt > Date.now();
  }

  /**
   * Preload thumbnails for multiple templates
   */
  preloadThumbnails(templateIds: number[]): Observable<{ [templateId: number]: string }> {
    const results: { [templateId: number]: string } = {};
    const uncachedIds: number[] = [];

    // Check cache for each template
    templateIds.forEach(id => {
      const cached = this.getCachedThumbnail(id);
      if (cached) {
        results[id] = cached;
      } else {
        uncachedIds.push(id);
      }
    });

    // If all are cached, return immediately
    if (uncachedIds.length === 0) {
      return of(results);
    }

    // Fetch uncached thumbnails
    const fetchObservables = uncachedIds.map(id => 
      this.fetchThumbnailFromBackend(id).pipe(
        map(thumbnailData => ({ id, thumbnailData }))
      )
    );

    return new Observable(observer => {
      let completed = 0;
      const total = fetchObservables.length;

      if (total === 0) {
        observer.next(results);
        observer.complete();
        return;
      }

      fetchObservables.forEach(obs => {
        obs.subscribe({
          next: ({ id, thumbnailData }) => {
            results[id] = thumbnailData;
            completed++;
            
            if (completed === total) {
              observer.next(results);
              observer.complete();
            }
          },
          error: (error) => {
            console.warn(`Failed to load thumbnail for template:`, error);
            completed++;
            
            if (completed === total) {
              observer.next(results);
              observer.complete();
            }
          }
        });
      });
    });
  }

  /**
   * Clear thumbnail cache
   */
  clearCache(): void {
    this.cache = {};
    this.saveCacheToStorage();
  }

  /**
   * Invalidate cache for a specific template
   */
  invalidateTemplateCache(templateId: number): void {
    if (this.cache[templateId]) {
      delete this.cache[templateId];
      this.saveCacheToStorage();
      console.log(`Thumbnail cache invalidated for template ${templateId}`);
    }
  }

  /**
   * Invalidate cache for multiple templates
   */
  invalidateTemplatesCache(templateIds: number[]): void {
    let invalidatedCount = 0;
    templateIds.forEach(templateId => {
      if (this.cache[templateId]) {
        delete this.cache[templateId];
        invalidatedCount++;
      }
    });
    
    if (invalidatedCount > 0) {
      this.saveCacheToStorage();
      console.log(`Thumbnail cache invalidated for ${invalidatedCount} templates`);
    }
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    Object.keys(this.cache).forEach(key => {
      const templateId = parseInt(key);
      if (this.cache[templateId].expiresAt <= now) {
        delete this.cache[templateId];
      }
    });
    this.saveCacheToStorage();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { total: number; expired: number; valid: number } {
    const now = Date.now();
    const total = Object.keys(this.cache).length;
    let expired = 0;
    let valid = 0;

    Object.values(this.cache).forEach(entry => {
      if (entry.expiresAt <= now) {
        expired++;
      } else {
        valid++;
      }
    });

    return { total, expired, valid };
  }

  private fetchThumbnailFromBackend(templateId: number): Observable<string> {
    this.loadingThumbnails.add(templateId);

    return from(this.apiConfig.getApiUrl()).pipe(
      map((apiUrl: string) => `${apiUrl}/templates/${templateId}/thumbnail`),
      switchMap((url: string) => 
        this.http.get(url, { 
          responseType: 'blob',
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
      ),
      map((blob: Blob) => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result as string;
            this.cacheThumbnail(templateId, base64);
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }),
      switchMap((promise: Promise<string>) => promise),
      tap(() => {
        this.loadingThumbnails.delete(templateId);
      }),
      catchError(error => {
        this.loadingThumbnails.delete(templateId);
        console.warn(`Failed to fetch thumbnail for template ${templateId}:`, error);
        return throwError(() => error);
      }),
      shareReplay(1)
    );
  }

  private waitForThumbnail(templateId: number): Observable<string> {
    return new Observable(observer => {
      const checkInterval = setInterval(() => {
        const cached = this.getCachedThumbnail(templateId);
        if (cached) {
          clearInterval(checkInterval);
          observer.next(cached);
          observer.complete();
        } else if (!this.loadingThumbnails.has(templateId)) {
          // Loading failed, try again
          clearInterval(checkInterval);
          this.fetchThumbnailFromBackend(templateId).subscribe({
            next: (thumbnailData) => observer.next(thumbnailData),
            error: (error) => observer.error(error),
            complete: () => observer.complete()
          });
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!observer.closed) {
          observer.error(new Error('Thumbnail loading timeout'));
        }
      }, 10000);
    });
  }

  private getCachedThumbnail(templateId: number): string | null {
    const cached = this.cache[templateId];
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    return null;
  }

  private cacheThumbnail(templateId: number, thumbnailData: string): void {
    this.cache[templateId] = {
      data: thumbnailData,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.CACHE_DURATION
    };
    this.saveCacheToStorage();
  }

  private loadCacheFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        this.cache = JSON.parse(stored);
        this.clearExpiredCache();
      }
    } catch (error) {
      console.warn('Failed to load thumbnail cache from storage:', error);
      this.cache = {};
    }
  }

  private saveCacheToStorage(): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.warn('Failed to save thumbnail cache to storage:', error);
    }
  }
}
