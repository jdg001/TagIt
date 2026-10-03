import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';

import { trigger, state, style, transition, animate } from '@angular/animations';
import { CanvasElement } from '../../services';
import { TooltipDirective } from '../tooltip/tooltip.directive';

interface ElementGroup {
  id: string;
  name: string;
  elementIds: Set<string>;
  color: string;
  createdAt: Date;
}

@Component({
    standalone: true,
    selector: 'app-grouping-details',
    imports: [TooltipDirective],
    templateUrl: './grouping-details.component.html',
    styleUrl: './grouping-details.component.css',
    animations: [
        trigger('slideIn', [
            transition(':enter', [
                style({ transform: 'translateX(100%)', opacity: 0 }),
                animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ transform: 'translateX(0)', opacity: 1 })),
            ]),
            transition(':leave', [
                animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ transform: 'translateX(100%)', opacity: 0 })),
            ]),
        ]),
    ]
})
export class GroupingDetailsComponent implements OnInit, OnChanges {
  @Input() elementGroups: Map<string, ElementGroup> = new Map();
  @Input() canvasElements: CanvasElement[] = [];

  @Output() ungroupAll = new EventEmitter<void>();
  @Output() ungroupElement = new EventEmitter<string>();
  @Output() ungroupGroup = new EventEmitter<string>();
  @Output() elementHover = new EventEmitter<string | null>();

  groupsList: ElementGroup[] = [];
  isMinimized = false;
  minimizedGroups: Set<string> = new Set(); // Track which groups are minimized

  ngOnInit() {
    this.updateGroupsList();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.updateGroupsList();
  }

  private updateGroupsList() {
    this.groupsList = Array.from(this.elementGroups.values());
  }

  onUngroupAll() {
    this.ungroupAll.emit();
  }

  onUngroupElement(elementId: string) {
    this.ungroupElement.emit(elementId);
  }

  getElementTypeDisplayName(type: string): string {
    switch (type) {
      case 'text': return 'Text';
      case 'rectangle': return 'Rectangle';
      case 'barcode': return 'Barcode';
      case 'qr': return 'QR Code';
      case 'line': return 'Line';
      case 'image': return 'Image';
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }

  trackElement(index: number, element: CanvasElement): string {
    return element.id;
  }

  trackGroup(index: number, group: ElementGroup): string {
    return group.id;
  }

  getElementsInGroup(group: ElementGroup): CanvasElement[] {
    return this.canvasElements.filter(element => group.elementIds.has(element.id));
  }

  getTotalGroupedElements(): number {
    let total = 0;
    this.groupsList.forEach(group => total += group.elementIds.size);
    return total;
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
  }

  onElementHover(elementId: string) {
    this.elementHover.emit(elementId);
  }

  onElementHoverEnd() {
    this.elementHover.emit(null);
  }

  onUngroupGroup(groupId: string) {
    this.ungroupGroup.emit(groupId);
  }

  toggleGroupMinimize(groupId: string) {
    if (this.minimizedGroups.has(groupId)) {
      this.minimizedGroups.delete(groupId);
    } else {
      this.minimizedGroups.add(groupId);
    }
  }

  isGroupMinimized(groupId: string): boolean {
    return this.minimizedGroups.has(groupId);
  }
}