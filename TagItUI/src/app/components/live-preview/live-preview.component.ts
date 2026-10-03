import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CanvasElement } from '../../services/label-template.service';

@Component({
  selector: 'app-live-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './live-preview.component.html',
  styleUrls: ['./live-preview.component.scss']
})
export class LivePreviewComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isVisible = false;
  @Input() canvasElements: CanvasElement[] = [];
  @Input() paperLayoutWidth = 576;
  @Input() paperLayoutHeight = 576;
  @Input() paperLayoutLeft = 0;
  @Input() paperLayoutTop = 0;
  @Input() paperWidth = 6;
  @Input() paperHeight = 6;
  @Input() paperUnit = 'inch';
  @Input() selectedTemplate: any = null;
  @Input() isDarkMode = true;

  @Output() close = new EventEmitter<void>();

  // Preview scaling properties
  previewScale = 1;
  previewWidth = 0;
  previewHeight = 0;
  maxPreviewWidth = 800;
  maxPreviewHeight = 600;

  constructor() {}

  ngOnInit() {
    this.calculatePreviewDimensions();
    
    // Listen for escape key to close modal
    document.addEventListener('keydown', this.handleKeyDown);
  }

  ngOnDestroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['paperLayoutWidth'] || changes['paperLayoutHeight'] || changes['isVisible']) {
      this.calculatePreviewDimensions();
    }
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.isVisible) {
      this.onClose();
    }
  };

  private calculatePreviewDimensions() {
    if (!this.isVisible) return;

    // Calculate scale to fit the preview within max dimensions
    const scaleX = this.maxPreviewWidth / this.paperLayoutWidth;
    const scaleY = this.maxPreviewHeight / this.paperLayoutHeight;
    this.previewScale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%

    this.previewWidth = this.paperLayoutWidth * this.previewScale;
    this.previewHeight = this.paperLayoutHeight * this.previewScale;
  }

  onClose() {
    this.close.emit();
  }

  onBackdropClick(event: Event) {
    // Close modal when clicking on backdrop
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  // Helper method to check if element has placeholder syntax
  hasPlaceholderSyntax(content: string): boolean {
    return /\{\{[^}]+\}\}/.test(content);
  }

  // Helper method to get preview content (show placeholder syntax as-is)
  getPreviewContent(element: CanvasElement): string {
    if (!element.content) return '';
    
    // For live preview, show placeholder syntax as-is to indicate dynamic content
    return element.content;
  }

  // Helper method to get element styles for preview
  getElementStyles(element: CanvasElement) {
    // Convert canvas coordinates to paper-relative coordinates
    // Elements are positioned relative to the paper layout, not the canvas
    const paperRelativeX = element.x - (this.paperLayoutLeft || 0);
    const paperRelativeY = element.y - (this.paperLayoutTop || 0);
    
    const baseStyles = {
      left: (paperRelativeX * this.previewScale) + 'px',
      top: (paperRelativeY * this.previewScale) + 'px',
      width: (element.width * this.previewScale) + 'px',
      height: (element.height * this.previewScale) + 'px'
    };

    // Add element-specific styles
    if (element.type === 'text' || element.type === 'textarea') {
      return {
        ...baseStyles,
        fontSize: ((element.fontSize || 12) * this.previewScale) + 'px',
        fontFamily: element.fontFamily || 'Arial',
        color: element.color || '#000000',
        fontWeight: element.fontWeight || 'normal'
      };
    }

    if (element.type === 'rectangle') {
      return {
        ...baseStyles,
        backgroundColor: element.fillColor || 'transparent',
        borderColor: element.borderColor || 'transparent',
        borderWidth: ((element.borderWidth || 0) * this.previewScale) + 'px',
        borderStyle: 'solid'
      };
    }

    if (element.type === 'line') {
      const lineStyles = {
        ...baseStyles,
        backgroundColor: element.lineColor || '#000000',
        transformOrigin: '0 50%'
      };

      // Handle line rotation and dimensions
      if (element.lineAngle === 90) {
        lineStyles.width = (element.height * this.previewScale) + 'px';
        lineStyles.height = ((element.lineWidth || 2) * this.previewScale) + 'px';
      } else {
        lineStyles.height = ((element.lineWidth || 2) * this.previewScale) + 'px';
      }

      if (element.lineAngle) {
        (lineStyles as any).transform = `rotate(${element.lineAngle}deg)`;
      }

      return lineStyles;
    }

    return baseStyles;
  }

  // Helper method to get barcode SVG dimensions for preview
  getBarcodeStyles(element: CanvasElement) {
    return {
      width: (element.width * this.previewScale) + 'px',
      height: (element.height * this.previewScale) + 'px'
    };
  }

  // Track function for ngFor
  trackElement(index: number, element: CanvasElement): string {
    return element.id;
  }

  // Get template name for display
  getTemplateName(): string {
    return this.selectedTemplate?.name || 'Untitled Template';
  }

  // Get paper size info for display
  getPaperSizeInfo(): string {
    return `${this.paperWidth} × ${this.paperHeight} ${this.paperUnit}`;
  }

  // Get element count for display
  getElementCount(): number {
    return this.canvasElements.length;
  }

  // Get placeholder count for display
  getPlaceholderCount(): number {
    let count = 0;
    this.canvasElements.forEach(element => {
      if ((element.type === 'text' || element.type === 'textarea' || element.type === 'barcode' || element.type === 'qr') && element.content) {
        const placeholderMatches = element.content.match(/\{\{([^}]+)\}\}/g);
        if (placeholderMatches) {
          count += placeholderMatches.length;
        }
      }
    });
    return count;
  }
}
