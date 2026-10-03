import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'tagit-theme';
  private readonly DEFAULT_THEME = 'dark';
  
  private isDarkModeSubject = new BehaviorSubject<boolean>(true);
  public isDarkMode$ = this.isDarkModeSubject.asObservable();

  constructor() {
    this.initializeTheme();
  }

  /**
   * Initialize theme from localStorage
   */
  private initializeTheme(): void {
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    const isDarkMode = savedTheme === 'light' ? false : true;
    
    // If no theme is saved, set default and save it
    if (!savedTheme) {
      this.setTheme(this.DEFAULT_THEME);
      return;
    }
    
    this.isDarkModeSubject.next(isDarkMode);
    this.applyThemeToDocument(isDarkMode);
  }

  /**
   * Get current theme state
   */
  get isDarkMode(): boolean {
    return this.isDarkModeSubject.value;
  }

  /**
   * Toggle between dark and light mode
   */
  toggleTheme(): void {
    const newTheme = this.isDarkMode ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  /**
   * Set theme explicitly
   */
  setTheme(theme: 'dark' | 'light'): void {
    const isDarkMode = theme === 'dark';
    
    // Save to localStorage
    localStorage.setItem(this.THEME_KEY, theme);
    
    // Update subject
    this.isDarkModeSubject.next(isDarkMode);
    
    // Apply to document
    this.applyThemeToDocument(isDarkMode);
  }

  /**
   * Apply theme to document body
   */
  private applyThemeToDocument(isDarkMode: boolean): void {
    document.body.classList.toggle('dark-theme', isDarkMode);
  }

  /**
   * Get theme as string
   */
  getCurrentTheme(): 'dark' | 'light' {
    return this.isDarkMode ? 'dark' : 'light';
  }

  /**
   * Subscribe to theme changes
   */
  onThemeChange(): Observable<boolean> {
    return this.isDarkMode$;
  }

  /**
   * Initialize theme for a component (call this in ngOnInit)
   */
  initializeComponentTheme(): boolean {
    return this.isDarkMode;
  }
}
