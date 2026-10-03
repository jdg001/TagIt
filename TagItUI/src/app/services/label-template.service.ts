import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';
import { PdfGenerationService } from './pdf-generation.service';

export interface LabelSize {
  name: string;
  width: number;
  height: number;
  unit: 'inch' | 'cm';
}

export interface LabelTemplate {
  templateId?: number;
  tenantId?: string;
  name: string;
  description?: string;
  paperWidth: number;
  paperHeight: number;
  unit: string;
  jsonSchema: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CanvasElement {
  id: string;
  type: 'text' | 'textarea' | 'rectangle' | 'barcode' | 'qr' | 'line' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  unit?: string; // Unit for coordinates (px, inch, mm, etc.)
  content?: string;
  fontSize?: number;
  fontFamily?: string; // Font family for text elements
  color?: string;
  fontWeight?: string;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  isPlaceholder?: boolean;
  placeholderType?: string;
  isTemplateComponent?: boolean;
  templateComponentType?: string;
  // Barcode-specific properties
  barcodeType?: 'code128' | 'ean13' | 'upc';
  // QR code-specific properties
  qrType?: 'url' | 'text' | 'email' | 'phone' | 'sms' | 'wifi';
  // Line-specific properties
  lineLength?: number; // Length of the line in pixels
  lineAngle?: number; // Rotation angle in degrees (0 = horizontal, 90 = vertical)
  lineColor?: string; // Color of the line
  lineWidth?: number; // Thickness of the line
  // Image-specific properties
  imageSrc?: string; // Base64 data URL or image source
  imageName?: string; // Original filename
  imageWidth?: number; // Original image width
  imageHeight?: number; // Original image height
  // Textarea-specific properties
  rows?: number; // Number of rows for textarea
  cols?: number; // Number of columns for textarea
  placeholder?: string; // Placeholder text for textarea
}

@Injectable({
  providedIn: 'root'
})
export class LabelTemplateService {
  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService,
    private pdfService: PdfGenerationService
  ) {}

  // Available API endpoints:
  // POST /api/templates - Create new template
  // GET /api/templates - List all templates  
  // GET /api/templates/{id} - Get template by ID

  /**
   * Get the dynamic API URL
   */
  private getApiUrl(): Observable<string> {
    return from(this.apiConfig.getApiUrl());
  }


  /**
   * Save a label template to the backend
   * Calls: POST /api/templates
   * Backend sets CreatedAt automatically
   */
  saveTemplate(templateData: {
    name?: string;
    description?: string;
    paperSize: string;
    paperWidth?: number;
    paperHeight?: number;
    paperUnit?: string;
    selectedDefaultSize?: string;
    canvasElements: CanvasElement[];
    paperLayoutLeft?: number;
    paperLayoutTop?: number;
    paperLayoutWidth?: number;
    paperLayoutHeight?: number;
  }): Observable<LabelTemplate> {
    // Use actual paper dimensions if provided, otherwise fall back to paper size lookup
    let paperWidth: number, paperHeight: number, paperUnit: string;
    
    if (templateData.paperWidth && templateData.paperHeight && templateData.paperUnit) {
      paperWidth = templateData.paperWidth;
      paperHeight = templateData.paperHeight;
      paperUnit = templateData.paperUnit;
    } else {
      const paperDimensions = this.getPaperDimensions(templateData.paperSize);
      paperWidth = paperDimensions.width;
      paperHeight = paperDimensions.height;
      paperUnit = paperDimensions.unit;
    }
    
    const labelTemplate: LabelTemplate = {
      name: templateData.name || `Label Template - ${new Date().toLocaleString()}`,
      description: templateData.description || 'Label template created with tagIT designer',
      paperWidth: paperWidth,
      paperHeight: paperHeight,
      unit: paperUnit,
      jsonSchema: this.pdfService.createJsonSchema(
        templateData.canvasElements,
        paperWidth,
        paperHeight,
        paperUnit,
        templateData.paperLayoutLeft || 0,
        templateData.paperLayoutTop || 0,
        templateData.paperLayoutWidth || paperWidth * 72, // Default to paper width in pixels
        templateData.paperLayoutHeight || paperHeight * 72 // Default to paper height in pixels
      )
      // CreatedAt will be set by the backend
    };

    return this.getApiUrl().pipe(
      switchMap(apiUrl => 
        this.http.post<LabelTemplate>(`${apiUrl}/templates`, labelTemplate).pipe(
          catchError(this.handleError)
        )
      )
    );
  }

