import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';
import { CanvasElement } from './label-template.service';
import { HttpErrorResponse, HttpClient } from '@angular/common/http';
import jsPDF from 'jspdf';

export interface GenerateLabelRequest {
  templateId: number;
  data: { [key: string]: any };
}

export interface BulkGenerateRequest {
  templateId: number;
  data: { [key: string]: any }[];
}

// Bulk Generate Label Request based on backend expectations
// Backend expects: List<Dictionary<string, object>> DataSets
export interface BulkGenerateLabelRequest {
  templateId: number;
  dataSets: { [key: string]: any }[];
}

// CSV File Upload Request for backend processing
export interface CsvFileUploadRequest {
  templateId: number;
  csvFile: File;
  selectedRows?: number[]; // Optional: specific rows to process
}

@Injectable({
  providedIn: 'root'
})
export class PdfGenerationService {
  constructor(private apiConfig: ApiConfigService, private http: HttpClient) {}

  /**
   * Generate PDF from canvas elements
   */
  generatePdf(templateId: number, pdfData: any): Observable<Blob> {
    // Use backend API for PDF generation to support barcodes
    return this.generatePdfFromBackend(templateId, pdfData);
  }

  /**
   * Generate bulk PDFs from multiple data sets
   */
  generateBulkPdf(templateId: number, dataArray: { [key: string]: any }[]): Observable<Blob> {
    try {
      // Create BulkGenerateLabelRequest as requested
      // Backend expects: List<Dictionary<string, object>> DataSets
      const request: BulkGenerateLabelRequest = {
        templateId: templateId,
        dataSets: dataArray
      };
      
      // Get API URL and call backend API
      return from(this.apiConfig.getApiUrl()).pipe(
        map(apiUrl => {
          return `${apiUrl}/labels/generate-bulk`;
        }),
        switchMap(url => {
          return this.http.post<Blob>(url, request, {
            responseType: 'blob' as 'json',
            headers: {
              'Content-Type': 'application/json'
            }
          }).pipe(
            catchError(error => {
              console.error('HTTP Error Details:', error);
              console.error('Error Status:', error.status);
              console.error('Error Message:', error.message);
              console.error('Error Body:', error.error);
              
              // Try to parse the error response for more details
              if (error.error) {
                try {
                  const errorText = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
                  console.error('Parsed Error Response:', errorText);
                } catch (e) {
                  console.error('Could not parse error response');
                }
              }
              
              return throwError(() => error);
            })
          );
        }),
        map(blob => {
          return blob;
        })
      );
    } catch (error) {
      console.error('Error in bulk PDF generation:', error);
      return throwError(() => new Error('Failed to generate bulk PDF'));
    }
  }

  /**
   * Generate PDF using backend API (supports barcodes)
   */
  private generatePdfFromBackend(templateId: number, pdfData: any): Observable<Blob> {
    try {
      // Extract request data from pdfData
      const requestData = pdfData.data || {};
      
      const request: GenerateLabelRequest = {
        templateId: templateId,
        data: requestData
      };
      
      // Get API URL and call backend API
      return from(this.apiConfig.getApiUrl()).pipe(
        map(apiUrl => {
          return `${apiUrl}/labels/generate`;
        }),
        switchMap(url => this.http.post<Blob>(url, request, {
          responseType: 'blob' as 'json'
        }))
      );
    } catch (error) {
      console.error('Error preparing backend PDF generation:', error);
      return throwError(() => new Error('Failed to prepare PDF generation request'));
    }
  }

