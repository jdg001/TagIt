import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';

import { trigger, transition, style, animate } from '@angular/animations';
import { ViewingMode, DEFAULT_VIEWING_MODE } from '../../services/viewing-mode.service';
import { ThemeService } from '../../services/theme.service';
import { TooltipDirective } from '../tooltip/tooltip.directive';

@Component({
    standalone: true,
    selector: 'app-navigation',
    imports: [TooltipDirective],
    templateUrl: './navigation.component.html',
    styleUrls: ['./navigation.component.scss'],
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
export class NavigationComponent implements OnInit, OnDestroy {
  @Input() isSidebarExpanded = false;
  @Input() selectedTool:
    | 'text'
    | 'textarea'
    | 'rectangle'
    | 'barcode'
    | 'qr'
    | 'line'
    | 'image'
    | 'template'
    | 'placeholder'
    | null = null;

  @Output() sidebarExpandedChange = new EventEmitter<boolean>();
  @Output() selectedToolChange = new EventEmitter<
    'text' | 'textarea' | 'rectangle' | 'barcode' | 'qr' | 'line' | 'image' | 'template' | 'placeholder' | null
  >();
  @Output() toolDragStart = new EventEmitter<{
    event: DragEvent;
    toolType: string;
  }>();
  @Output() createElement = new EventEmitter<string>();
  @Output() templateComponentDragStart = new EventEmitter<{
    event: DragEvent;
    componentType: string;
  }>();
  @Output() placeholderDragStart = new EventEmitter<{
    event: DragEvent;
    placeholderType: string;
  }>();
  @Output() groupingModeChange = new EventEmitter<boolean>();
  @Output() smartLayoutModeChange = new EventEmitter<boolean>();
  @Output() livePreviewToggle = new EventEmitter<void>();

  // Input properties
  @Input() isGroupingMode = false;
  @Input() isSmartLayoutMode = false;
  @Input() isLivePreviewActive = false;
  @Input() viewingMode: ViewingMode = DEFAULT_VIEWING_MODE;

  isDarkMode = true;
  showPlaceholderDialog = false;

  constructor(
    private elementRef: ElementRef,
    private themeService: ThemeService
  ) {}

  ngOnInit() {
    this.initializeTheme();
  }

  ngOnDestroy() {
    // Clean up any observers if needed
  }

  private initializeTheme(): void {
    // Initialize theme from centralized service
    this.isDarkMode = this.themeService.initializeComponentTheme();
    
    // Subscribe to theme changes
    this.themeService.onThemeChange().subscribe(isDarkMode => {
      this.isDarkMode = isDarkMode;
    });
  }

  // Old theme checking method - now handled by ThemeService
  // private checkDarkTheme() {
  //   this.isDarkMode =
  //     document.body.classList.contains('dark-theme') ||
  //     document.documentElement.classList.contains('dark-theme') ||
  //     document
  //       .querySelector('.app-container')
  //       ?.classList.contains('dark-theme') ||
  //     false;
  // }

  // Old theme observation method - now handled by ThemeService
  // private observeThemeChanges() {
  //   // Create a MutationObserver to watch for theme changes
  //   const observer = new MutationObserver((mutations) => {
  //     mutations.forEach((mutation) => {
  //       if (
  //         mutation.type === 'attributes' &&
  //         mutation.attributeName === 'class'
  //       ) {
  //         this.checkDarkTheme();
  //       }
  //     });
  //   });

  //   // Observe the body element for class changes
  //   observer.observe(document.body, {
  //     attributes: true,
  //     attributeFilter: ['class'],
  //   });

  //   // Also observe the app container
  //   const appContainer = document.querySelector('.app-container');
  //   if (appContainer) {
  //     observer.observe(appContainer, {
  //       attributes: true,
  //       attributeFilter: ['class'],
  //     });
  //   }
  // }

  onOpenSidebar() {
    this.isSidebarExpanded = true;
    this.sidebarExpandedChange.emit(true);
  }

  onCloseSidebar() {
    this.isSidebarExpanded = false;
    this.sidebarExpandedChange.emit(false);
  }

  onSelectTool(
    tool: 'text' | 'textarea' | 'rectangle' | 'barcode' | 'qr' | 'line' | 'image' | 'template' | 'placeholder' | null
  ) {
    this.selectedTool = tool;
    this.selectedToolChange.emit(tool);

    // Handle dialog visibility and element creation
    if (tool === 'placeholder') {
      this.showPlaceholderDialog = true;
    } else if (tool === 'template') {
      // Template tool doesn't create elements directly
      this.showPlaceholderDialog = false;
    } else if (tool) {
      // Create element for all other tools
      this.createElement.emit(tool);
      this.showPlaceholderDialog = false;
    } else {
      this.showPlaceholderDialog = false;
    }
  }

  onToolDragStart(event: DragEvent, toolType: string) {
    // Set the drag data on the event
    const dragData = {
      type: 'tool',
      toolType: toolType
    };
    event.dataTransfer?.setData('application/json', JSON.stringify(dragData));
    event.dataTransfer!.effectAllowed = 'copy';
    
    this.toolDragStart.emit({ event, toolType });
  }

  onTemplateComponentDragStart(event: DragEvent, componentType: string) {
    // Set the drag data on the event
    const dragData = {
      type: 'template-component',
      componentType: componentType
    };
    event.dataTransfer?.setData('application/json', JSON.stringify(dragData));
    event.dataTransfer!.effectAllowed = 'copy';
    
    this.templateComponentDragStart.emit({ event, componentType });
  }

  onPlaceholderDragStart(event: DragEvent, placeholderType: string) {
    // Set the drag data on the event
    const dragData = {
      type: 'placeholder',
      placeholderType: placeholderType
    };
    event.dataTransfer?.setData('application/json', JSON.stringify(dragData));
    event.dataTransfer!.effectAllowed = 'copy';
    
    this.placeholderDragStart.emit({ event, placeholderType });
  }

  onClosePlaceholderDialog() {
    this.showPlaceholderDialog = false;
    this.selectedTool = null;
    this.selectedToolChange.emit(null);
  }

  onToggleGroupingMode() {
    this.isGroupingMode = !this.isGroupingMode;
    this.groupingModeChange.emit(this.isGroupingMode);
    
    // Clear any selected tool when entering grouping mode
    if (this.isGroupingMode) {
      this.selectedTool = null;
      this.selectedToolChange.emit(null);
    }
  }

  onToggleSmartLayoutMode() {
    this.isSmartLayoutMode = !this.isSmartLayoutMode;
    this.smartLayoutModeChange.emit(this.isSmartLayoutMode);
    
    // Clear any selected tool when entering smart layout mode
    if (this.isSmartLayoutMode) {
      this.selectedTool = null;
      this.selectedToolChange.emit(null);
    }
  }

  onToggleLivePreview() {
    this.livePreviewToggle.emit();
  }
}