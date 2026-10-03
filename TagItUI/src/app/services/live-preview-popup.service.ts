import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { CanvasElement } from './label-template.service';

export interface PreviewData {
  canvasElements: CanvasElement[];
  paperLayoutWidth: number;
  paperLayoutHeight: number;
  paperLayoutLeft: number;
  paperLayoutTop: number;
  paperWidth: number;
  paperHeight: number;
  paperUnit: string;
  selectedTemplate: any;
  isDarkMode: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LivePreviewPopupService {
  private popupWindow: Window | null = null;
  private previewDataSubject = new BehaviorSubject<PreviewData | null>(null);
  private popupClosedSubject = new Subject<void>();

  public previewData$ = this.previewDataSubject.asObservable();
  public popupClosed$ = this.popupClosedSubject.asObservable();

  constructor() {
    // Listen for messages from popup window
    window.addEventListener('message', this.handleMessage);

    // Listen for window close events to close popup
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    // Check if popup is closed periodically
    setInterval(() => {
      if (this.popupWindow && this.popupWindow.closed) {
        this.handlePopupClosed();
      }
    }, 1000);
  }

  openPreview(data: PreviewData): boolean {
    try {
      // Close existing popup if open
      this.closePreview();

      // Calculate popup dimensions
      const popupWidth = Math.min(1200, window.screen.availWidth * 0.8);
      const popupHeight = Math.min(800, window.screen.availHeight * 0.8);
      const left = (window.screen.availWidth - popupWidth) / 2;
      const top = (window.screen.availHeight - popupHeight) / 2;

      // Open new popup window
      this.popupWindow = window.open(
        '/live-preview', // We'll create this route
        'live-preview',
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},` +
        'resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no'
      );

      if (!this.popupWindow) {
        console.error('Failed to open popup window. Please allow popups for this site.');
        return false;
      }

      // Store the data to send when popup is ready
      this.previewDataSubject.next(data);

      // Focus the popup
      this.popupWindow.focus();

      return true;
    } catch (error) {
      console.error('Error opening live preview popup:', error);
      return false;
    }
  }

  updatePreviewData(data: PreviewData): void {
    this.previewDataSubject.next(data);
    this.sendDataToPopup();
  }

  closePreview(): void {
    if (this.popupWindow && !this.popupWindow.closed) {
      this.popupWindow.close();
    }
    this.handlePopupClosed();
  }

  isPreviewOpen(): boolean {
    return this.popupWindow !== null && !this.popupWindow.closed;
  }

  private sendDataToPopup(): void {
    if (this.popupWindow && !this.popupWindow.closed) {
      const data = this.previewDataSubject.value;
      if (data) {
        this.popupWindow.postMessage({
          type: 'PREVIEW_DATA_UPDATE',
          data: data
        }, window.location.origin);
      }
    }
  }

  private handlePopupClosed(): void {
    this.popupWindow = null;
    this.previewDataSubject.next(null);
    this.popupClosedSubject.next();
  }

  // Method to get current preview data (for popup window to call)
  getCurrentPreviewData(): PreviewData | null {
    return this.previewDataSubject.value;
  }

  // Cleanup method to remove event listeners
  destroy(): void {
    window.removeEventListener('message', this.handleMessage);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }

  private handleMessage = (event: MessageEvent) => {
    if (event.data.type === 'PREVIEW_POPUP_READY') {
      // Send initial data when popup is ready
      this.sendDataToPopup();
    } else if (event.data.type === 'PREVIEW_POPUP_CLOSED') {
      this.handlePopupClosed();
    } else if (event.data.type === 'PREVIEW_REFRESH_REQUEST') {
      // Handle refresh request from popup
      this.sendDataToPopup();
    }
  };

  private handleBeforeUnload = () => {
    this.closePreview();
  };
}