  /**
   * Convert frontend canvas elements to backend schema format
   */
  private convertToBackendSchema(pdfData: any): any {
    const elements: any[] = [];
    
    if (pdfData.canvasElements) {
      pdfData.canvasElements.forEach((element: CanvasElement) => {
        const backendElement: any = {
          id: element.id,
          type: element.type,
          x: element.x,
          y: element.y,
          w: element.width,
          h: element.height,
          unit: 'inch'
        };
        
        if (element.type === 'text') {
          backendElement.value = element.content || '';
          backendElement.style = {
            fontFamily: element.fontFamily || 'Arial',
            fontSize: element.fontSize || 12,
            bold: element.fontWeight === 'bold',
            align: 'left'
          };
        } else if (element.type === 'barcode') {
          backendElement.format = (element.barcodeType || 'code128').toUpperCase();
          backendElement.data = element.content || '';
          backendElement.humanReadable = false;
        } else if (element.type === 'qr') {
          backendElement.data = element.content || '';
          backendElement.errorCorrection = 'M'; // Default error correction level
        } else if (element.type === 'rectangle') {
          backendElement.borderThickness = element.borderWidth || 1;
          backendElement.color = element.borderColor || '#000000';
        } else if (element.type === 'line') {
          backendElement.thickness = element.lineWidth || 2;
          backendElement.color = element.lineColor || '#000000';
          backendElement.angle = element.lineAngle || 0;
        }
        
        elements.push(backendElement);
      });
    }
    
    return {
      paper: {
        unit: pdfData.paperUnit || 'inch',
        width: pdfData.paperWidth || 4,
        height: pdfData.paperHeight || 6
      },
      elements: elements
    };
  }

