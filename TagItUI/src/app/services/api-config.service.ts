import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {
  private detectedApiUrl: string | null = null;
  private readonly testTimeout = 3000; // 3 seconds timeout for each test

  constructor(private http: HttpClient) {}

  /**
   * Get the API base URL, using manual configuration
   */
  async getApiUrl(): Promise<string> {
    // If production, use the configured URL
    if (environment.production && environment.apiUrl) {
      return environment.apiUrl + environment.apiEndpoint;
    }

    // If already detected, return cached result
    if (this.detectedApiUrl) {
      return this.detectedApiUrl;
    }

    // Manual configuration - use the known backend URL
    const manualUrl = 'http://localhost:5222' + environment.apiEndpoint;
    this.detectedApiUrl = manualUrl;
    return manualUrl;
  }

  /**
   * Try to detect which port the backend is running on
   */
  private async detectBackendUrl(): Promise<string | null> {
    
    const protocols = ['http', 'https'];
    const ports = environment.backendPorts;

    // Test URLs in order of priority (HTTP first for localhost, then port 5222 first)
    for (const port of ports) {
      for (const protocol of protocols) {
        const testUrl = `${protocol}://localhost:${port}${environment.apiEndpoint}`;
        
        try {
          const isWorking = await this.testUrl(testUrl).toPromise();
          if (isWorking) {
            return testUrl;
          }
        } catch (error: any) {
        }
      }
    }

    return null;
  }

  /**
   * Test if a specific URL is reachable
   */
  private testUrl(url: string): Observable<boolean> {
    return this.http.get(url, {
      observe: 'response',
      responseType: 'text'
    }).pipe(
      timeout(this.testTimeout),
      map(response => {
        // Consider it working if we get any response (even 404 is better than connection refused)
        return response.status < 500; // Accept any non-server-error response
      }),
      catchError(error => {
        return of(false);
      })
    );
  }

  /**
   * Manually set the API URL (for testing or manual configuration)
   */
  setApiUrl(url: string): void {
    this.detectedApiUrl = url.endsWith(environment.apiEndpoint) 
      ? url 
      : url + environment.apiEndpoint;
  }

  /**
   * Clear the cached URL and force re-detection
   */
  resetDetection(): void {
    this.detectedApiUrl = null;
  }

  /**
   * Get the currently detected or configured URL (synchronous)
   */
  getCurrentApiUrl(): string | null {
    return this.detectedApiUrl;
  }
}
