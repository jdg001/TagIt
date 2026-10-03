import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { LabelTemplateService } from './label-template.service';
import { CanvasElement } from './label-template.service';

export interface TemplateLoadResult {
  canvasElements: CanvasElement[];
  selectedPaperSize: string;
  paperWidth?: number;
  paperHeight?: number;
  paperUnit?: string;
  selectedDefaultSize?: string;
  paperLayoutLeft: number;
  paperLayoutTop: number;
  paperLayoutWidth: number;
  paperLayoutHeight: number;
  selectedTemplate: any;
}

export interface TemplateSearchState {
  savedTemplates: any[];
  filteredTemplates: any[];
  isLoadingTemplates: boolean;
  templateSearchQuery: string;
  showTemplateDropdown: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TemplateManagementService {

  private readonly HIDDEN_PREFIXES = ['pdf generation template', 'csv import template'];

  private templateStateSubject = new BehaviorSubject<TemplateSearchState>({
    savedTemplates: [],
    filteredTemplates: [],
    isLoadingTemplates: false,
    templateSearchQuery: '',
    showTemplateDropdown: false
  });

  public templateState$ = this.templateStateSubject.asObservable();

  constructor(private labelTemplateService: LabelTemplateService) {}

  /**
   * Get current template state
   */
  getCurrentState(): TemplateSearchState {
    return this.templateStateSubject.value;
  }

  /**
   * Update template state
   */
  private updateState(updates: Partial<TemplateSearchState>): void {
    const currentState = this.templateStateSubject.value;
    this.templateStateSubject.next({ ...currentState, ...updates });
  }

  private isVisibleTemplate = (name: string | undefined) => {
    const n = (name || '').trim().toLowerCase();
    return n.length > 0 && !this.HIDDEN_PREFIXES.some(p => n.startsWith(p));
  };

  /**
   * Load saved templates from the API
   */
  loadSavedTemplates(): Observable<any[]> {
    this.updateState({ isLoadingTemplates: true });

    return new Observable(observer => {
      this.labelTemplateService.getTemplates().subscribe({
        next: (templates) => {

          const visible = (templates || []).filter(t => this.isVisibleTemplate(t?.name));

          this.updateState({
            savedTemplates: visible,
            filteredTemplates: visible,
            isLoadingTemplates: false
          });
          observer.next(visible);
          observer.complete();
        },
        error: (error) => {
          this.updateState({ isLoadingTemplates: false });
          observer.error(error);
        }
      });
    });
  }

  /**
   * Filter templates based on search query
   */
  filterTemplates(searchQuery: string): void {
    const currentState = this.getCurrentState();
    
    let filteredTemplates: any[];
    
    if (!searchQuery.trim()) {
      filteredTemplates = currentState.savedTemplates;
    } else {
      const query = searchQuery.toLowerCase();
      filteredTemplates = currentState.savedTemplates
        .filter(template => template.name.toLowerCase().includes(query));
    }
    
    
    this.updateState({
      templateSearchQuery: searchQuery,
      filteredTemplates: filteredTemplates
    });
  }

  /**
   * Toggle template dropdown visibility
   */
  toggleTemplateDropdown(): void {
    const currentState = this.getCurrentState();
    const newShowState = !currentState.showTemplateDropdown;
    
    this.updateState({ showTemplateDropdown: newShowState });
    
    if (newShowState) {
      // Always reload templates when opening dropdown to ensure fresh data
      this.loadSavedTemplates().subscribe({
        next: () => {
        },
        error: (error) => {
        }
      });
    }
  }

  /**
   * Close template dropdown
   */
  closeTemplateDropdown(): void {
    this.updateState({ 
      showTemplateDropdown: false,
      templateSearchQuery: '',
      filteredTemplates: this.getCurrentState().savedTemplates
    });
  }

  /**
   * Load a specific template and return the result
   */
  loadTemplate(templateId: number): Observable<TemplateLoadResult> {
    return new Observable(observer => {
      
      this.labelTemplateService.loadTemplateForCanvas(templateId).subscribe({
        next: (result) => {
          
          if (result.canvasData) {
            
            if (result.canvasData.elements && result.canvasData.elements.length > 0) {
            }
            
            const loadResult: TemplateLoadResult = {
              canvasElements: result.canvasData.elements || [], // Always set elements first
              selectedPaperSize: result.canvasData.paperSize || 'A4',
              paperWidth: result.canvasData.paperWidth,
              paperHeight: result.canvasData.paperHeight,
              paperUnit: result.canvasData.paperUnit,
              selectedDefaultSize: result.canvasData.selectedDefaultSize,
              paperLayoutLeft: result.canvasData.paperLayoutLeft || 0,
              paperLayoutTop: result.canvasData.paperLayoutTop || 0,
              paperLayoutWidth: result.canvasData.paperLayoutWidth || 0,
              paperLayoutHeight: result.canvasData.paperLayoutHeight || 0,
              selectedTemplate: result.template
            };

            
            observer.next(loadResult);
            observer.complete();
          } else {
            observer.error(new Error('No canvas data found in template'));
          }
        },
        error: (error) => {
          observer.error(error);
        }
      });
    });
  }

  /**
   * Select a template (combines selection and loading)
   */
  selectTemplate(template: any): Observable<TemplateLoadResult> {
    
    // Close dropdown and clear search
    this.closeTemplateDropdown();
    
    // Load the template
    return this.loadTemplate(template.templateId);
  }

  /**
   * Clear selected template state
   */
  clearSelectedTemplate(): void {
    // This method is kept for compatibility but doesn't need to update state
    // as the selected template is managed by the component
  }

  /**
   * Refresh templates list (useful after save/delete operations)
   */
  refreshTemplates(): Observable<any[]> {
    return this.loadSavedTemplates();
  }
}