  /**
   * Generate PDF from template data (legacy method)
   */
  private async generatePdfFromData(pdfData: any): Promise<Blob> {
    try {
      // Validate input data
      if (!pdfData) {
        throw new Error('PDF data is required');
      }

      // Extract paper dimensions with defaults
      const paperWidth = this.convertToPoints(pdfData.paperWidth || 4, pdfData.paperUnit || 'inch');
      const paperHeight = this.convertToPoints(pdfData.paperHeight || 6, pdfData.paperUnit || 'inch');
      
      // Validate paper dimensions
      if (paperWidth <= 0 || paperHeight <= 0) {
        throw new Error('Invalid paper dimensions');
      }
      
      // Create PDF document with correct paper size
      const pdf = new jsPDF({
        orientation: paperWidth > paperHeight ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [paperWidth, paperHeight]
      });

      // Set background to white
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, paperWidth, paperHeight, 'F');

      // Add paper layout border for debugging (optional)
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(1);
      pdf.rect(0, 0, paperWidth, paperHeight, 'S');

      // Render canvas elements
      if (pdfData.canvasElements && Array.isArray(pdfData.canvasElements)) {
        let renderedCount = 0;
        for (const element of pdfData.canvasElements) {
          try {
            await this.renderElement(pdf, element, pdfData.paperLayout || { left: 0, top: 0 });
            renderedCount++;
          } catch (elementError) {
            console.warn(`Failed to render element ${element.id}:`, elementError);
            // Continue with other elements
          }
        }
      } else {
        console.warn('No canvas elements found in PDF data');
      }

      // Return PDF as blob
      const blob = pdf.output('blob');
      return blob;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate element is within paper boundaries
   */
  private validateElementPosition(element: CanvasElement, paperLayout: any): boolean {
    // Since elements are now sent in inches relative to paper layout (0,0),
    // we should convert paper layout dimensions to points for comparison
    const paperWidth = this.convertToPoints(paperLayout.width || 0, 'inch');
    const paperHeight = this.convertToPoints(paperLayout.height || 0, 'inch');
    
    // Element coordinates are already in inches relative to paper layout
    const elementX = this.convertToPoints(element.x, 'inch');
    const elementY = this.convertToPoints(element.y, 'inch');
    const elementWidth = this.convertToPoints(element.width || 0, 'inch');
    const elementHeight = this.convertToPoints(element.height || 0, 'inch');

    // Use a small tolerance for boundary validation
    const tolerance = 5; // 5 points tolerance
    const isWithinBounds = elementX >= -tolerance && elementY >= -tolerance && 
                          elementX + elementWidth <= paperWidth + tolerance && 
                          elementY + elementHeight <= paperHeight + tolerance;

    return isWithinBounds;
  }

  /**
   * Render individual element on PDF
   */
  private async renderElement(pdf: jsPDF, element: CanvasElement, paperLayout: any): Promise<void> {
    // Validate element
    if (!element || !element.type) {
      throw new Error('Invalid element data');
    }

    // Validate element position
    const isWithinBounds = this.validateElementPosition(element, paperLayout);

    // Convert element coordinates to PDF space
    // Elements are now sent in inches relative to paper layout, so convert directly to points
    const elementUnit = (element as any).unit || 'inch';
    const elementX = this.convertToPoints(element.x, elementUnit);
    const elementY = this.convertToPoints(element.y, elementUnit);
    
    // Convert dimensions to points
    const elementWidth = this.convertToPoints(element.width || 0, elementUnit);
    const elementHeight = this.convertToPoints(element.height || 0, elementUnit);
    const fontSize = this.convertToPoints(element.fontSize || 12, 'px'); // Font size is still in pixels


    // Skip elements with invalid dimensions
    // Use a minimum threshold to account for unit conversion precision issues
    // This prevents text boxes from disappearing when resized too small
    const minDimensionThreshold = 0.5; // 0.5 points minimum
    if (elementWidth <= minDimensionThreshold || elementHeight <= minDimensionThreshold) {
      console.warn(`Skipping element ${element.id} with dimensions too small: ${elementWidth}x${elementHeight} points`);
      return;
    }


    if (element.type === 'text') {
      // Render text element
      // Ensure minimum font size for readability
      const minFontSize = 6; // 6 points minimum font size
      const actualFontSize = Math.max(fontSize, minFontSize);
      pdf.setFontSize(actualFontSize);
      
      // Set text color
      if (element.color) {
        const color = this.parseColor(element.color);
        pdf.setTextColor(color.r, color.g, color.b);
      } else {
        pdf.setTextColor(0, 0, 0); // Default to black
      }
      
      // Set font weight
      if (element.fontWeight === 'bold') {
        pdf.setFont('helvetica', 'bold');
      } else {
        pdf.setFont('helvetica', 'normal');
      }
      
      // Render text
      if (element.content && element.content.trim()) {
        // Handle text wrapping for long text
        const maxWidth = elementWidth;
        const lines = pdf.splitTextToSize(element.content, maxWidth);
        
        // Render each line
        lines.forEach((line: string, index: number) => {
          // Adjust Y position to account for text baseline
          const lineY = elementY + actualFontSize + (index * actualFontSize * 1.2);
          pdf.text(line, elementX, lineY);
        });
      }
    } else if (element.type === 'rectangle') {
      // Render rectangle element
      if (element.fillColor && element.fillColor !== 'transparent') {
        const fillColor = this.parseColor(element.fillColor);
        pdf.setFillColor(fillColor.r, fillColor.g, fillColor.b);
        pdf.rect(elementX, elementY, elementWidth, elementHeight, 'F');
      }
      
      if (element.borderColor && element.borderWidth) {
        const borderColor = this.parseColor(element.borderColor);
        pdf.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
        pdf.setLineWidth(this.convertToPoints(element.borderWidth, 'px'));
        pdf.rect(elementX, elementY, elementWidth, elementHeight, 'S');
      } else if (element.borderColor) {
        // Draw border with default width
        const borderColor = this.parseColor(element.borderColor);
        pdf.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
        pdf.setLineWidth(1);
        pdf.rect(elementX, elementY, elementWidth, elementHeight, 'S');
      }
    }
  }

  /**
   * Convert units to points (PDF standard unit)
   */
  private convertToPoints(value: number, unit: string): number {
    const pointsPerInch = 72;
    const pointsPerCm = pointsPerInch / 2.54;
    const pointsPerPx = pointsPerInch / 96; // 96 DPI standard

    switch (unit.toLowerCase()) {
      case 'pt':
      case 'point':
        return value;
      case 'in':
      case 'inch':
        return value * pointsPerInch;
      case 'cm':
        return value * pointsPerCm;
      case 'px':
      case 'pixel':
        return value * pointsPerPx;
      default:
        return value * pointsPerPx; // Default to pixels
    }
  }

  /**
   * Parse color string to RGB values
   */
  private parseColor(color: string): { r: number; g: number; b: number } {
    // Handle transparent color
    if (color === 'transparent') {
      throw new Error('Transparent color cannot be parsed to RGB values');
    }
    
    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { r, g, b };
    }
    
    // Handle rgb() colors
    if (color.startsWith('rgb(')) {
      const values = color.slice(4, -1).split(',').map(v => parseInt(v.trim()));
      return { r: values[0], g: values[1], b: values[2] };
    }
    
    // Handle named colors (basic set)
    const namedColors: { [key: string]: { r: number; g: number; b: number } } = {
      'black': { r: 0, g: 0, b: 0 },
      'white': { r: 255, g: 255, b: 255 },
      'red': { r: 255, g: 0, b: 0 },
      'green': { r: 0, g: 255, b: 0 },
      'blue': { r: 0, g: 0, b: 255 },
      'yellow': { r: 255, g: 255, b: 0 },
      'cyan': { r: 0, g: 255, b: 255 },
      'magenta': { r: 255, g: 0, b: 255 },
      'gray': { r: 128, g: 128, b: 128 },
      'grey': { r: 128, g: 128, b: 128 }
    };
    
    return namedColors[color.toLowerCase()] || { r: 0, g: 0, b: 0 }; // Default to black
  }

