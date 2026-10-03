import { Component, ViewChild, OnInit, AfterViewInit, OnChanges, SimpleChanges, HostListener, ChangeDetectorRef, inject, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CanvasElement, CollaborationService, AuthService, ThemeService } from '../../services';
import { ViewingMode, DEFAULT_VIEWING_MODE } from '../../services/viewing-mode.service';
import { CanvasComponent } from '../canvas/canvas.component';
import { PropertiesComponent } from '../properties/properties.component';
import { NavigationComponent } from '../navigation/navigation.component';
import { GroupingDetailsComponent } from '../grouping-details/grouping-details.component';
import { SmartLayoutPanelComponent } from '../smart-layout-panel/smart-layout-panel.component';
import { SmartLayoutSettings } from '../smart-layout-panel/smart-layout-panel.model';
import { HeaderComponent } from '../header/header.component';
import { UserPresenceComponent } from '../user-presence/user-presence.component';
import { LivePreviewPopupService, PreviewData } from '../../services/live-preview-popup.service';
import { Subject, takeUntil } from 'rxjs';

interface RulerMark {
  position: number;
  label: string;
}

@Component({
  selector: 'app-designer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    CanvasComponent,
    PropertiesComponent,
    NavigationComponent,
    GroupingDetailsComponent,
    SmartLayoutPanelComponent,
    UserPresenceComponent
  ],
  templateUrl: './designer.component.html',
  styleUrls: ['./designer.component.scss']
})
export class DesignerComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvasComponent') canvasComponent!: any;
  @ViewChild(HeaderComponent) headerComponent!: HeaderComponent;

  // Input from parent component (only essential data)
  @Input() selectedTemplate: any = null;
  
  // Output to parent component
  @Output() selectedTemplateChange = new EventEmitter<any>();
  @Output() canvasElementsChange = new EventEmitter<CanvasElement[]>();
  @Input() viewingMode: ViewingMode = DEFAULT_VIEWING_MODE;

  // Internal state - managed by this component
  isDarkMode = true;
  isSidebarExpanded = false;
  selectedPaperSize = 'Pallet Label (6 x 6 in)';
  clearReferenceLinesSignal = false;
  isGroupingMode = false;
  isSmartLayoutMode = false;
  elementGroups: Map<string, any> = new Map();
  isSmartLayoutPanelVisible = false;
  isLivePreviewActive = false;
  smartLayoutSettings: SmartLayoutSettings = {
    elementSticking: true,
    rowWiseAdjustment: true,
    heightWiseAdjustment: true,
    alignmentLines: true
  };
  canvasElements: CanvasElement[] = [];
  selectedElement: CanvasElement | null = null;
  selectedTool: 'text' | 'textarea' | 'rectangle' | 'barcode' | 'qr' | 'line' | 'image' | 'template' | 'placeholder' | null = null;
  showDeleteDialog = false;
  isCommentMode = false; // [CHANGE] Comment mode state
  currentDesignStateId: number | null = null; // [CHANGE] Current design state ID for comments
  currentUserId: number = 1; // [CHANGE] Current user ID for comments
  isCollaborationMode = false; // Collaboration mode state

  // Canvas update throttling
  private canvasUpdateTimeout: any = null;
  private pendingCanvasUpdate = false;
  
  // Paper layout resize tracking
  private isResizingPaper = false;
  private paperResizeTimeout: any = null;
  
  // Paper layout movement tracking
  private isMovingPaper = false;
  private paperMoveTimeout: any = null;

  // Undo/Redo state
  canUndo = false;
  canRedo = false;

  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private livePreviewPopupService = inject(LivePreviewPopupService);
  private themeService = inject(ThemeService);
  private collaborationService = inject(CollaborationService);
  private destroy$ = new Subject<void>(); 

  ngOnInit() {
    this.initializeTheme();

    // Listen for popup close events to update active state
    this.livePreviewPopupService.popupClosed$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.isLivePreviewActive = false;
      });
  }

  private initializeTheme(): void {
    // Initialize theme from centralized service
    this.isDarkMode = this.themeService.initializeComponentTheme();
    
    // Subscribe to theme changes
    this.themeService.onThemeChange().subscribe(isDarkMode => {
      this.isDarkMode = isDarkMode;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedTemplate'] && changes['selectedTemplate'].currentValue) {
      this.loadTemplateData(changes['selectedTemplate'].currentValue);
    }
    
    // [CHANGE] Enable comments by default if viewing mode requires it
    if (changes['viewingMode'] && this.viewingMode.commentsEnabledByDefault) {
      this.isCommentMode = true;
      // Also enable comment mode in header component
      if (this.headerComponent) {
        this.headerComponent.enableCommentModeByDefault();
      }
      console.log('[DESIGNER] Comments enabled by default for rejected template');
    }

    // Auto-enable collaboration if in collaboration viewing mode
    if (changes['viewingMode'] && this.viewingMode?.type === 'collaboration') {
      this.isCollaborationMode = true;
      // Use setTimeout to avoid calling async method during change detection
      setTimeout(() => {
        this.onCollaborationModeChange(true);
      }, 0);
    }
  }

  ngAfterViewInit() {
    if (this.headerComponent) {
      this.headerComponent.setThemeState(this.isDarkMode);
      
      // [CHANGE] Enable comments by default if viewing mode requires it
      if (this.viewingMode.commentsEnabledByDefault) {
        this.isCommentMode = true;
        this.headerComponent.enableCommentModeByDefault();
        console.log('[DESIGNER] Comments enabled by default in ngAfterViewInit');
      }
    }

    // Initialize undo/redo state
    this.updateUndoRedoState();
  }

  private loadTemplateData(template: any): void {
    // [CHANGE] Set current design state ID for comments
    if (template && template.designStateId) {
      this.currentDesignStateId = template.designStateId;
    } else if (template && template.templateId) {
      // Get design state ID from backend
      this.getDesignStateIdForTemplate(template.templateId);
    } else {
      this.currentDesignStateId = null;
    }
    
    // Canvas-centric approach: let canvas handle all template loading
    if (this.canvasComponent && template) {
      this.canvasComponent.loadTemplateData(template);
    }
  }

  // [CHANGE] Get design state ID for a template from backend
  private getDesignStateIdForTemplate(templateId: number): void {
    // For now, we'll use a placeholder approach
    // In a real implementation, you'd call the backend API
    console.log('[DESIGNER] Getting design state ID for template:', templateId);
    
    // TODO: Replace with actual backend call
    // For now, use templateId as a placeholder
    this.currentDesignStateId = templateId;
    console.log('[DESIGNER] Set currentDesignStateId to:', this.currentDesignStateId);
  }

  onGroupingModeChange(isGroupingMode: boolean) {
    this.isGroupingMode = isGroupingMode;
    // Clear selected element when entering grouping mode
    if (isGroupingMode) {
      this.selectedElement = null;
    }
  }

  onSmartLayoutModeChange(isSmartLayoutMode: boolean) {
    this.isSmartLayoutMode = isSmartLayoutMode;
    
    // Show smart layout panel when smart layout mode is enabled
    if (this.isSmartLayoutMode) {
      this.isSmartLayoutPanelVisible = true;
      this.selectedElement = null;
    } else {
      this.isSmartLayoutPanelVisible = false;
    }
  }

  onLivePreviewToggle() {
    if (this.livePreviewPopupService.isPreviewOpen()) {
      this.livePreviewPopupService.closePreview();
      this.isLivePreviewActive = false;
    } else {
      const previewData: PreviewData = {
        canvasElements: this.canvasElements,
        paperLayoutWidth: this.getPaperLayoutWidth(),
        paperLayoutHeight: this.getPaperLayoutHeight(),
        paperLayoutLeft: this.getPaperLayoutLeft(),
        paperLayoutTop: this.getPaperLayoutTop(),
        paperWidth: this.getPaperWidth(),
        paperHeight: this.getPaperHeight(),
        paperUnit: this.getPaperUnit(),
        selectedTemplate: this.selectedTemplate,
        isDarkMode: this.isDarkMode
      };
      this.livePreviewPopupService.openPreview(previewData);
      this.isLivePreviewActive = true;
    }
  }

  // Helper methods for live preview paper dimensions
  getPaperLayoutWidth(): number {
    return this.canvasComponent?.getPaperLayoutWidth() || 576;
  }

  getPaperLayoutHeight(): number {
    return this.canvasComponent?.getPaperLayoutHeight() || 576;
  }

  getPaperLayoutLeft(): number {
    return this.canvasComponent?.getPaperLayoutLeft() || 0;
  }

  getPaperLayoutTop(): number {
    return this.canvasComponent?.getPaperLayoutTop() || 0;
  }

  getPaperWidth(): number {
    return this.canvasComponent?.getPaperWidth() || 6;
  }

  getPaperHeight(): number {
    return this.canvasComponent?.getPaperHeight() || 6;
  }

  getPaperUnit(): string {
    return this.canvasComponent?.getPaperUnit() || 'inch';
  }


  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clear canvas update timeout
    if (this.canvasUpdateTimeout) {
      clearTimeout(this.canvasUpdateTimeout);
    }
    
    // Clear paper resize timeout
    if (this.paperResizeTimeout) {
      clearTimeout(this.paperResizeTimeout);
    }
    
    // Clear paper move timeout
    if (this.paperMoveTimeout) {
      clearTimeout(this.paperMoveTimeout);
    }
    
    // Close live preview when component is destroyed
    if (this.livePreviewPopupService.isPreviewOpen()) {
      this.livePreviewPopupService.closePreview();
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    // Close live preview when main window is closing
    if (this.livePreviewPopupService.isPreviewOpen()) {
      this.livePreviewPopupService.closePreview();
    }
  }


  onUngroupAllElements() {
    // Call the canvas component's ungroup method
    if (this.canvasComponent) {
      this.canvasComponent.ungroupAllElements();
      this.elementGroups.clear();
    }
  }

  onUngroupSingleElement(elementId: string) {
    // Call the canvas component's ungroup single element method
    if (this.canvasComponent) {
      this.canvasComponent.ungroupElement(elementId);
    }
  }

  onUngroupGroup(groupId: string) {
    // Call the canvas component's ungroup group method
    if (this.canvasComponent) {
      this.canvasComponent.ungroupGroup(groupId);
    }
  }

  onElementHover(elementId: string | null) {
    // Pass the hover event to the canvas component
    if (this.canvasComponent) {
      this.canvasComponent.onElementHover(elementId);
    }
  }


  // Tool drag start - moved to navigation component
  onToolDragStart(event: DragEvent, toolType: string) {
    if (event.dataTransfer) {
      event.dataTransfer.setData(
        'application/json',
        JSON.stringify({ type: 'tool', toolType })
      );
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  // Template component drag start - moved to navigation component
  onTemplateComponentDragStart(event: DragEvent, componentType: string) {
    if (event.dataTransfer) {
      event.dataTransfer.setData(
        'application/json',
        JSON.stringify({ type: 'template-component', componentType })
      );
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  // Create element directly when tool is clicked
  onCreateElement(toolType: string) {
    // Prevent element creation if not in edit mode
    if (!this.viewingMode.canEdit) {
      return;
    }

    if (this.canvasComponent) {
      // Calculate center position of the paper layout
      // Canvas will handle element positioning
      const centerX = 400; // Default center X
      const centerY = 300; // Default center Y
      
      // Create element at center of paper layout
      this.canvasComponent.createToolElement(toolType, centerX - 75, centerY - 40); // Offset to center the element
    }
  }

  // Placeholder drag start - moved to navigation component
  onPlaceholderDragStart(event: DragEvent, placeholderType: string) {
    if (event.dataTransfer) {
      event.dataTransfer.setData(
        'application/json',
        JSON.stringify({ type: 'placeholder', placeholderType })
      );
      event.dataTransfer.effectAllowed = 'copy';
    }
  }


  // Event handlers for child components
  onCanvasElementsChange(elements: CanvasElement[]) {
    // Defer the change to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.canvasElements = elements;
      
      // Send canvas update to collaboration service if in collaboration mode
      if (this.isCollaborationMode && this.collaborationService.isInSession()) {
        this.sendCanvasStateUpdate();
      }
      
      // Sync element groups from canvas component
      if (this.canvasComponent) {
        this.elementGroups = this.canvasComponent.elementGroups;
      }
      // Update undo/redo state
      this.updateUndoRedoState();
      
      // Update live preview popup if it's open
      if (this.livePreviewPopupService.isPreviewOpen()) {
        const previewData: PreviewData = {
          canvasElements: this.canvasElements,
          paperLayoutWidth: this.getPaperLayoutWidth(),
          paperLayoutHeight: this.getPaperLayoutHeight(),
          paperLayoutLeft: this.getPaperLayoutLeft(),
          paperLayoutTop: this.getPaperLayoutTop(),
          paperWidth: this.getPaperWidth(),
          paperHeight: this.getPaperHeight(),
          paperUnit: this.getPaperUnit(),
          selectedTemplate: this.selectedTemplate,
          isDarkMode: this.isDarkMode
        };
        this.livePreviewPopupService.updatePreviewData(previewData);
      }
      
      this.cdr.detectChanges();
    }, 0);
  }

  onElementGroupsChange(elementGroups: Map<string, any>) {
    this.elementGroups = elementGroups;
  }

  // Undo/Redo Methods

  /**
   * Handle undo action from navbar extension
   */
  onUndo(): void {
    if (this.canvasComponent && this.canvasComponent.undo) {
      this.canvasComponent.undo();
      this.updateUndoRedoState();
    }
  }

  /**
   * Handle redo action from navbar extension
   */
  onRedo(): void {
    if (this.canvasComponent && this.canvasComponent.redo) {
      this.canvasComponent.redo();
      this.updateUndoRedoState();
    }
  }

  /**
   * Update undo/redo button states
   */
  private updateUndoRedoState(): void {
    if (this.canvasComponent) {
      this.canUndo = this.canvasComponent.canUndo || false;
      this.canRedo = this.canvasComponent.canRedo || false;
    }
  }

  onCanvasShowBanner(bannerData: { text: string; kind: 'info' | 'success' | 'warning' | 'error'; duration?: number }) {
    if (this.headerComponent) {
      this.headerComponent.showBanner(bannerData.text, bannerData.kind, bannerData.duration);
    }
  }

  onPaperLayoutResized(dimensions: {
    width: number;
    height: number;
  }) {
    // Convert pixels to inches (96 DPI)
    const widthInches = dimensions.width / 96;
    const heightInches = dimensions.height / 96;
    
    // Update the header component's paper size to Custom and set the dimensions
    if (this.headerComponent) {
      this.headerComponent.setCustomPaperSize(widthInches, heightInches);
    }
    
    // Mark that we're actively resizing to prevent feedback loops
    this.isResizingPaper = true;
    
    // Clear any existing timeout
    if (this.paperResizeTimeout) {
      clearTimeout(this.paperResizeTimeout);
    }
    
    // Throttle paper layout resize updates to prevent feedback loops
    // Only send the final resize result after the user stops resizing
    this.paperResizeTimeout = setTimeout(() => {
      this.isResizingPaper = false;
      
      // Send paper layout resize to collaboration service if in collaboration mode
      if (this.isCollaborationMode && this.collaborationService.isInSession()) {
        // Include both dimensions and current position for complete synchronization
        const resizeData = {
          width: dimensions.width,
          height: dimensions.height,
          left: this.getPaperLayoutLeft(),
          top: this.getPaperLayoutTop()
        };
        console.log('[DESIGNER] Sending final paper layout resize to collaboration:', resizeData);
        this.sendPaperLayoutResizeUpdate(resizeData);
      }
    }, 300); // Wait 300ms after resize stops before sending update
  }

  onSelectedTemplateChange(template: any) {
    this.selectedTemplate = template;
    // Emit to parent component so it can update viewing mode
    this.selectedTemplateChange.emit(template);
  }

  onShowDeleteDialogChange(show: boolean) {
    this.showDeleteDialog = show;
  }

  onElementUpdate(element: CanvasElement) {
    const index = this.canvasElements.findIndex((el) => el.id === element.id);
    if (index !== -1) {
      this.canvasElements[index] = element;
      // Update the selected element reference to keep properties panel visible
      this.selectedElement = element;
      
      // Update live preview popup if it's open
      if (this.livePreviewPopupService.isPreviewOpen()) {
        const previewData: PreviewData = {
          canvasElements: this.canvasElements,
          paperLayoutWidth: this.getPaperLayoutWidth(),
          paperLayoutHeight: this.getPaperLayoutHeight(),
          paperLayoutLeft: this.getPaperLayoutLeft(),
          paperLayoutTop: this.getPaperLayoutTop(),
          paperWidth: this.getPaperWidth(),
          paperHeight: this.getPaperHeight(),
          paperUnit: this.getPaperUnit(),
          selectedTemplate: this.selectedTemplate,
          isDarkMode: this.isDarkMode
        };
        this.livePreviewPopupService.updatePreviewData(previewData);
      }
    }
  }

  onElementDeselect() {
    this.selectedElement = null;
  }

  onLineOrientationChange(elementId: string) {
    // Trigger line orientation animation in canvas component
    if (this.canvasComponent) {
      this.canvasComponent.triggerLineOrientationChangeAnimation(elementId);
    }
  }

  onThemeChange(isDarkMode: boolean) {
    // Theme is now managed by the centralized service
    // This method is kept for backward compatibility with header component
    this.isDarkMode = isDarkMode;
  }

  onClearReferenceLines() {
    // Toggle the signal to trigger change detection in canvas component
    this.clearReferenceLinesSignal = !this.clearReferenceLinesSignal;
  }

  onResetZoom() {
    // Reset zoom level in canvas component
    if (this.canvasComponent) {
      this.canvasComponent.resetZoom();
    }
  }

  onClearGrouping() {
    // Clear all grouping details in canvas component
    if (this.canvasComponent) {
      this.canvasComponent.clearAllGrouping();
    }
    
    // Clear app component grouping state - create new Map to trigger change detection
    this.elementGroups = new Map();
    
    // Clear grouping mode
    this.isGroupingMode = false;
  }

  onResetSmartLayout() {
    // Reset smart layout mode
    this.isSmartLayoutMode = false;
    this.isSmartLayoutPanelVisible = false;
    
    // Reset smart layout settings to defaults
    this.smartLayoutSettings = {
      elementSticking: true,
      rowWiseAdjustment: true,
      heightWiseAdjustment: true,
      alignmentLines: true
    };
    
    // Update smart layout settings in canvas component
    if (this.canvasComponent) {
      this.canvasComponent.updateSmartLayoutSettings(this.smartLayoutSettings);
    }
  }

  // [CHANGE] Handle comment mode changes from header
  onCommentModeChange(isCommentMode: boolean) {
    this.isCommentMode = isCommentMode;
    console.log('[DESIGNER] Comment mode changed:', isCommentMode);
  }

  // Handle collaboration mode changes from header
  async onCollaborationModeChange(isCollaborationMode: boolean) {
    console.log('[DESIGNER] Collaboration mode changed:', isCollaborationMode);
    this.isCollaborationMode = isCollaborationMode;
    
    if (isCollaborationMode) {
      // Enable collaboration mode
      try {
        await this.collaborationService.initializeConnection();
        
        // For collaboration mode, always use the template ID from the current template
        if (!this.selectedTemplate?.templateId) {
          console.error('[DESIGNER] No template selected for collaboration');
          this.showBanner('No template selected for collaboration', 'error');
          this.isCollaborationMode = false;
          return;
        }
        
        const templateId = this.selectedTemplate.templateId;
        const userId = this.getCurrentUserId(); // Get actual user ID
        
        console.log('[DESIGNER] Joining collaboration session for template:', templateId);
        await this.collaborationService.joinSession(templateId, userId);
        
        // Subscribe to collaboration events
        this.setupCollaborationSubscriptions();
        
        // Wait a moment for the session to be fully established
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Send current canvas state to the collaboration session
        // This ensures the existing elements are preserved and shared with other users
        if (this.canvasElements.length > 0) {
          console.log('[DESIGNER] Sending current canvas state to collaboration session');
          this.sendCanvasStateUpdate();
        }
        
        // Note: Canvas state is already received via SessionJoined event
        // No need to request it separately
        
        this.showBanner('Joined collaboration session', 'success');
        
      } catch (error) {
        console.error('[DESIGNER] Failed to enable collaboration mode:', error);
        this.showBanner('Failed to join collaboration session', 'error');
        this.isCollaborationMode = false;
      }
    } else {
      // Disable collaboration mode
      try {
        await this.collaborationService.leaveSession();
        await this.collaborationService.disconnect();
        this.showBanner('Left collaboration session', 'info');
      } catch (error) {
        console.error('[DESIGNER] Failed to disable collaboration mode:', error);
      }
    }
  }

  // Setup subscriptions to collaboration events
  private setupCollaborationSubscriptions(): void {
    // Subscribe to canvas updates from other users
    this.collaborationService.canvasUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(update => {
        this.handleRemoteCanvasUpdate(update);
      });

    // Subscribe to user presence updates
    this.collaborationService.userPresenceUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(update => {
        this.handleUserPresenceUpdate(update);
      });

    // Subscribe to session events
    this.collaborationService.sessionJoined$
      .pipe(takeUntil(this.destroy$))
      .subscribe(response => {
        console.log('[DESIGNER] Successfully joined collaboration session');
        
        // Handle canvas state from session join response
        if (response.currentCanvasState) {
          console.log('[DESIGNER] Received canvas state from session join:', response.currentCanvasState);
          this.handleCanvasStateReceived(response.currentCanvasState);
        }
      });

    this.collaborationService.sessionJoinFailed$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        console.error('[DESIGNER] Failed to join collaboration session:', error);
        // TODO: Show error message to user
      });

    // Subscribe to canvas state received events
    this.collaborationService.canvasStateReceived$
      .pipe(takeUntil(this.destroy$))
      .subscribe(canvasState => {
        this.handleCanvasStateReceived(canvasState);
      });
  }

  // Handle canvas updates from other users
  private handleRemoteCanvasUpdate(update: any): void {
    console.log('[DESIGNER] Handling remote canvas update:', update);
    
    try {
      switch (update.updateType) {
        case 'element_add':
          this.handleRemoteElementAdd(update);
          break;
        case 'element_update':
          this.handleRemoteElementUpdate(update);
          break;
        case 'element_delete':
          this.handleRemoteElementDelete(update);
          break;
        case 'element_move':
          this.handleRemoteElementMove(update);
          break;
        case 'canvas_state_update':
          this.handleRemoteCanvasStateUpdate(update);
          break;
        case 'paper_layout_update':
          this.handleRemotePaperLayoutUpdate(update);
          break;
        case 'paper_layout_resize':
          this.handleRemotePaperLayoutResize(update);
          break;
        default:
          console.warn('[DESIGNER] Unknown canvas update type:', update.updateType);
      }
    } catch (error) {
      console.error('[DESIGNER] Error handling remote canvas update:', error);
    }
  }

  // Handle remote element addition
  private handleRemoteElementAdd(update: any): void {
    if (update.elementData && this.canvasComponent) {
      // Add the element to the canvas
      this.canvasElements.push(update.elementData);
      this.canvasElementsChange.emit(this.canvasElements);
    }
  }

  // Handle remote element update
  private handleRemoteElementUpdate(update: any): void {
    if (update.elementData && this.canvasComponent) {
      const elementIndex = this.canvasElements.findIndex(el => el.id === update.elementId);
      if (elementIndex !== -1) {
        this.canvasElements[elementIndex] = update.elementData;
        this.canvasElementsChange.emit(this.canvasElements);
      }
    }
  }

  // Handle remote element deletion
  private handleRemoteElementDelete(update: any): void {
    if (this.canvasComponent) {
      const elementIndex = this.canvasElements.findIndex(el => el.id === update.elementId);
      if (elementIndex !== -1) {
        this.canvasElements.splice(elementIndex, 1);
        this.canvasElementsChange.emit(this.canvasElements);
      }
    }
  }

  // Handle remote element move
  private handleRemoteElementMove(update: any): void {
    if (update.elementData && this.canvasComponent) {
      const elementIndex = this.canvasElements.findIndex(el => el.id === update.elementId);
      if (elementIndex !== -1) {
        this.canvasElements[elementIndex] = update.elementData;
        this.canvasElementsChange.emit(this.canvasElements);
      }
    }
  }

  // Handle remote canvas state update (full canvas sync)
  private handleRemoteCanvasStateUpdate(update: any): void {
    console.log('[DESIGNER] Handling remote canvas state update:', update);
    
    if (update.elementData && Array.isArray(update.elementData)) {
      // Only update if the received state has elements or if we don't have any elements
      // This prevents clearing existing elements when receiving an empty state
      if (update.elementData.length > 0 || this.canvasElements.length === 0) {
        console.log('[DESIGNER] Updating canvas with remote state. Elements count:', update.elementData.length);
        
        // Update the entire canvas with the received state
        this.canvasElements = [...update.elementData];
        this.canvasElementsChange.emit(this.canvasElements);
        this.updateUndoRedoState();
      } else {
        console.log('[DESIGNER] Ignoring empty remote canvas state to preserve existing elements');
      }
      
      // Apply paper layout position if provided to ensure synchronization
      if (update.paperLayout && this.canvasComponent) {
        console.log('[DESIGNER] Applying paper layout position from remote user:', update.paperLayout);
        
        // Update paper layout position to match the remote user
        this.canvasComponent.paperLayout = {
          left: update.paperLayout.left,
          top: update.paperLayout.top,
          width: update.paperLayout.width,
          height: update.paperLayout.height
        };
        
        // Emit paper layout change to update the UI
        this.canvasComponent.paperLayoutChange.emit({
          left: update.paperLayout.left,
          top: update.paperLayout.top,
          width: update.paperLayout.width,
          height: update.paperLayout.height
        });
      }
      
      console.log('[DESIGNER] Canvas state updated from remote user');
    }
  }

  // Handle user presence updates
  private handleUserPresenceUpdate(update: any): void {
    console.log('[DESIGNER] Handling user presence update:', update);
    // User presence is handled by the UserPresenceComponent
  }

  // Handle remote paper layout position update
  private handleRemotePaperLayoutUpdate(update: any): void {
    console.log('[DESIGNER] Handling remote paper layout update:', update);
    
    // Ignore remote position updates if we're currently moving the paper locally
    // This prevents interference with the user's active drag operation
    if (this.isMovingPaper) {
      console.log('[DESIGNER] Ignoring remote paper layout update - user is actively moving paper');
      return;
    }
    
    if (update.elementData && this.canvasComponent) {
      const layout = update.elementData;
      console.log('[DESIGNER] Applying remote paper layout position:', layout);
      
      // Calculate the delta to move elements with the paper
      const deltaX = layout.left - this.canvasComponent.paperLayoutLeft;
      const deltaY = layout.top - this.canvasComponent.paperLayoutTop;
      
      // Update paper layout position to match the remote user
      this.canvasComponent.paperLayout = {
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height
      };
      
      // Move all elements that are inside the paper layout
      if (deltaX !== 0 || deltaY !== 0) {
        console.log('[DESIGNER] Moving elements with paper layout:', { deltaX, deltaY });
        this.moveElementsWithPaper(deltaX, deltaY);
      }
      
      // Emit paper layout change to update the UI
      this.canvasComponent.paperLayoutChange.emit({
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height
      });
      
      console.log('[DESIGNER] Paper layout position and elements synchronized with remote user');
    }
  }

  // Move elements with paper layout (for collaboration synchronization)
  private moveElementsWithPaper(deltaX: number, deltaY: number): void {
    if (!this.canvasComponent || !this.canvasElements) {
      return;
    }
    
    // Get elements that are inside the paper layout
    const elementsInsidePaper = this.canvasElements.filter(element => 
      this.canvasComponent!.isElementInsidePaper(element)
    );
    
    // Move each element by the same delta as the paper
    elementsInsidePaper.forEach((element) => {
      element.x += deltaX;
      element.y += deltaY;
    });
    
    // Emit the updated canvas elements
    if (elementsInsidePaper.length > 0) {
      this.canvasElementsChange.emit([...this.canvasElements]);
    }
  }

  // Handle remote paper layout resize update
  private handleRemotePaperLayoutResize(update: any): void {
    console.log('[DESIGNER] Handling remote paper layout resize:', update);
    
    // Ignore remote resize updates if we're currently resizing locally
    // This prevents interference with the user's active resize operation
    if (this.isResizingPaper) {
      console.log('[DESIGNER] Ignoring remote paper layout resize - user is actively resizing');
      return;
    }
    
    if (update.elementData && this.canvasComponent) {
      const resizeData = update.elementData;
      console.log('[DESIGNER] Applying remote paper layout resize:', resizeData);
      
      // Update paper layout dimensions and position
      if (this.canvasComponent.paperLayout) {
        this.canvasComponent.paperLayout.width = resizeData.width;
        this.canvasComponent.paperLayout.height = resizeData.height;
        this.canvasComponent.paperLayout.left = resizeData.left;
        this.canvasComponent.paperLayout.top = resizeData.top;
      }
      
      // Emit paper layout change to update both position and dimensions
      this.canvasComponent.paperLayoutChange.emit({
        left: resizeData.left,
        top: resizeData.top,
        width: resizeData.width,
        height: resizeData.height
      });
      
      console.log('[DESIGNER] Paper layout dimensions and position synchronized with remote user');
    }
  }

  // Handle canvas state received from collaboration service
  private handleCanvasStateReceived(canvasState: any): void {
    console.log('[DESIGNER] Canvas state received from collaboration:', canvasState);
    
    if (canvasState && canvasState.elements && Array.isArray(canvasState.elements)) {
      // Only update if the received state has elements or if we don't have any elements
      // This prevents clearing existing elements when receiving an empty state
      if (canvasState.elements.length > 0 || this.canvasElements.length === 0) {
        console.log('[DESIGNER] Updating canvas with received state. Elements count:', canvasState.elements.length);
        
        // Update the entire canvas with the received state
        this.canvasElements = [...canvasState.elements];
        this.canvasElementsChange.emit(this.canvasElements);
        
        // Update undo/redo state
        this.updateUndoRedoState();
      } else {
        console.log('[DESIGNER] Ignoring empty canvas state to preserve existing elements');
      }
      
      // Apply paper layout position if provided in the canvas state
      if (canvasState.paperLayout && this.canvasComponent) {
        console.log('[DESIGNER] Applying paper layout position from canvas state:', canvasState.paperLayout);
        
        // Update paper layout position to match the stored state
        this.canvasComponent.paperLayout = {
          left: canvasState.paperLayout.left,
          top: canvasState.paperLayout.top,
          width: canvasState.paperLayout.width,
          height: canvasState.paperLayout.height
        };
        
        // Emit paper layout change to update the UI
        this.canvasComponent.paperLayoutChange.emit({
          left: canvasState.paperLayout.left,
          top: canvasState.paperLayout.top,
          width: canvasState.paperLayout.width,
          height: canvasState.paperLayout.height
        });
      }
      
      console.log('[DESIGNER] Canvas synchronized with collaboration session');
    }
  }

  // Send canvas state update to collaboration service with throttling
  private sendCanvasStateUpdate(): void {
    if (!this.isCollaborationMode || !this.collaborationService.isInSession()) {
      return;
    }

    // Mark that we have a pending update
    this.pendingCanvasUpdate = true;

    // Clear any existing timeout
    if (this.canvasUpdateTimeout) {
      clearTimeout(this.canvasUpdateTimeout);
    }

    // Throttle canvas updates to prevent too many rapid updates
    // Use longer throttle for canvases with images to reduce payload frequency
    const hasImages = this.canvasElements.some(element => element.type === 'image');
    const throttleTime = hasImages ? 500 : 300; // 500ms for images, 300ms for regular updates
    
    this.canvasUpdateTimeout = setTimeout(() => {
      if (!this.pendingCanvasUpdate) {
        return;
      }

      this.pendingCanvasUpdate = false;
      this.performCanvasStateUpdate();
    }, throttleTime);
  }

  // Send paper layout position update to collaboration service
  private sendPaperLayoutUpdate(layout: {
    left: number;
    top: number;
    width: number;
    height: number;
  }): void {
    if (!this.isCollaborationMode || !this.collaborationService.isInSession()) {
      return;
    }

    const update = {
      elementId: 'paper_layout',
      updateType: 'paper_layout_update',
      elementData: layout,
      operationId: this.generateOperationId(),
      timestamp: new Date()
    };

    this.collaborationService.sendCanvasUpdate(update).catch(error => {
      console.error('[DESIGNER] Failed to send paper layout update:', error);
    });
  }

  // Send paper layout resize update to collaboration service
  private sendPaperLayoutResizeUpdate(resizeData: {
    width: number;
    height: number;
    left: number;
    top: number;
  }): void {
    if (!this.isCollaborationMode || !this.collaborationService.isInSession()) {
      return;
    }

    const update = {
      elementId: 'paper_layout',
      updateType: 'paper_layout_resize',
      elementData: resizeData,
      operationId: this.generateOperationId(),
      timestamp: new Date()
    };

    this.collaborationService.sendCanvasUpdate(update).catch(error => {
      console.error('[DESIGNER] Failed to send paper layout resize update:', error);
    });
  }

  // Perform the actual canvas state update
  private performCanvasStateUpdate(): void {
    // Check if we have image elements that might cause large payloads
    const hasImages = this.canvasElements.some(element => element.type === 'image');
    
    // Send the full canvas state with paper layout position for synchronization
    const update = {
      elementId: 'canvas_state',
      updateType: 'canvas_state_update',
      elementData: this.canvasElements,
      operationId: this.generateOperationId(),
      timestamp: new Date(),
      hasImages: hasImages,
      // Include paper layout position to ensure all users have the same layout
      paperLayout: {
        left: this.getPaperLayoutLeft(),
        top: this.getPaperLayoutTop(),
        width: this.getPaperLayoutWidth(),
        height: this.getPaperLayoutHeight()
      }
    };

    this.collaborationService.sendCanvasUpdate(update).catch(error => {
      console.error('[DESIGNER] Failed to send canvas update:', error);
    });
  }

  // Generate a unique operation ID for conflict resolution
  private generateOperationId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get current user ID from authentication service
  private getCurrentUserId(): number {
    // Get actual user ID from auth service using inject()
    const userInfo = this.authService.getUserInfo();
    if (userInfo && userInfo.user_id) {
      return parseInt(userInfo.user_id, 10);
    }
    
    // Fallback to default user ID if auth service is not available
    console.warn('[DESIGNER] Could not get user ID from auth service, using default');
    return 1;
  }

  // Show banner message
  private showBanner(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
    // Simple banner implementation - you could replace this with a proper toast service
    const bannerEl = document.createElement('div');
    bannerEl.textContent = message;
    bannerEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideInRight 0.3s ease-out;
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(bannerEl);
    
    setTimeout(() => {
      document.body.removeChild(bannerEl);
      document.head.removeChild(style);
    }, 3000);
  }

  // Method to reset theme to default (light mode) - useful for testing
  resetThemeToDefault() {
    localStorage.removeItem('tagit-theme');
    this.isDarkMode = true;
    document.body.classList.add('dark-theme');
  }

  // Smart Layout Panel methods
  onToggleSmartLayoutPanel() {
    this.isSmartLayoutPanelVisible = !this.isSmartLayoutPanelVisible;
  }

  onSmartLayoutSettingsChange(settings: SmartLayoutSettings) {
    this.smartLayoutSettings = { ...settings };
    
    // Pass settings to canvas component if it exists
    if (this.canvasComponent) {
      this.canvasComponent.updateSmartLayoutSettings(this.smartLayoutSettings);
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleGlobalDeleteKey(e: KeyboardEvent) {
    // Only handle Delete (leave Backspace for text editing)
    if (e.key !== 'Delete' && e.key != 'Backspace') return;

    // Don’t delete when the cursor is in an input/textarea/contentEditable
    const t = e.target as HTMLElement | null;
    if (t) {
      const tag = t.tagName?.toLowerCase();
      const editing =
        t.isContentEditable ||
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select';
      if (editing) return;
    }

    // Nothing selected → nothing to do
    if (!this.selectedElement) return;

    e.preventDefault(); // consume the key
    e.stopPropagation();

    // Use your existing delete path
    this.onElementDelete(this.selectedElement.id);

    // (Optional) clear selection on the canvas if you expose a helper
    if (this.canvasComponent?.clearSelection) {
      this.canvasComponent.clearSelection();
    }
  }

  onSelectedElementChange(element: CanvasElement | null) {
    this.selectedElement = element;
  }

  onPaperSizeChange(size: string) {
    this.selectedPaperSize = size;
    // Paper layout calculation is handled by the header component
  }

  onPaperLayoutChange(layout: {
    left: number;
    top: number;
    width: number;
    height: number;
  }) {
    // Canvas-centric approach: canvas manages its own layout
    // This method can be simplified or removed since canvas handles layout internally
    
    // Mark that we're actively moving the paper to prevent feedback loops
    this.isMovingPaper = true;
    
    // Clear any existing timeout
    if (this.paperMoveTimeout) {
      clearTimeout(this.paperMoveTimeout);
    }
    
    // Throttle paper layout position updates to prevent feedback loops
    // Only send the final position after the user stops moving
    this.paperMoveTimeout = setTimeout(() => {
      this.isMovingPaper = false;
      
      // Send paper layout change to collaboration service if in collaboration mode
      if (this.isCollaborationMode && this.collaborationService.isInSession()) {
        console.log('[DESIGNER] Sending final paper layout change to collaboration:', layout);
        this.sendPaperLayoutUpdate(layout);
      }
    }, 200); // Wait 200ms after movement stops before sending update
  }

  onElementDelete(elementId: string) {
    // Prevent element deletion if not in edit mode
    if (!this.viewingMode.canEdit) {
      return;
    }

    // Use the canvas component's deleteElement method to ensure history tracking
    if (this.canvasComponent?.deleteElement) {
      this.canvasComponent.deleteElement(elementId);
    } else {
      // Fallback if canvas component is not available
      this.canvasElements = this.canvasElements.filter(
        (el) => el.id !== elementId
      );
      if (this.selectedElement?.id === elementId) {
        this.selectedElement = null;
      }
    }
  }

  onElementBringToFront() {
    if (this.selectedElement) {
      // Use the canvas component's bringElementToFront method to ensure history tracking
      if (this.canvasComponent?.bringElementToFront) {
        this.canvasComponent.bringElementToFront(this.selectedElement.id);
      } else {
        // Fallback if canvas component is not available
        const elementIndex = this.canvasElements.findIndex(
          (el) => el.id === this.selectedElement!.id
        );

        if (elementIndex !== -1) {
          // Remove the element from its current position
          const element = this.canvasElements.splice(elementIndex, 1)[0];

          // Add it to the end of the array (front layer)
          this.canvasElements.push(element);

          // Angular change detection will automatically update the canvas
        }
      }
    }
  }

  onElementDoubleClick(element: CanvasElement) {
    if (element.type === 'text' && !element.isPlaceholder) {
      element.isPlaceholder = true;
      element.placeholderType = 'company_name';
    }
  }

  onClearAll() {
    // Prevent clearing if not in edit mode
    if (!this.viewingMode.canEdit) {
      return;
    }

    // Clear all grouping details in canvas component
    if (this.canvasComponent) {
      this.canvasComponent.clearAllGrouping();
    }
    
    // Clear app component grouping state - create new Map to trigger change detection
    this.elementGroups = new Map();
    
    // Clear canvas elements and selected element
    this.canvasElements = [];
    this.selectedElement = null;
    
    // Clear grouping mode
    this.isGroupingMode = false;
    
    // Reset paper size to default
    this.selectedPaperSize = 'Pallet Label (6 x 6 in)';
    
    // Canvas-centric approach: canvas will handle its own layout reset
    if (this.canvasComponent) {
      this.canvasComponent.centerPaperLayout();
    }
  }

}
