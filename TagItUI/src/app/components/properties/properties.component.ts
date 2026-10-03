import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CanvasElement } from '../../services';
import { ViewingMode, DEFAULT_VIEWING_MODE } from '../../services/viewing-mode.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
    standalone: true,
    selector: 'app-properties',
    imports: [FormsModule],
    templateUrl: './properties.component.html',
    styleUrls: ['./properties.component.scss'],
    animations: [
        trigger('panel', [
            // when the panel appears
            transition(':enter', [
                style({ opacity: 0, transform: 'translate3d(12px, 8px, 0) scale(.98)' }),
                animate('180ms cubic-bezier(.2,.8,.2,1)', style({ opacity: 1, transform: 'translate3d(0,0,0) scale(1)' }))
            ]),
            // when the panel disappears
            transition(':leave', [
                animate('140ms cubic-bezier(.4,0,.2,1)', style({ opacity: 0, transform: 'translate3d(8px, 0, 0) scale(.98)' }))
            ])
        ])
    ]
})
export class PropertiesComponent {
  @Input() selectedElement: CanvasElement | null = null;
  @Input() viewingMode: ViewingMode = DEFAULT_VIEWING_MODE;

  @Output() elementUpdate = new EventEmitter<CanvasElement>();
  @Output() elementDeselect = new EventEmitter<void>();
  @Output() lineOrientationChange = new EventEmitter<string>();

  // Dropdown states
  showFontFamilyDropdown = false;

  updateElement() {
    if (this.selectedElement) {
      // For line elements, update dimensions based on orientation and lineLength
      if (this.selectedElement.type === 'line' && this.selectedElement.lineLength) {
        const angle = this.selectedElement.lineAngle || 0;
        if (angle === 0) {
          // Horizontal line - length is width
          this.selectedElement.width = this.selectedElement.lineLength;
          this.selectedElement.height = Math.max(8, (this.selectedElement.lineWidth || 2) + 6);
        } else if (angle === 90) {
          // Vertical line - length is height, but we store it in width for the selection box
          this.selectedElement.height = this.selectedElement.lineLength;
          this.selectedElement.width = Math.max(8, (this.selectedElement.lineWidth || 2) + 6);
        }
      }
      
      // Always emit the updated element to keep properties panel visible
      this.elementUpdate.emit({...this.selectedElement});
    }
  }


  deselectElement() {
    this.elementDeselect.emit();
  }



  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent) {
    // Only handle shortcuts when an element is selected
    if (!this.selectedElement) return;

    // Don't handle shortcuts when typing in input fields
    const target = event.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      return;
    }

  }

  setLineOrientation(angle: number) {
    if (this.selectedElement && this.selectedElement.type === 'line') {
      const currentAngle = this.selectedElement.lineAngle || 0;
      this.selectedElement.lineAngle = angle;
      
      // When rotating between horizontal and vertical, preserve the line length
      if ((currentAngle === 0 && angle === 90) || (currentAngle === 90 && angle === 0)) {
        // For horizontal to vertical: width becomes height, height becomes width
        // For vertical to horizontal: height becomes width, width becomes height
        const currentLength = currentAngle === 0 ? this.selectedElement.width : this.selectedElement.height;
        const selectionBoxSize = Math.max(8, (this.selectedElement.lineWidth || 2) + 6);
        
        if (angle === 90) {
          // Rotating to vertical: length goes to height, width becomes selection box size
          this.selectedElement.height = currentLength;
          this.selectedElement.width = selectionBoxSize;
        } else {
          // Rotating to horizontal: length goes to width, height becomes selection box size
          this.selectedElement.width = currentLength;
          this.selectedElement.height = selectionBoxSize;
        }
      }
      
      // Emit line orientation change event for animation
      this.lineOrientationChange.emit(this.selectedElement.id);
      
      this.updateElement();
    }
  }

  // ==========================================
  // Modern Dropdown Methods
  // ==========================================

  toggleFontFamilyDropdown(): void {
    this.showFontFamilyDropdown = !this.showFontFamilyDropdown;
  }

  selectFontFamily(fontFamily: string): void {
    if (this.selectedElement) {
      this.selectedElement.fontFamily = fontFamily;
      this.updateElement();
      this.showFontFamilyDropdown = false;
    }
  }
}