  /**
   * Create JSON schema for template storage
   */
  createJsonSchema(
    canvasElements: CanvasElement[],
    paperWidth: number,
    paperHeight: number,
    paperUnit: string,
    paperLayoutLeft: number,
    paperLayoutTop: number,
    paperLayoutWidth: number,
    paperLayoutHeight: number
  ): string {
    
    // Convert canvas elements to backend format for PDF generation
    const backendElements = canvasElements.map((element, index) => {
      // Send pixel coordinates directly to backend
      // Backend will handle the conversion using its DPI logic
      const relativeX = element.x - paperLayoutLeft;
      const relativeY = element.y - paperLayoutTop;
      
      const backendElement: any = {
        id: element.id,
        type: element.type,
        x: relativeX, // Send as pixels
        y: relativeY, // Send as pixels
        w: element.width, // Send as pixels
        h: element.height, // Send as pixels
        unit: 'px' // Backend expects pixels
      };

      if (element.type === 'text') {
        backendElement.value = element.content || '';
        backendElement.style = {
          fontFamily: element.fontFamily || 'Arial',
          fontSize: element.fontSize || 12,
          bold: element.fontWeight === 'bold',
          align: 'left',
          color: element.color || '#000000'
        };
      } else if (element.type === 'textarea') {
        backendElement.value = element.content || '';
        backendElement.style = {
          fontFamily: element.fontFamily || 'Arial',
          fontSize: element.fontSize || 12,
          bold: element.fontWeight === 'bold',
          align: 'left',
          color: element.color || '#000000'
        };
        backendElement.rows = element.rows || 4;
        backendElement.cols = element.cols || 20;
        backendElement.placeholder = element.placeholder || '';
      } else if (element.type === 'barcode') {
        backendElement.format = (element.barcodeType || 'code128').toUpperCase();
        backendElement.data = element.content || '';
        backendElement.humanReadable = false;
      } else if (element.type === 'qr') {
        backendElement.data = element.content || '';
        backendElement.errorCorrection = 'M'; // Default error correction level
      } else if (element.type === 'rectangle') {
        backendElement.borderThickness = element.borderWidth || 1;
        backendElement.color = element.borderColor || '#000000';
        backendElement.fillColor = element.fillColor || '#ffffff';
      } else if (element.type === 'line') {
        backendElement.thickness = element.lineWidth || 2;
        backendElement.color = element.lineColor || '#000000';
        backendElement.angle = element.lineAngle || 0;
      } else if (element.type === 'image') {
        backendElement.src = element.imageSrc || '';
      }
      
      return backendElement;
    });


    const schema = {
      // Backend format for PDF generation
      paper: {
        unit: paperUnit,
        width: paperWidth,
        height: paperHeight
      },
      elements: backendElements,
      
      // Frontend format for template restoration
      originalElements: canvasElements.map(element => ({
        ...element,
        unit: 'px' // Ensure all canvas elements have unit set to pixels
      })),
      paperLayout: {
        left: paperLayoutLeft,
        top: paperLayoutTop,
        width: paperLayoutWidth,
        height: paperLayoutHeight
      },
      canvasWidth: 1200, // Default canvas width
      canvasHeight: 800, // Default canvas height
      paperSize: this.determinePaperSize(paperWidth, paperHeight, paperUnit),
      created: new Date().toISOString()
    };

    return JSON.stringify(schema);
  }

