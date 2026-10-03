import { Component, Input, Output, EventEmitter } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { CanvasElement } from '../../../services';

@Component({
    standalone: true,
    selector: 'app-placeholder-dialog',
    imports: [FormsModule],
    templateUrl: './placeholder-dialog.component.html',
    styleUrls: ['./placeholder-dialog.component.scss'],
    animations: [
        trigger('slideIn', [
            transition(':enter', [
                style({ transform: 'translateX(100%)', opacity: 0 }),
                animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ transform: 'translateX(0)', opacity: 1 }))
            ]),
            transition(':leave', [
                animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ transform: 'translateX(100%)', opacity: 0 }))
            ])
        ])
    ]
})
export class PlaceholderDialogComponent {
  @Input() isVisible = false;
  @Input() canvasElements: CanvasElement[] = [];
  @Input() currentPlaceholderElement: CanvasElement | null = null;
  @Output() closeDialog = new EventEmitter<void>();
  @Output() placeholderDragStart = new EventEmitter<{ event: DragEvent, placeholderType: string }>();
  @Output() placeholderValueUpdate = new EventEmitter<{ placeholderType: string, value: string }>();

  placeholderValues: { [key: string]: string } = {};

  onCloseDialog() {
    this.closeDialog.emit();
  }

  onPlaceholderDragStart(event: DragEvent, placeholderType: string) {
    this.placeholderDragStart.emit({ event, placeholderType });
  }

  // Get placeholder elements from canvas
  getPlaceholderElements(): CanvasElement[] {
    return this.canvasElements.filter(element => element.isPlaceholder);
  }

  // Update placeholder value
  updatePlaceholderValue(placeholderType: string, value: string) {
    this.placeholderValues[placeholderType] = value;
    this.placeholderValueUpdate.emit({ placeholderType, value });
  }

  // Handle placeholder input change
  onPlaceholderInput(event: Event, placeholderType: string) {
    const target = event.target as HTMLInputElement;
    this.updatePlaceholderValue(placeholderType, target.value);
  }

  // Get unique placeholder types
  getUniquePlaceholderTypes(): string[] {
    const types = this.getPlaceholderElements()
      .map(element => element.placeholderType)
      .filter(Boolean) as string[];
    return [...new Set(types)];
  }
}