  /**
   * Get all label templates
   * Calls: GET /api/templates
   */
  getTemplates(): Observable<LabelTemplate[]> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        return this.http.get<LabelTemplate[]>(`${apiUrl}/templates`).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Get a specific label template by ID
   * Calls: GET /api/templates/{id}
   */
  getTemplate(id: number): Observable<LabelTemplate> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl =>
        this.http.get<LabelTemplate>(`${apiUrl}/templates/${id}`).pipe(
          catchError(this.handleError)
        )
      )
    );
  }

  /**
   * Check if a template name already exists
   * Returns true if name exists, false otherwise
   */
  checkDuplicateName(name: string, excludeId?: number): Observable<boolean> {
    return this.getTemplates().pipe(
      map(templates => {
        const trimmedName = name.trim().toLowerCase();
        return templates.some(template => 
          template.name.toLowerCase() === trimmedName && 
          template.templateId !== excludeId
        );
      }),
      catchError(error => {
        // If we can't check, assume it's not a duplicate to avoid blocking saves
        return [false];
      })
    );
  }


  /**
   * Get paper dimensions based on paper size
   */
  private getPaperDimensions(paperSize: string): { width: number; height: number; unit: string } {
    switch (paperSize) {
      case 'A4':
        return { width: 8.27, height: 11.69, unit: 'inch' };
      case 'A3':
        return { width: 11.69, height: 16.54, unit: 'inch' };
      case 'Letter':
        return { width: 8.5, height: 11, unit: 'inch' };
      case 'Legal':
        return { width: 8.5, height: 14, unit: 'inch' };
      case 'Custom':
        return { width: 8.5, height: 11, unit: 'inch' }; // Default for custom
      default:
        return { width: 8.27, height: 11.69, unit: 'inch' };
    }
  }

  /**
   * Parse JSON schema back to canvas elements
   */
  parseTemplateData(jsonSchema: string): {
    elements: CanvasElement[];
    canvasWidth: number;
    canvasHeight: number;
    paperSize: string;
    paperWidth?: number;
    paperHeight?: number;
    paperUnit?: string;
    selectedDefaultSize?: string;
    created: string;
    paperLayoutLeft?: number;
    paperLayoutTop?: number;
    paperLayoutWidth?: number;
    paperLayoutHeight?: number;
  } | null {
    try {
      const data = JSON.parse(jsonSchema);
      
        // If the schema has originalElements and paperLayout, use those for restoration
        if (data.originalElements && data.paperLayout) {
          // Ensure all originalElements have the correct unit property set to 'px'
          const elementsWithUnit = data.originalElements.map((element: any) => ({
            ...element,
            unit: 'px' // Ensure all canvas elements have unit set to pixels
          }));
          
          // Determine paper layout name from dimensions if not provided
          const paperLayoutName = data.selectedDefaultSize || 
            this.determinePaperLayoutName(data.paper?.width, data.paper?.height, data.paper.unit);

          return {
            elements: elementsWithUnit,
          canvasWidth: data.canvasWidth || 800,
          canvasHeight: data.canvasHeight || 600,
          paperSize: paperLayoutName,
          paperWidth: data.paperWidth,
          paperHeight: data.paperHeight,
          paperUnit: data.paperUnit,
          selectedDefaultSize: paperLayoutName,
          created: data.created || new Date().toISOString(),
          paperLayoutLeft: data.paperLayout.left,
          paperLayoutTop: data.paperLayout.top,
          paperLayoutWidth: data.paperLayout.width,
          paperLayoutHeight: data.paperLayout.height
        };
      }
      
      // Convert backend format to frontend format
      if (data.elements && Array.isArray(data.elements)) {
        
        // First pass: analyze all elements to determine if coordinate adjustment is needed
        const paperWidth = data.paper?.width || 6;
        const paperHeight = data.paper?.height || 6;
        const paperUnit = data.elements[0]?.unit || 'inch';
        
        // Convert paper dimensions to pixels for validation
        const paperWidthPx = paperUnit === 'inch' ? paperWidth * 96 : paperWidth;
        const paperHeightPx = paperUnit === 'inch' ? paperHeight * 96 : paperHeight;
        
        // Find the maximum extent of all elements
        let maxElementX = 0;
        let maxElementY = 0;
        let needsCoordinateAdjustment = false;
        
        data.elements.forEach((backendElement: any) => {
          const elementX = backendElement.x || 0;
          const elementY = backendElement.y || 0;
          const elementWidth = backendElement.w || 100;
          const elementHeight = backendElement.h || 30;
          
          maxElementX = Math.max(maxElementX, elementX + elementWidth);
          maxElementY = Math.max(maxElementY, elementY + elementHeight);
          
          // Check if any element is outside paper bounds
          if (elementX > paperWidthPx || elementY > paperHeightPx || 
              (elementX + elementWidth) > paperWidthPx || 
              (elementY + elementHeight) > paperHeightPx) {
            needsCoordinateAdjustment = true;
          }
        });
        
        // Determine original paper size if adjustment is needed
        let assumedOriginalWidth = paperWidthPx;
        let assumedOriginalHeight = paperHeightPx;
        
        if (needsCoordinateAdjustment && (maxElementX > paperWidthPx * 2 || maxElementY > paperHeightPx * 2)) {
          // Assume elements were positioned for a paper size that can contain all elements
          // Add some padding (10%) to account for margins
          assumedOriginalWidth = Math.max(576, Math.ceil(maxElementX * 1.1)); // At least 6x6 inches
          assumedOriginalHeight = Math.max(576, Math.ceil(maxElementY * 1.1));
        }
        
        const frontendElements: CanvasElement[] = data.elements.map((backendElement: any, index: number) => {
          let adjustedX = backendElement.x || 0;
          let adjustedY = backendElement.y || 0;
          let adjustedWidth = backendElement.w || 100;
          let adjustedHeight = backendElement.h || 30;
          
          // Apply coordinate adjustment if needed
          if (needsCoordinateAdjustment && (adjustedX > paperWidthPx * 2 || adjustedY > paperHeightPx * 2)) {
            // Scale both position and size proportionally
            adjustedX = (adjustedX / assumedOriginalWidth) * paperWidthPx;
            adjustedY = (adjustedY / assumedOriginalHeight) * paperHeightPx;
            adjustedWidth = (adjustedWidth / assumedOriginalWidth) * paperWidthPx;
            adjustedHeight = (adjustedHeight / assumedOriginalHeight) * paperHeightPx;
          }
          
          const frontendElement: CanvasElement = {
            id: backendElement.id || this.generateId(),
            type: backendElement.type,
            x: adjustedX,
            y: adjustedY,
            width: adjustedWidth,
            height: adjustedHeight,
            unit: backendElement.unit || 'px'
          };

          // Convert type-specific properties
          if (backendElement.type === 'text') {
            frontendElement.content = backendElement.value || '';
            if (backendElement.style) {
              frontendElement.fontSize = backendElement.style.fontSize || 12;
              frontendElement.fontFamily = backendElement.style.fontFamily || 'Arial';
              frontendElement.fontWeight = backendElement.style.bold ? 'bold' : 'normal';
              frontendElement.color = backendElement.style.color || '#000000';
            }
          } else if (backendElement.type === 'barcode') {
            frontendElement.content = backendElement.data || '';
            frontendElement.barcodeType = (backendElement.format || 'code128').toLowerCase();
            frontendElement.color = '#3b82f6'; // Default barcode color
          } else if (backendElement.type === 'rectangle') {
            frontendElement.borderWidth = backendElement.borderThickness || 1;
            frontendElement.borderColor = backendElement.color || '#000000';
            frontendElement.fillColor = backendElement.fillColor || '#ffffff';
          } else if (backendElement.type === 'image') {
            frontendElement.imageSrc = backendElement.src || '';
            frontendElement.imageName = backendElement.name || 'Image';
            frontendElement.imageWidth = backendElement.imageWidth || 150;
            frontendElement.imageHeight = backendElement.imageHeight || 150;
          }

          return frontendElement;
        });
        
        // Determine paper layout name from dimensions if not provided
        const paperLayoutName = data.selectedDefaultSize || 
          this.determinePaperLayoutName(data.paper?.width, data.paper?.height, data.paper?.unit);

        return {
          elements: frontendElements,
          canvasWidth: data.canvasWidth || 800,
          canvasHeight: data.canvasHeight || 600,
          paperSize: data.paperSize || 'A4',
          paperWidth: data.paper?.width,
          paperHeight: data.paper?.height,
          paperUnit: data.paper?.unit,
          selectedDefaultSize: paperLayoutName,
          created: data.created || new Date().toISOString(),
          paperLayoutLeft: data.paperLayoutLeft,
          paperLayoutTop: data.paperLayoutTop,
          paperLayoutWidth: data.paperLayoutWidth,
          paperLayoutHeight: data.paperLayoutHeight
        };
      }
      
      // Fallback to original structure for backward compatibility
      return data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a unique ID for elements
   */
  private generateId(): string {
    return 'element_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Determine paper layout name from paper dimensions
   */
  private determinePaperLayoutName(paperWidth: number, paperHeight: number, paperUnit: string): string {
    // Standard paper sizes
    const standardPaperSizes = [
      { name: 'A4', width: 8.27, height: 11.69, unit: 'inch' },
      { name: 'Letter', width: 8.5, height: 11, unit: 'inch' },
      { name: 'Legal', width: 8.5, height: 14, unit: 'inch' },
      { name: 'A3', width: 11.69, height: 16.54, unit: 'inch' },
      { name: 'A5', width: 5.83, height: 8.27, unit: 'inch' }
    ];

    // Label sizes
    const labelSizes = [
      { name: 'Shipping Label (4 x 6 in)', width: 4, height: 6, unit: 'inch' },
      { name: 'Shipping Label (4 x 8 in)', width: 4, height: 8, unit: 'inch' },
      { name: 'Box Label (3 x 5 in)', width: 3, height: 5, unit: 'inch' },
      { name: 'Box Label (2 x 4 in)', width: 2, height: 4, unit: 'inch' },
      { name: 'Pallet Label (6 x 6 in)', width: 6, height: 6, unit: 'inch' },
      { name: 'Pallet Label (6 x 4 in)', width: 6, height: 4, unit: 'inch' },
      { name: 'Inventory Label (1 x 3 in)', width: 1, height: 3, unit: 'inch' },
      { name: 'Inventory Label (1.5 x 1 in)', width: 1.5, height: 1, unit: 'inch' },
      { name: 'Address Label (1 x 2.625 in)', width: 1, height: 2.625, unit: 'inch' }
    ];

    // Check standard paper sizes first
    const matchingStandardSize = standardPaperSizes.find(ps => 
      Math.abs(ps.width - paperWidth) < 0.05 && 
      Math.abs(ps.height - paperHeight) < 0.05 && 
      ps.unit === paperUnit
    );

    if (matchingStandardSize) {
      return matchingStandardSize.name;
    }

    // Check label sizes
    const matchingLabelSize = labelSizes.find(ls => 
      Math.abs(ls.width - paperWidth) < 0.05 && 
      Math.abs(ls.height - paperHeight) < 0.05 && 
      ls.unit === paperUnit
    );

    if (matchingLabelSize) {
      return matchingLabelSize.name;
    }

    // If no match found, return 'custom'
    return 'custom';
  }

  /**
   * Load a template and return its canvas data
   * Combines getTemplate() and parseTemplateData() for convenience
   */
  loadTemplateForCanvas(id: number): Observable<{
    template: LabelTemplate;
    canvasData: {
      elements: CanvasElement[];
      canvasWidth: number;
      canvasHeight: number;
      paperSize: string;
      paperWidth?: number;
      paperHeight?: number;
      paperUnit?: string;
      selectedDefaultSize?: string;
      paperLayoutLeft?: number;
      paperLayoutTop?: number;
      paperLayoutWidth?: number;
      paperLayoutHeight?: number;
      created: string;
    } | null;
  }> {
    return this.getTemplate(id).pipe(
      map(template => {
        const parsedData = this.parseTemplateData(template.jsonSchema);
        
        if (parsedData) {
          // Override paper dimensions with the actual template dimensions if available
          if (template.paperWidth && template.paperHeight && template.unit) {
            parsedData.paperWidth = template.paperWidth;
            parsedData.paperHeight = template.paperHeight;
            parsedData.paperUnit = template.unit;
            // Preserve the selectedDefaultSize from parsed data, don't override it
          }
        }
        
        return {
          template,
          canvasData: parsedData
        };
      })
    );
  }



  /**
   * Update a template by ID
   */
  updateTemplate(id: number, templateData: any): Observable<any> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const url = `${apiUrl}/templates/${id}`;
        
        return this.http.put(url, templateData).pipe(
          catchError(this.handleError)
        );
      })
    );
  }

  /**
   * Delete a template by ID
   */
  deleteTemplate(id: number): Observable<any> {
    return this.getApiUrl().pipe(
      switchMap(apiUrl => {
        const url = `${apiUrl}/templates/${id}`;
        
        return this.http.delete(url).pipe(
          catchError(this.handleError)
        );
      })
    );
  }



  /**
   * Handle HTTP errors
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 0:
          errorMessage = 'Unable to connect to the server. This could be due to:\n' +
                        '• Backend server not running on http://localhost:5222\n' +
                        '• CORS not configured on the backend\n' +
                        '• Network connectivity issues\n' +
                        '• Firewall blocking the connection';
          break;
        case 400:
          errorMessage = `Bad Request: ${error.error?.message || 'Invalid data sent to server'}`;
          break;
        case 404:
          errorMessage = 'API endpoint not found. Please check:\n' +
                        '• Backend is running on the correct port (5222)\n' +
                        '• API routes are properly configured\n' +
                        '• Endpoint path /api/templates exists';
          break;
        case 500:
          errorMessage = `Server Error: ${error.error?.message || 'Internal server error'}`;
          break;
        default:
          errorMessage = `Error ${error.status}: ${error.error?.message || error.message}`;
      }
    }
    
    console.error('API Error Details:', {
      status: error.status,
      message: error.message,
      url: error.url,
      error: error.error,
      backendUrl: this.apiConfig.getCurrentApiUrl() || 'Detection in progress...',
      frontendUrl: window.location.origin
    });
    
    return throwError(() => new Error(errorMessage));
  }
}

// Predefined label sizes
export const LABEL_SIZES: LabelSize[] = [
  { name: 'Shipping Label (4 x 6 in)', width: 4, height: 6, unit: 'inch' },
  { name: 'Shipping Label (4 x 8 in)', width: 4, height: 8, unit: 'inch' },
  { name: 'Box Label (3 x 5 in)', width: 3, height: 5, unit: 'inch' },
  { name: 'Box Label (2 x 4 in)', width: 2, height: 4, unit: 'inch' },
  { name: 'Pallet Label (6 x 6 in)', width: 6, height: 6, unit: 'inch' },
  { name: 'Pallet Label (6 x 4 in)', width: 6, height: 4, unit: 'inch' },
  { name: 'Inventory Label (1 x 3 in)', width: 1, height: 3, unit: 'inch' },
  { name: 'Inventory Label (1.5 x 1 in)', width: 1.5, height: 1, unit: 'inch' },
  { name: 'Address Label (1 x 2.625 in)', width: 1, height: 2.625, unit: 'inch' }
];