  /**
   * Determine paper size based on dimensions
   */
  private determinePaperSize(width: number, height: number, unit: string): string {
    // Convert to inches for comparison
    let widthInches = width;
    let heightInches = height;
    
    if (unit === 'cm') {
      widthInches = width / 2.54;
      heightInches = height / 2.54;
    }
    
    // Check against standard sizes
    const standardSizes = [
      { name: 'A4', width: 8.27, height: 11.69 },
      { name: 'Letter', width: 8.5, height: 11 },
      { name: 'Legal', width: 8.5, height: 14 },
      { name: 'A3', width: 11.69, height: 16.54 },
      { name: 'Pallet Label (6 x 6 in)', width: 6, height: 6 },
      { name: 'Shipping Label (4 x 6 in)', width: 4, height: 6 },
      { name: 'Box Label (3 x 5 in)', width: 3, height: 5 }
    ];
    
    for (const size of standardSizes) {
      if (Math.abs(widthInches - size.width) < 0.1 && Math.abs(heightInches - size.height) < 0.1) {
        return size.name;
      }
    }
    
    return 'Custom';
  }

  /**
   * Download PDF
   */
  downloadPdf(pdfBlob: Blob, filename: string = 'label-template.pdf'): void {
    const url = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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
      errorMessage = `Server Error: ${error.status} - ${error.message}`;
      
      if (error.error && typeof error.error === 'string') {
        try {
          const errorObj = JSON.parse(error.error);
          errorMessage = errorObj.message || errorMessage;
        } catch {
          // If parsing fails, use the raw error message
          errorMessage = error.error;
        }
      }
    }
    
    return throwError(() => new Error(errorMessage));
  };

  /**
   * Generate PDFs from CSV file using backend processing
   * This method uploads the CSV file to the backend for processing
   */
  generatePdfFromCsv(templateId: number, csvFile: File, selectedRows?: number[]): Observable<Blob> {
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('templateId', templateId.toString());
      formData.append('csvFile', csvFile);
      
      if (selectedRows && selectedRows.length > 0) {
        formData.append('selectedRows', JSON.stringify(selectedRows));
      }

      // Get API URL and call backend CSV processing API
      return from(this.apiConfig.getApiUrl()).pipe(
        map(apiUrl => {
          return `${apiUrl}/labels/generate-from-csv`;
        }),
        switchMap(url => {
          
          return this.http.post<Blob>(url, formData, {
            responseType: 'blob' as 'json'
          }).pipe(
            catchError(error => {
              console.error('CSV API Error Details:', error);
              console.error('Error Status:', error.status);
              console.error('Error Message:', error.message);
              console.error('Error Body:', error.error);
              
              return throwError(() => error);
            })
          );
        }),
        map(blob => {
          return blob;
        })
      );
    } catch (error) {
      return throwError(() => new Error('Failed to generate PDF from CSV'));
    }
  }
}
