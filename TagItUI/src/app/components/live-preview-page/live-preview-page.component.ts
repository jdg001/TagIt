import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { CanvasElement } from '../../services/label-template.service';
import { LivePreviewPopupService, PreviewData } from '../../services/live-preview-popup.service';

@Component({
  selector: 'app-live-preview-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './live-preview-page.component.html',
  styleUrls: ['./live-preview-page.component.scss']
})
export class LivePreviewPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Preview data
  canvasElements: CanvasElement[] = [];
  paperLayoutWidth = 576;
  paperLayoutHeight = 576;
  paperLayoutLeft = 0;
  paperLayoutTop = 0;
  paperWidth = 6;
  paperHeight = 6;
  paperUnit = 'inch';
  selectedTemplate: any = null;
  isDarkMode = true;

  // Preview scaling properties
  previewScale = 1;
  previewWidth = 0;
  previewHeight = 0;
  maxPreviewWidth = 800;
  maxPreviewHeight = 600;

  // Loading state
  isLoading = true;
  hasData = false;

  constructor(private popupService: LivePreviewPopupService) {}

  ngOnInit() {
    // Apply theme to body
    document.body.classList.add('live-preview-popup');
    
    // Listen for messages from parent window
    window.addEventListener('message', this.handleMessage.bind(this));

    // Subscribe to preview data updates
    this.popupService.previewData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        if (data) {
          this.updatePreviewData(data);
        }
      });

    // Notify parent that popup is ready
    if (window.opener) {
      window.opener.postMessage({
        type: 'PREVIEW_POPUP_READY'
      }, window.location.origin);
    }

    // Try to get initial data if service has it
    const initialData = this.popupService.getCurrentPreviewData();
    if (initialData) {
      this.updatePreviewData(initialData);
    }

    // Set loading timeout
    setTimeout(() => {
      if (!this.hasData) {
        this.isLoading = false;
      }
    }, 3000);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    document.body.classList.remove('live-preview-popup');
    
    // Notify parent that popup is closing
    if (window.opener) {
      window.opener.postMessage({
        type: 'PREVIEW_POPUP_CLOSED'
      }, window.location.origin);
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    // Notify parent that popup is closing
    if (window.opener) {
      window.opener.postMessage({
        type: 'PREVIEW_POPUP_CLOSED'
      }, window.location.origin);
    }
  }

  private handleMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) {
      return;
    }

    if (event.data.type === 'PREVIEW_DATA_UPDATE') {
      this.updatePreviewData(event.data.data);
    }
  }

  private updatePreviewData(data: PreviewData) {
    this.canvasElements = data.canvasElements || [];
    this.paperLayoutWidth = data.paperLayoutWidth || 576;
    this.paperLayoutHeight = data.paperLayoutHeight || 576;
    this.paperLayoutLeft = data.paperLayoutLeft || 0;
    this.paperLayoutTop = data.paperLayoutTop || 0;
    this.paperWidth = data.paperWidth || 6;
    this.paperHeight = data.paperHeight || 6;
    this.paperUnit = data.paperUnit || 'inch';
    this.selectedTemplate = data.selectedTemplate;
    this.isDarkMode = data.isDarkMode;

    // Apply theme
    document.body.classList.toggle('dark-theme', this.isDarkMode);

    this.calculatePreviewDimensions();
    this.isLoading = false;
    this.hasData = true;
  }

  private calculatePreviewDimensions() {
    // Get available space (accounting for header and padding)
    const availableWidth = window.innerWidth - 40; // 20px padding on each side
    const availableHeight = window.innerHeight - 120; // Account for header and padding

    // Calculate scale to fit the preview within available space
    const scaleX = availableWidth / this.paperLayoutWidth;
    const scaleY = availableHeight / this.paperLayoutHeight;
    this.previewScale = Math.min(scaleX, scaleY, 1.5); // Allow up to 150% scale

    this.previewWidth = this.paperLayoutWidth * this.previewScale;
    this.previewHeight = this.paperLayoutHeight * this.previewScale;
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.calculatePreviewDimensions();
  }

  // Helper method to check if element has placeholder syntax
  hasPlaceholderSyntax(content: string): boolean {
    return /\{\{[^}]+\}\}/.test(content);
  }

  // Helper method to get preview content (show placeholder syntax as-is)
  getPreviewContent(element: CanvasElement): string {
    if (!element.content) return '';
    return element.content;
  }

  // Helper method to get element styles for preview
  getElementStyles(element: CanvasElement) {
    // Convert canvas coordinates to paper-relative coordinates
    // Elements are positioned relative to the paper layout, not the canvas
    const paperRelativeX = element.x - this.paperLayoutLeft;
    const paperRelativeY = element.y - this.paperLayoutTop;
    
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

  // Refresh preview data
  refreshPreview() {
    if (window.opener) {
      window.opener.postMessage({
        type: 'PREVIEW_REFRESH_REQUEST'
      }, window.location.origin);
    }
  }
}
