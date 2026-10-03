import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef, HostListener, input, model, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CanvasElement, HistoryService, HistoryActionFactory, HistoryActionType } from '../../services';
import { ViewingMode, DEFAULT_VIEWING_MODE } from '../../services/viewing-mode.service';
import { PaperLayout, PaperLayoutModel } from '../../models/paper-layout.model';
import { TooltipService, TooltipOptions, TooltipAction } from '../../services/tooltip.service';
import { TooltipDirective } from '../tooltip/tooltip.directive';
import { CommentService, Comment, CreateCommentRequest, UpdateCommentRequest, DeleteCommentRequest } from '../../services/comment.service';

import { ImageImportComponent } from '../image-import/image-import.component';
import { SmartLayoutSettings } from '../smart-layout-panel/smart-layout-panel.model';
import type {
  RulerMark,
  ScaleConfig,
  ElementGroup
} from './canvas.models';

@Component({
    standalone: true,
    selector: 'app-canvas',
    imports: [CommonModule, FormsModule, ImageImportComponent, TooltipDirective],
    templateUrl: './canvas.component.html',
    styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef;

  // Inject services
  private historyService = inject(HistoryService);
  private tooltipService = inject(TooltipService);
  private commentService = inject(CommentService);
  private cdr = inject(ChangeDetectorRef);
  
  // [CHANGE] Reference to header component for updating comment counts
  @Input() headerComponent: any = null;

  // Inputs from parent component
  @Input() canvasElements: CanvasElement[] = [];
  @Input() selectedElement: CanvasElement | null = null;
  @Input() selectedPaperSize: string = 'Pallet Label (6 x 6 in)';
  @Input() isSidebarExpanded: boolean = false;
  @Input() clearReferenceLinesSignal: boolean = false;

  @Input() isGroupingMode: boolean = false;
  @Input() isSmartLayoutMode: boolean = false;
  @Input() viewingMode: ViewingMode = DEFAULT_VIEWING_MODE;
  @Input() isCommentMode: boolean = false; // [CHANGE] Comment mode input
  @Input() currentDesignStateId: number | null = null; // [CHANGE] Current design state ID for comments
  @Input() currentUserId: number = 1; // [CHANGE] Current user ID for comments
  @Input() canResolveComments: boolean = false; // [CHANGE] Can resolve comments (designer mode)

  // Grouping selection properties
  isSelecting = false;
  selectionStart: { x: number; y: number } | null = null;
  selectionRect: { x: number; y: number; width: number; height: number } | null = null;
  elementGroups: Map<string, ElementGroup> = new Map(); // Track multiple groups
  
  // Flag to completely disable document listeners during grouping
  private documentListenersDisabled = false;
  
  // Flag to prevent any element position modifications during grouping
  private elementModificationsBlocked = false;

  // [CHANGE] Comment system properties
  comments: Comment[] = []; // Array to store comments from backend
  showCommentDialog = false;
  commentPosition: { x: number; y: number } | null = null;
  newCommentText = '';
  selectedCommentId: number | null = null;
  editingCommentId: number | null = null;
  
  // [CHANGE] Resolve comment dialog properties
  showResolveCommentDialog = false;
  resolveCommentText = '';
  
  // Store original element positions during grouping to prevent unwanted movements
  private originalElementPositions: { [key: string]: { x: number; y: number } } = {};

  // Context menu properties
  contextMenuVisible = false;
  contextMenuPosition = { x: 0, y: 0 };
  contextMenuElement: CanvasElement | null = null;

  // Hover selection properties
  hoveredElementId: string | null = null;

  // Smart Layout properties
  snapThreshold: number = 10; // pixels
  snapLines: { x?: number; y?: number; type: 'edge' | 'center' }[] = [];
  
  // Smart Layout Settings
  smartLayoutSettings: SmartLayoutSettings = {
    elementSticking: true,
    rowWiseAdjustment: true,
    heightWiseAdjustment: true,
    alignmentLines: true
  };

  // Bubble animation state
  private bubbleAnimationElements: Set<string> = new Set();
  
  // Delete animation state
  private deleteAnimationElements: Set<string> = new Set();
  
  // Bring to front animation state
  private bringToFrontAnimationElements: Set<string> = new Set();
  
  // Line orientation change animation state
  private lineOrientationAnimationElements: Set<string> = new Set();

  // Padding visualization - removed dotted rectangles
  
  // Simple connection line properties
  showConnectionLine = false;
  connectionLine: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null = null;
  

  // Make Math available in template
  Math = Math;

  // Minimum dimensions to ensure elements remain visible in PDF generation
  private readonly MIN_ELEMENT_SIZE = 5; // pixels - general minimum for non-text elements
  private readonly MIN_TEXT_ELEMENT_WIDTH_BASE = 24; // pixels - minimum width for text/textarea elements at font size 16
  
  /**
   * Calculate dynamic minimum width for text elements based on font size
   * Formula: base width * (fontSize / 16) with minimum of 12px
   * @param fontSize The font size of the text element
   * @returns Minimum width in pixels
   */
  private getMinTextElementWidth(fontSize: number = 16): number {
    const minWidth = Math.max(12, this.MIN_TEXT_ELEMENT_WIDTH_BASE * (fontSize / 16));
    return Math.round(minWidth);
  }

  // Outputs to parent component
  @Output() canvasElementsChange = new EventEmitter<CanvasElement[]>();
  @Output() selectedElementChange = new EventEmitter<CanvasElement | null>();
  @Output() paperLayoutChange = new EventEmitter<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>();
  @Output() paperLayoutResized = new EventEmitter<{
    width: number;
    height: number;
  }>();

  @Output() elementGroupsChange = new EventEmitter<Map<string, ElementGroup>>();
  @Output() showBanner = new EventEmitter<{ text: string; kind: 'info' | 'success' | 'warning' | 'error'; duration?: number }>();

  // Undo/Redo properties
  canUndo = false;
  canRedo = false;

  // Canvas state
  selectedTool:
    | 'text'

    | 'textarea'
    | 'rectangle'
    | 'barcode'
    | 'line'

    | 'image'
    | 'template'
    | 'placeholder'
    | null = null;

  // Placeholder dialog state
  showPlaceholderDialog = false;
  currentPlaceholderElement: CanvasElement | null = null;


  // Image import dialog state
  showImageImportDialog = false;
  currentImageElement: CanvasElement | null = null;

  // Zoom properties
  zoomLevel: number = 1.0;
  minZoom: number = 0.5;
  maxZoom: number = 3.0;
  zoomStep: number = 0.25;

  // Paper layout properties - canvas is the single source of truth
  paperLayout: PaperLayoutModel = new PaperLayoutModel();
  private templateDataLoaded: boolean = false;
  
  // Computed properties for backward compatibility
  get paperLayoutWidth(): number { return this.paperLayout.width; }
  set paperLayoutWidth(value: number) { this.paperLayout.width = value; }
  get paperLayoutHeight(): number { return this.paperLayout.height; }
  set paperLayoutHeight(value: number) { this.paperLayout.height = value; }
  get paperLayoutLeft(): number { return this.paperLayout.left; }
  set paperLayoutLeft(value: number) { this.paperLayout.left = value; }
  get paperLayoutTop(): number { return this.paperLayout.top; }
  set paperLayoutTop(value: number) { this.paperLayout.top = value; }

  // Paper layout interaction state
  isPaperLayoutDragging: boolean = false;
  isPaperLayoutResizing: boolean = false;
  paperLayoutDragStartX: number = 0;
  paperLayoutDragStartY: number = 0;
  paperLayoutResizeHandle: string = '';
  paperLayoutOriginalWidth: number = 0;
  paperLayoutOriginalHeight: number = 0;
  paperLayoutOriginalX: number = 0;
  paperLayoutOriginalY: number = 0;

  // Element interaction state
  isDragging: boolean = false;
  isResizing: boolean = false;
  dragStartX: number = 0;
  dragStartY: number = 0;
  dragElement: CanvasElement | null = null;
  resizeHandle: string = '';
  resizeStartX: number = 0;
  
  // History tracking for drag/resize operations
  private dragStartPosition: { x: number; y: number } | null = null;
  private resizeStartDimensions: { width: number; height: number } | null = null;
  
  // History tracking for paper layout operations
  private paperLayoutStartPosition: { x: number; y: number } | null = null;
  private paperLayoutStartDimensions: { width: number; height: number } | null = null;
  resizeStartY: number = 0;
  resizeOriginalWidth: number = 0;
  resizeOriginalHeight: number = 0;
  resizeOriginalX: number = 0;
  resizeOriginalY: number = 0;

  // Rulers
  horizontalMarks: RulerMark[] = [];
  verticalMarks: RulerMark[] = [];

  // Reference lines
  horizontalReferenceLines: number[] = [];
  verticalReferenceLines: number[] = [];

  // Hover preview lines
  hoverPreviewLine: {
    type: 'horizontal' | 'vertical';
    position: number;
  } | null = null;

  ngOnInit() {
    this.initializePaperLayout();
    this.generateRulerMarks();
    this.updateUndoRedoState();
  }

  /**
   * Load template data - canvas becomes the single source of truth for layout and elements
   */
  public loadTemplateData(template: any): void {
    if (template && template.jsonSchema) {
      try {
        const templateData = JSON.parse(template.jsonSchema);
        
        // Mark that template data has been loaded
        this.templateDataLoaded = true;
        
        // Load paper layout first
        this.paperLayout = PaperLayoutModel.fromTemplate(templateData);
        
        // Extract canvas elements from the template data
        let canvasElements: CanvasElement[] = [];
        
        if (templateData.originalElements && Array.isArray(templateData.originalElements)) {
          // Transform originalElements to match CanvasElement interface
          canvasElements = templateData.originalElements.map((element: any) => ({
            id: element.id,
            type: element.type,
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
            unit: element.unit,
            content: element.content,
            fontSize: element.fontSize,
            fontFamily: element.fontFamily,
            color: element.color,
            fontWeight: element.fontWeight,
            fillColor: element.fillColor,
            borderColor: element.borderColor,
            borderWidth: element.borderWidth,
            isPlaceholder: element.isPlaceholder,
            placeholderType: element.placeholderType,
            isTemplateComponent: element.isTemplateComponent,
            templateComponentType: element.templateComponentType
          }));
        } else if (templateData.elements && Array.isArray(templateData.elements)) {
          // Fallback to elements array if originalElements doesn't exist
          canvasElements = templateData.elements.map((element: any) => ({
            id: element.id,
            type: element.type,
            x: element.x,
            y: element.y,
            width: element.w || element.width,
            height: element.h || element.height,
            unit: element.unit,
            content: element.value || element.content,
            fontSize: element.style?.fontSize || element.fontSize,
            fontFamily: element.style?.fontFamily || element.fontFamily,
            color: element.style?.color || element.color,
            fontWeight: element.style?.bold ? 'bold' : element.fontWeight,
            fillColor: element.fillColor,
            borderColor: element.borderColor,
            borderWidth: element.borderThickness || element.borderWidth,
            isPlaceholder: element.isPlaceholder,
            placeholderType: element.placeholderType,
            isTemplateComponent: element.isTemplateComponent,
            templateComponentType: element.templateComponentType
          }));
        }
        
        // Update canvas elements and emit to parent
        this.canvasElements = canvasElements;
        this.canvasElementsChange.emit([...this.canvasElements]);
        
        // Emit paper layout change to parent
        this.paperLayoutChange.emit(this.paperLayout.toObject());
        
      } catch (error) {
        console.error('Error parsing template JSON schema in canvas:', error);
      }
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    // Handle canvas elements changes - ensure minimum size for PDF generation
    if (changes['canvasElements'] && this.canvasElements) {
      this.canvasElements.forEach(element => {
        this.ensureMinimumSize(element);
      });
    }

    // Handle paper size changes
    if (
      changes['selectedPaperSize'] &&
      !changes['selectedPaperSize'].firstChange
    ) {
      this.updatePaperLayoutSize();
    }

    // Handle clear reference lines signal
    if (
      changes['clearReferenceLinesSignal'] &&
      !changes['clearReferenceLinesSignal'].firstChange
    ) {
      if (this.clearReferenceLinesSignal) {
        this.clearAllReferenceLines();
      }
    }

    // Handle paper layout position changes from parent
    if (
      (changes['paperLayoutLeft'] || changes['paperLayoutTop'] || 
       changes['paperLayoutWidth'] || changes['paperLayoutHeight']) &&
      !changes['paperLayoutLeft']?.firstChange &&
      !changes['paperLayoutTop']?.firstChange &&
      !changes['paperLayoutWidth']?.firstChange &&
      !changes['paperLayoutHeight']?.firstChange
    ) {
      // Update internal paper layout properties
      this.paperLayoutLeft = this.paperLayoutLeft;
      this.paperLayoutTop = this.paperLayoutTop;
      this.paperLayoutWidth = this.paperLayoutWidth;
      this.paperLayoutHeight = this.paperLayoutHeight;
    }


    // Clear groupings when exiting grouping mode (optional - uncomment if needed)
    // if (changes['isGroupingMode'] && !this.isGroupingMode && this.groupedElements.size > 0) {
    //   this.clearGroupings();
    // }

    // [CHANGE] Load comments when design state changes (only if actually changed)
    if (changes['currentDesignStateId'] && 
        this.currentDesignStateId && 
        changes['currentDesignStateId'].previousValue !== changes['currentDesignStateId'].currentValue) {
      this.loadComments();
    }

    // Clean up any active paper layout dragging when entering grouping mode
    if (changes['isGroupingMode'] && this.isGroupingMode) {
      // Reset paper layout dragging state
      this.isPaperLayoutDragging = false;
      this.isPaperLayoutResizing = false;
      // Don't disable document listeners or element modifications - we want elements to be movable in grouping mode
    }
  }

  ngAfterViewInit() {
    // ensure wrapper scale & viewScale are in sync at startup
    this.applyZoom(); // zoomLevel starts at 1, but this sets transform + viewScale
    this.updatePixelPhase(); // compute initial phase from actual DOM position
  }

  // Method to update paper layout from parent component (when template is loaded)
  public updatePaperLayout(layout: {
    left: number;
    top: number;
    width: number;
    height: number;
  }) {
    this.paperLayoutLeft = layout.left;
    this.paperLayoutTop = layout.top;
    this.paperLayoutWidth = layout.width;
    this.paperLayoutHeight = layout.height;
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  private updatePaperLayoutSize() {
    // Update paper layout size based on selected size (always, regardless of template data loaded)
    switch (this.selectedPaperSize) {
      case 'Pallet Label (6 x 6 in)':
        this.paperLayout.width = 576; // 6 inches × 96 DPI
        this.paperLayout.height = 576; // 6 inches × 96 DPI
        break;
      case 'Shipping Label (4 x 6 in)':
        this.paperLayout.width = 384; // 4 inches × 96 DPI
        this.paperLayout.height = 576; // 6 inches × 96 DPI
        break;
      case 'Shipping Label (4 x 8 in)':
        this.paperLayout.width = 384; // 4 inches × 96 DPI
        this.paperLayout.height = 768; // 8 inches × 96 DPI
        break;
      case 'Box Label (3 x 5 in)':
        this.paperLayout.width = 288; // 3 inches × 96 DPI
        this.paperLayout.height = 480; // 5 inches × 96 DPI
        break;
        case 'Box Label (2 x 4 in)':
          this.paperLayout.width = 192; // 2 inches × 96 DPI
          this.paperLayout.height = 384; // 4 inches × 96 DPI
          break;
        case 'Pallet Label (6 x 4 in)':
          this.paperLayout.width = 576; // 6 inches × 96 DPI
          this.paperLayout.height = 384; // 4 inches × 96 DPI
          break;
        case 'Inventory Label (1 x 3 in)':
          this.paperLayout.width = 96; // 1 inch × 96 DPI
          this.paperLayout.height = 288; // 3 inches × 96 DPI
          break;
        case 'Inventory Label (1.5 x 1 in)':
          this.paperLayout.width = 144; // 1.5 inches × 96 DPI
          this.paperLayout.height = 96; // 1 inch × 96 DPI
          break;
        case 'Round Label (2 in Ø)':
          this.paperLayout.width = 192; // 2 inches × 96 DPI
          this.paperLayout.height = 192; // 2 inches × 96 DPI
          break;
        case 'Round Label (3 in Ø)':
          this.paperLayout.width = 288; // 3 inches × 96 DPI
          this.paperLayout.height = 288; // 3 inches × 96 DPI
          break;
        case 'Address Label (1 x 2.625 in)':
          this.paperLayout.width = 96; // 1 inch × 96 DPI
          this.paperLayout.height = 252; // 2.625 inches × 96 DPI
          break;
        case 'A4':
          this.paperLayout.width = 794; // A4 width in pixels at 96 DPI
          this.paperLayout.height = 1123; // A4 height in pixels at 96 DPI
          break;
        case 'Letter':
          this.paperLayout.width = 816; // Letter width in pixels at 96 DPI
          this.paperLayout.height = 1056; // Letter height in pixels at 96 DPI
          break;
        case 'Custom':
          // Don't change dimensions for Custom - user has already set them via resizing
          // Just keep the current dimensions
          break;
      }

      // Center the paper layout only if it's not Custom (user has already positioned it)
      if (this.selectedPaperSize !== 'Custom') {
        this.centerPaperLayout();
      }

      // Emit the paper layout position to parent
      this.paperLayoutChange.emit({
        left: this.paperLayoutLeft,
        top: this.paperLayoutTop,
        width: this.paperLayoutWidth,
        height: this.paperLayoutHeight,
      });
    }

  private initializePaperLayout() {
    // Only initialize and center if no template data has been loaded
    if (!this.templateDataLoaded) {
      this.updatePaperLayoutSize();
    }
  }

  private centerPaperLayout() {
    // Calculate centered position based on canvas container
    // We'll use a reasonable default for now, but this should be updated
    // when the canvas container dimensions are available
    const canvasWidth = 1200; // Default canvas width
    const canvasHeight = 800; // Default canvas height

    this.paperLayout.left = Math.max(
      0,
      (canvasWidth - this.paperLayout.width) / 2
    );
    this.paperLayout.top = Math.max(
      0,
      (canvasHeight - this.paperLayout.height) / 2
    );

  }

  private generateRulerMarks() {
    // Static scale configuration - fixed pixel intervals
    const config = this.getScaleConfig();
    const maxRange = this.calculateMaxRange();

    // Generate horizontal ruler marks
    this.horizontalMarks = [];
    for (let i = 0; i <= maxRange; i += config.subMinorStep) {
      let markType: 'major' | 'minor' | 'sub-minor' = 'sub-minor';
      let isMajor = false;

      if (i % config.majorStep === 0) {
        markType = 'major';
        isMajor = true;
      } else if (i % config.minorStep === 0) {
        markType = 'minor';
      }

      this.horizontalMarks.push({
        position: i,
        label: '', // No numbers
        isMajor: isMajor,
        markType: markType,
      });
    }

    // Generate vertical ruler marks
    this.verticalMarks = [];
    for (let i = 0; i <= maxRange; i += config.subMinorStep) {
      let markType: 'major' | 'minor' | 'sub-minor' = 'sub-minor';
      let isMajor = false;

      if (i % config.majorStep === 0) {
        markType = 'major';
        isMajor = true;
      } else if (i % config.minorStep === 0) {
        markType = 'minor';
      }

      this.verticalMarks.push({
        position: i,
        label: '', // No numbers
        isMajor: isMajor,
        markType: markType,
      });
    }
  }

  private getScaleConfig(): ScaleConfig {
    // Static configuration - fixed pixel intervals regardless of zoom or unit
    return {
      majorStep: 100, // Major marks every 100px
      minorStep: 50, // Minor marks every 50px
      subMinorStep: 10, // Sub-minor marks every 10px
      majorMultiple: 100,
    };
  }

  private calculateMaxRange(): number {
    // Static range - fixed regardless of zoom level
    return 2000;
  }

  // Canvas event handlers
  onCanvasDragOver(event: DragEvent) {
    event.preventDefault();

    // Add visual feedback
    const canvasContainer = this.canvasRef.nativeElement.parentElement;
    if (canvasContainer) {
      canvasContainer.classList.add('drag-over');
    }
  }

  onCanvasDragLeave(event: DragEvent) {
    // Only remove visual feedback if we're actually leaving the canvas area
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      const canvasContainer = canvas.parentElement;
      if (canvasContainer) {
        canvasContainer.classList.remove('drag-over');
      }
    }
  }

  onCanvasDrop(event: DragEvent) {
    event.preventDefault();

    // Remove visual feedback
    const canvasContainer = this.canvasRef.nativeElement.parentElement;
    if (canvasContainer) {
      canvasContainer.classList.remove('drag-over');
    }

    // Try to get JSON data first (for all drag types)
    const jsonData = event.dataTransfer?.getData('application/json');
    if (jsonData) {
      try {
        const data = JSON.parse(jsonData);
        const rect = this.canvasRef.nativeElement.getBoundingClientRect();

        const x = event.clientX - rect.left - 20; // Adjust for rulers (20px ruler size)
        const y = event.clientY - rect.top - 20;

        this.handleDropData(data, x, y);
      } catch (e) {
        console.error('Error parsing drag data:', e);
      }
    }
  }

  private handleDropData(data: any, x: number, y: number) {
    switch (data.type) {
      case 'tool':
        this.createToolElement(data.toolType, x, y);
        break;
      case 'template-component':
        this.createTemplateComponent(data.componentType, x, y);
        break;
      case 'placeholder':
        this.createPlaceholderElement(data.placeholderType, x, y);
        break;
    }
  }

  createToolElement(toolType: string, x: number, y: number) {
    const element: CanvasElement = {
      id: this.generateId(),
      type: toolType as any,
      x: Math.max(0, x),
      y: Math.max(0, y),
      width:
        toolType === 'text'
          ? 100

          : toolType === 'textarea'
          ? 150
          : toolType === 'barcode'
          ? 200

          : toolType === 'qr'
          ? 100
          : toolType === 'line'
          ? 100

          : toolType === 'image'
          ? 150
          : 150,
      height:
        toolType === 'text'
          ? 30

          : toolType === 'textarea'
          ? 80
          : toolType === 'barcode'
          ? 60

          : toolType === 'qr'
          ? 100
          : toolType === 'line'
          ? 8

          : toolType === 'image'
          ? 150
          : 100,
      content:
        toolType === 'text'
          ? 'Text'

          : toolType === 'textarea'
          ? 'Textarea content'
          : toolType === 'barcode'

          ? this.generateUniquePlaceholder('barcodeData')
          : toolType === 'qr'
          ? this.generateUniquePlaceholder('qrData')
          : toolType === 'image'
          ? 'Image'
          : '',
      fontSize: 16,

      fontFamily: toolType === 'text' || toolType === 'textarea' ? 'Arial' : undefined, // Default font family for text elements
      color: toolType === 'barcode' ? '#3b82f6' : toolType === 'qr' ? '#3b82f6' : '#000000', // Blue color for barcode and QR placeholders
      fillColor: toolType === 'rectangle' ? '#ffffff' : undefined,
      borderColor: toolType === 'rectangle' ? '#000000' : undefined,
      borderWidth: toolType === 'rectangle' ? 1 : undefined,
      // Barcode-specific properties
      barcodeType: toolType === 'barcode' ? 'code128' : undefined,

      // QR code-specific properties
      qrType: toolType === 'qr' ? 'text' : undefined,
      // Line-specific properties
      lineLength: toolType === 'line' ? 100 : undefined,
      lineAngle: toolType === 'line' ? 0 : undefined, // 0 degrees = horizontal
      lineColor: toolType === 'line' ? '#000000' : undefined,
       lineWidth: toolType === 'line' ? 1 : undefined,

      // Image-specific properties
      imageSrc: toolType === 'image' ? '' : undefined,
      imageName: toolType === 'image' ? 'No image selected' : undefined,
      imageWidth: toolType === 'image' ? 150 : undefined,
      imageHeight: toolType === 'image' ? 150 : undefined,
      // Textarea-specific properties
      rows: toolType === 'textarea' ? 4 : undefined,
      cols: toolType === 'textarea' ? 20 : undefined,
      placeholder: toolType === 'textarea' ? 'Enter text...' : undefined,
    };

    // Ensure minimum size for PDF generation visibility
    this.ensureMinimumSize(element);

    // Add to history before adding to canvas
    this.addToHistory(HistoryActionFactory.createAddElementAction(element));

    this.canvasElements.push(element);
    this.selectedElement = element;
    this.canvasElementsChange.emit([...this.canvasElements]);
    this.selectedElementChange.emit(element);

    // Trigger bubble animation for the newly created element
    this.triggerBubbleAnimation(element.id);

    // If it's an image element, show the image import dialog
    if (toolType === 'image') {
      this.currentImageElement = element;
      this.showImageImportDialog = true;
    }
  }

  private createTemplateComponent(componentType: string, x: number, y: number) {
    const element: CanvasElement = {
      id: this.generateId(),
      type: 'text',
      x: x - 50,
      y: y - 15,
      width: 100,
      height: 30,
      content: this.getTemplateComponentContent(componentType),
      fontSize: 16,
      color: '#3b82f6',
      isTemplateComponent: true,
      templateComponentType: componentType,
    };

    // Ensure minimum size for PDF generation visibility
    this.ensureMinimumSize(element);

    // Add to history before adding to canvas
    this.addToHistory(HistoryActionFactory.createAddElementAction(element));

    this.canvasElements.push(element);
    this.selectedElement = element;
    this.canvasElementsChange.emit([...this.canvasElements]);
    this.selectedElementChange.emit(element);

    // Trigger bubble animation for the newly created element
    this.triggerBubbleAnimation(element.id);
  }

  private createPlaceholderElement(
    placeholderType: string,
    x: number,
    y: number
  ) {
    const element: CanvasElement = {
      id: this.generateId(),
      type: 'text',
      x: x - 50,
      y: y - 15,
      width: 100,
      height: 30,
      content: `[${placeholderType}]`,
      fontSize: 16,
      color: '#3b82f6',
      isPlaceholder: true,
      placeholderType: placeholderType,
    };

    // Ensure minimum size for PDF generation visibility
    this.ensureMinimumSize(element);

    // Add to history before adding to canvas
    this.addToHistory(HistoryActionFactory.createAddElementAction(element));

    this.canvasElements.push(element);
    this.selectedElement = element;
    this.canvasElementsChange.emit([...this.canvasElements]);
    this.selectedElementChange.emit(element);

    // Trigger bubble animation for the newly created element
    this.triggerBubbleAnimation(element.id);
  }

  private getTemplateComponentContent(componentType: string): string {
    const contentMap: { [key: string]: string } = {
      'company-name': '[Company Name]',
      'product-name': '[Product Name]',
      price: '[Price]',
      date: '[Date]',
      sku: '[SKU]',
    };
    return contentMap[componentType] || `[${componentType}]`;
  }

  onCanvasClick(event: MouseEvent) {
    // [CHANGE] Handle comment mode first - but only allow adding comments for reviewers
    if (this.isCommentMode) {
      // Only allow adding new comments if user is not in designer view mode (canResolveComments = true means designer view mode)
      if (!this.canResolveComments) {
        this.handleCommentModeClick(event);
      }
      // If canResolveComments is true, designer is in view mode and cannot add new comments
      return;
    }

    // Map screen → canvas coordinates (account for CSS zoom)
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scale = this.zoomLevel || 1;

    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;

    const clickedElement = this.getElementAtPosition(x, y);
    if (clickedElement) {
      // Only select the element visually, don't open properties panel
      this.selectedElement = clickedElement;
      // Don't emit selectedElementChange to avoid opening properties panel
    } else {
      // Deselect when clicking on empty canvas
      this.selectedElement = null;
      this.selectedElementChange.emit(null);
    }
  }

  onCanvasDoubleClick(event: MouseEvent) {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scale = this.zoomLevel || 1;

    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;

    const clickedElement = this.getElementAtPosition(x, y);

    if (clickedElement && (clickedElement.type === 'text' || clickedElement.type === 'textarea')) {
      this.showPlaceholderDialog = true;
      this.currentPlaceholderElement = clickedElement;
      event.stopPropagation();
    }
  }

  // [CHANGE] Handle comment mode click - converts canvas coordinates to paper-relative coordinates
  handleCommentModeClick(event: MouseEvent) {
    // Ensure paper layout is properly initialized
    if (!this.paperLayout || !this.paperLayout.isValid()) {
      console.warn('[CANVAS] Paper layout not initialized, initializing now');
      this.initializePaperLayout();
    }

    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scale = this.zoomLevel || 1;

    // Get canvas-relative coordinates (this accounts for any canvas area margins/positioning)
    const canvasX = (event.clientX - rect.left) / scale;
    const canvasY = (event.clientY - rect.top) / scale;

    // Convert to paper-relative coordinates
    const paperRelativeX = canvasX - this.paperLayoutLeft;
    const paperRelativeY = canvasY - this.paperLayoutTop;

    // Validate that the click is within the paper bounds
    // Check if paper layout dimensions are valid first
    if (!this.paperLayoutWidth || !this.paperLayoutHeight || 
        this.paperLayoutWidth <= 0 || this.paperLayoutHeight <= 0) {
      console.warn('[CANVAS] Paper layout dimensions are invalid:', {
        width: this.paperLayoutWidth,
        height: this.paperLayoutHeight
      });
      this.showBanner.emit({ 
        text: 'Paper layout not ready. Please try again.', 
        kind: 'warning',
        duration: 3000
      });
      return;
    }

    if (paperRelativeX < 0 || paperRelativeX >= this.paperLayoutWidth || 
        paperRelativeY < 0 || paperRelativeY >= this.paperLayoutHeight) {
      console.warn('[CANVAS] Click outside paper bounds:', {
        eventClientX: event.clientX,
        eventClientY: event.clientY,
        canvasRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        canvasX,
        canvasY,
        paperRelativeX,
        paperRelativeY,
        paperLeft: this.paperLayoutLeft,
        paperTop: this.paperLayoutTop,
        paperWidth: this.paperLayoutWidth,
        paperHeight: this.paperLayoutHeight
      });
      this.showBanner.emit({ 
        text: 'Please click within the paper area to add a comment.', 
        kind: 'warning',
        duration: 3000
      });
      return;
    }

    // Store the paper-relative position for the comment
    this.commentPosition = { x: paperRelativeX, y: paperRelativeY };
    this.newCommentText = '';
    this.showCommentDialog = true;
  }

  onPlaceholderDialogClose() {
    this.showPlaceholderDialog = false;
    this.currentPlaceholderElement = null;
  }

  // [CHANGE] Comment management methods
  loadComments() {
    if (!this.currentDesignStateId) {
      console.warn('[CANVAS] No design state ID available for loading comments');
      return;
    }

    this.commentService.getCommentsByDesignStateId(this.currentDesignStateId)
      .subscribe({
        next: (backendComments) => {
          // [FIX] Only merge if we don't have recent local changes
          // This prevents overriding local resolution changes
          if (!this.hasRecentLocalChanges()) {
            this.comments = this.mergeCommentsWithLocalChanges(backendComments);
          }
          
          // [CHANGE] Force change detection to update UI
          this.cdr.detectChanges();
          
          // [CHANGE] Update comment counts in header
          this.updateCommentCounts();
        },
        error: (error) => {
          console.error('[CANVAS] Error loading comments:', error);
          this.comments = []; // Fallback to empty array
          
          // [CHANGE] Force change detection to update UI
          this.cdr.detectChanges();
          
          this.updateCommentCounts();
          this.showBanner.emit({ text: 'Failed to load comments. Please refresh the page.', kind: 'error' });
        }
      });
  }

  // [CHANGE] Update comment counts in header
  private updateCommentCounts(): void {
    if (this.headerComponent) {
      this.headerComponent.setCommentCount(this.comments.length);
      this.headerComponent.setUnresolvedCommentCount(this.getUnresolvedCommentCount());
    }
  }

  // [CHANGE] Get count of unresolved comments
  private getUnresolvedCommentCount(): number {
    return this.comments.filter(comment => !comment.isResolved).length;
  }

  // [FIX] Check if we have recent local changes that shouldn't be overridden
  private hasRecentLocalChanges(): boolean {
    // Check if any comment was recently resolved (within last 5 seconds)
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    return this.comments.some(comment => 
      comment.isResolved && 
      comment.resolvedAt && 
      new Date(comment.resolvedAt) > fiveSecondsAgo
    );
  }

  // [CHANGE] TrackBy function for comment @for loop to ensure proper change detection
  trackCommentBy(index: number, comment: Comment): string {
    const trackValue = `${comment.commentId}-${comment.isResolved}`;
    return trackValue;
  }

  // [CHANGE] Merge backend comments with local changes to preserve user actions
  private mergeCommentsWithLocalChanges(backendComments: Comment[]): Comment[] {
    // Create a map of local comments by ID for quick lookup
    const localCommentsMap = new Map(this.comments.map(c => [c.commentId, c]));
        
    // Merge backend comments with local changes
    const mergedComments = backendComments.map(backendComment => {
      const localComment = localCommentsMap.get(backendComment.commentId);
      if (localComment) {
        // Preserve local changes (like isResolved) if they exist and are more recent
        const mergedComment = {
          ...backendComment,
          // Preserve local resolution state if it exists
          isResolved: localComment.isResolved,
          resolvedAt: localComment.resolvedAt,
          resolvedBy: localComment.resolvedBy,
          responseText: localComment.responseText
        };
        console.log(`[CANVAS] Merged comment ${backendComment.commentId}:`, mergedComment);
        return mergedComment;
      }
      return backendComment;
    });
    
    console.log('[CANVAS] Final merged comments:', mergedComments);
    return mergedComments;
  }

  addComment() {
    console.log('[CANVAS] addComment called:', {
      commentPosition: this.commentPosition,
      newCommentText: this.newCommentText,
      currentDesignStateId: this.currentDesignStateId,
      currentUserId: this.currentUserId
    });

    if (!this.commentPosition || !this.newCommentText.trim()) {
      console.warn('[CANVAS] Missing comment position or text');
      this.showBanner.emit({ 
        text: 'Please enter a comment before saving.', 
        kind: 'warning',
        duration: 3000
      });
      return;
    }

    if (!this.currentDesignStateId) {
      console.warn('[CANVAS] No currentDesignStateId available, using fallback approach');
      this.showBanner.emit({ 
        text: 'Unable to save comment. Please try again.', 
        kind: 'error',
        duration: 4000
      });
      // Fallback: create comment locally for now
      this.createLocalComment();
      return;
    }

    if (this.editingCommentId) {
      // Update existing comment
      // commentPosition already contains paper-relative coordinates from handleCommentModeClick
      const updateRequest: UpdateCommentRequest = {
        commentId: this.editingCommentId,
        commentText: this.newCommentText.trim(),
        positionX: this.commentPosition.x,  // Already paper-relative from handleCommentModeClick
        positionY: this.commentPosition.y,  // Already paper-relative from handleCommentModeClick
        paperLayoutLeft: this.paperLayoutLeft,    // [KEEP] Paper layout context for backend
        paperLayoutTop: this.paperLayoutTop,      // [KEEP] Paper layout context for backend
        paperLayoutWidth: this.paperLayoutWidth,  // [KEEP] Paper layout context for backend
        paperLayoutHeight: this.paperLayoutHeight, // [KEEP] Paper layout context for backend
        updatedBy: this.currentUserId
      };

      this.commentService.updateComment(this.editingCommentId, updateRequest)
        .subscribe({
          next: (updatedComment) => {
            const index = this.comments.findIndex(c => c.commentId === this.editingCommentId);
            if (index !== -1) {
              // [FIX] Use immutability pattern to ensure Angular change detection
              this.comments = this.comments.map((comment, i) => 
                i === index ? updatedComment : comment
              );
              this.updateCommentCounts();
            }
            console.log('[CANVAS] Comment updated:', updatedComment);
            this.closeCommentDialog();
            this.showBanner.emit({ text: 'Comment updated successfully!', kind: 'success' });
          },
          error: (error) => {
            console.error('[CANVAS] Error updating comment:', error);
            this.showBanner.emit({ text: 'Failed to update comment. Please try again.', kind: 'error' });
          }
        });
    } else {
      // Create new comment
      // commentPosition already contains paper-relative coordinates from handleCommentModeClick
      const createRequest: CreateCommentRequest = {
        designStateId: this.currentDesignStateId,
        commentText: this.newCommentText.trim(),
        positionX: this.commentPosition.x,  // Already paper-relative from handleCommentModeClick
        positionY: this.commentPosition.y,  // Already paper-relative from handleCommentModeClick
        paperLayoutLeft: this.paperLayoutLeft,    // [KEEP] Paper layout context for backend
        paperLayoutTop: this.paperLayoutTop,      // [KEEP] Paper layout context for backend
        paperLayoutWidth: this.paperLayoutWidth,  // [KEEP] Paper layout context for backend
        paperLayoutHeight: this.paperLayoutHeight, // [KEEP] Paper layout context for backend
        createdBy: this.currentUserId
      };

      console.log('[CANVAS] Creating comment with request:', createRequest);

      // Validate required fields before sending request
      if (!createRequest.designStateId || createRequest.designStateId <= 0) {
        console.error('[CANVAS] Invalid designStateId:', createRequest.designStateId);
        this.showBanner.emit({ 
          text: 'Invalid template state. Please refresh and try again.', 
          kind: 'error',
          duration: 4000
        });
        return;
      }

      if (!createRequest.createdBy || createRequest.createdBy <= 0) {
        console.error('[CANVAS] Invalid createdBy:', createRequest.createdBy);
        this.showBanner.emit({ 
          text: 'User not authenticated. Please login again.', 
          kind: 'error',
          duration: 4000
        });
        return;
      }

      if (isNaN(createRequest.positionX) || isNaN(createRequest.positionY)) {
        console.error('[CANVAS] Invalid position coordinates:', { x: createRequest.positionX, y: createRequest.positionY });
        this.showBanner.emit({ 
          text: 'Invalid comment position. Please try clicking again.', 
          kind: 'error',
          duration: 4000
        });
        return;
      }

      this.commentService.createComment(createRequest)
        .subscribe({
          next: (newComment) => {
            // [FIX] Use immutability pattern to ensure Angular change detection
            this.comments = [...this.comments, newComment];
            this.updateCommentCounts();
            console.log('[CANVAS] Comment created:', newComment);
            this.closeCommentDialog();
            this.showBanner.emit({ text: 'Comment added successfully!', kind: 'success' });
          },
          error: (error) => {
            console.error('[CANVAS] Error creating comment:', error);
            this.showBanner.emit({ text: 'Failed to add comment. Please try again.', kind: 'error' });
          }
        });
    }
  }

  private closeCommentDialog() {
    this.showCommentDialog = false;
    this.commentPosition = null;
    this.newCommentText = '';
    this.editingCommentId = null;
  }

  // [CHANGE] Fallback method to create comment locally when backend is not available
  private createLocalComment() {
    // Convert canvas position to paper-relative coordinates for local comment
    const paperRelativeX = this.commentPosition!.x - this.paperLayoutLeft;
    const paperRelativeY = this.commentPosition!.y - this.paperLayoutTop;
    
    const comment = {
      commentId: Date.now(), // Temporary ID
      designStateId: 0, // Placeholder
      commentText: this.newCommentText.trim(),
      positionX: paperRelativeX,  // Paper-relative position
      positionY: paperRelativeY,  // Paper-relative position
      paperLayoutLeft: this.paperLayoutLeft,    // [KEEP] Paper layout context for backend
      paperLayoutTop: this.paperLayoutTop,      // [KEEP] Paper layout context for backend
      paperLayoutWidth: this.paperLayoutWidth,  // [KEEP] Paper layout context for backend
      paperLayoutHeight: this.paperLayoutHeight, // [KEEP] Paper layout context for backend
      createdBy: this.currentUserId,
      createdByName: 'Current User',
      createdAt: new Date(),
      updatedAt: undefined,
      updatedBy: undefined,
      updatedByName: undefined,
      isResolved: false,
      resolvedAt: undefined,
      resolvedBy: undefined,
      resolvedByName: undefined,
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
      deletedByName: undefined
    };

    this.comments.push(comment);
    console.log('[CANVAS] Comment created locally with paper-relative position:', { x: paperRelativeX, y: paperRelativeY });
    this.closeCommentDialog();
  }

  cancelComment() {
    this.closeCommentDialog();
  }

  deleteComment(commentId: number) {
    const deleteRequest: DeleteCommentRequest = {
      commentId: commentId
    };

    this.commentService.deleteComment(commentId, deleteRequest)
      .subscribe({
        next: () => {
          this.comments = this.comments.filter(c => c.commentId !== commentId);
          if (this.selectedCommentId === commentId) {
            this.selectedCommentId = null;
          }
          this.updateCommentCounts();
          this.cdr.detectChanges();
          console.log('[CANVAS] Comment deleted:', commentId);
          this.showBanner.emit({ text: 'Comment deleted successfully!', kind: 'success' });
        },
        error: (error) => {
          console.error('[CANVAS] Error deleting comment:', error);
          this.showBanner.emit({ text: 'Failed to delete comment. Please try again.', kind: 'error' });
        }
      });
  }

  // [CHANGE] Resolve comment method for designer mode
  resolveComment(comment: Comment) {
    console.log('[CANVAS] Resolving comment:', comment.commentId);
    // Show resolve dialog
    this.showResolveDialog(comment);
  }

  // [CHANGE] Show resolve dialog
  showResolveDialog(comment: Comment) {
    this.selectedCommentId = comment.commentId;
    this.showResolveCommentDialog = true;
    this.resolveCommentText = '';
    console.log('[CANVAS] Showing resolve dialog for comment:', comment.commentId);
  }

  // [CHANGE] Cancel resolve comment
  cancelResolveComment() {
    this.showResolveCommentDialog = false;
    this.resolveCommentText = '';
    this.selectedCommentId = null;
    console.log('[CANVAS] Resolve comment cancelled');
  }

  // [CHANGE] Confirm resolve comment
  confirmResolveComment() {
    if (!this.selectedCommentId) {
      console.error('[CANVAS] No comment selected for resolution');
      return;
    }

    const resolveRequest = {
      commentId: this.selectedCommentId,
      resolvedBy: this.currentUserId,
      responseText: this.resolveCommentText.trim() || undefined
    };

    this.commentService.resolveComment(this.selectedCommentId, resolveRequest)
      .subscribe({
        next: () => {
          // Store the comment ID before clearing it
          const resolvedCommentId = this.selectedCommentId;
          
          // Update the comment in the local array
          const commentIndex = this.comments.findIndex(c => c.commentId === resolvedCommentId);
          
          if (commentIndex !== -1) {
            // [FIX] Force complete re-render by temporarily clearing and restoring comments
            const updatedComments = this.comments.map((comment, index) => 
              index === commentIndex 
                ? { 
                    ...comment, 
                    isResolved: true, 
                    resolvedAt: new Date(), 
                    resolvedBy: this.currentUserId, 
                    responseText: this.resolveCommentText.trim() || undefined 
                  }
                : comment
            );
            
            // [FIX] Use simple immutability pattern with change detection
            this.comments = updatedComments;
            this.cdr.detectChanges();
          }
          
          this.showResolveCommentDialog = false;
          this.resolveCommentText = '';
          this.selectedCommentId = null;
          
          // [CHANGE] Update comment counts after resolving
          this.updateCommentCounts();
          
          
          // [DEBUG] Force change detection to ensure template updates
          this.cdr.detectChanges();
          
          this.showBanner.emit({ text: 'Comment resolved successfully!', kind: 'success' });
        },
        error: (error) => {
          console.error('[CANVAS] Error resolving comment:', error);
          this.showBanner.emit({ text: 'Failed to resolve comment.', kind: 'error' });
        }
      });
  }

  toggleCommentDetails(commentId: number) {
    this.selectedCommentId = this.selectedCommentId === commentId ? null : commentId;
  }

  // [CHANGE] Show comment tooltip on hover - simplified to show only comment text
  showCommentTooltip(comment: Comment, event: MouseEvent) {
    const target = event.target as HTMLElement;
    
    const tooltipOptions: TooltipOptions = {
      text: comment.commentText,
      position: 'auto',
      maxWidth: 250,
      theme: 'light',
      delay: 300 // Small delay for hover
    };

    this.tooltipService.showTooltip(target, tooltipOptions);
  }

  // [CHANGE] Hide comment tooltip on mouse leave
  hideCommentTooltip() {
    this.tooltipService.hideTooltip();
  }

  // [CHANGE] Edit comment method - converts paper-relative to canvas coordinates for editing
  editComment(comment: Comment) {
    // Convert paper-relative position to current canvas position for editing
    // The edit dialog needs to show the comment at the current canvas position
    this.commentPosition = { 
      x: comment.positionX + this.paperLayoutLeft, 
      y: comment.positionY + this.paperLayoutTop 
    };
    this.newCommentText = comment.commentText;
    this.showCommentDialog = true;
    this.editingCommentId = comment.commentId;
  }

  onPlaceholderDialogSubmit(placeholderType: string) {
    if (this.currentPlaceholderElement) {
      // Convert to placeholder using {{}} syntax
      this.currentPlaceholderElement.content = `{{${placeholderType}}}`;
      this.currentPlaceholderElement.color = '#3b82f6';

      this.currentPlaceholderElement.isPlaceholder = true;
      this.currentPlaceholderElement.placeholderType = placeholderType;

      this.canvasElementsChange.emit([...this.canvasElements]);
    }

    this.showPlaceholderDialog = false;
    this.currentPlaceholderElement = null;
  }

  private getElementAtPosition(x: number, y: number): CanvasElement | null {
    // Check elements in reverse order (top to bottom) to find the topmost one
    for (let i = this.canvasElements.length - 1; i >= 0; i--) {
      const element = this.canvasElements[i];

      // Check if click is within element bounds
      if (
        x >= element.x &&
        x <= element.x + element.width &&
        y >= element.y &&
        y <= element.y + element.height
      ) {
        return element;
      }
    }
    return null;
  }

  // Element interaction methods
  startDrag(element: CanvasElement, event: MouseEvent) {
    // Prevent dragging if not in edit mode
    if (!this.viewingMode.canEdit) {
      return;
    }

    // Allow dragging elements even in grouping mode - only paper layout is disabled
    
    // Clear any ongoing grouping selection
    this.isSelecting = false;
    this.selectionStart = null;
    this.selectionRect = null;
    
    event.stopPropagation();
    event.preventDefault(); // Prevent default behavior
    
    this.isDragging = true;
    this.dragElement = element;
    this.dragStartX = event.clientX - element.x;
    this.dragStartY = event.clientY - element.y;

    // Store initial position for history tracking
    this.dragStartPosition = { x: element.x, y: element.y };

    // Select the element visually, but don't open properties panel
    this.selectedElement = element;
    // Don't emit selectedElementChange to avoid opening properties panel
  }

  startResize(element: CanvasElement, handle: string, event: MouseEvent) {
    // Prevent resizing if not in edit mode
    if (!this.viewingMode.canEdit) {
      return;
    }

    // Clear any ongoing grouping selection
    this.isSelecting = false;
    this.selectionStart = null;
    this.selectionRect = null;
    
    event.stopPropagation();
    this.isResizing = true;
    this.resizeHandle = handle;
    this.resizeStartX = event.clientX;
    this.resizeStartY = event.clientY;
    this.resizeOriginalWidth = element.width;
    this.resizeOriginalHeight = element.height;
    this.resizeOriginalX = element.x;
    this.resizeOriginalY = element.y;

    // Store initial dimensions for history tracking
    this.resizeStartDimensions = { width: element.width, height: element.height };

    // For line elements, store the original lineLength
    if (element.type === 'line') {
      (element as any).originalLineLength = element.lineLength || 100;
    }


    // Store original dimensions for all elements in the group (if grouped)
    const elementGroup = this.getElementGroup(element.id);
    if (elementGroup) {
      elementGroup.elementIds.forEach(elementId => {
        const groupedElement = this.canvasElements.find(el => el.id === elementId);
        if (groupedElement) {
          (groupedElement as any).originalWidth = groupedElement.width;
          (groupedElement as any).originalHeight = groupedElement.height;
          (groupedElement as any).originalX = groupedElement.x;
          (groupedElement as any).originalY = groupedElement.y;
          
          if (groupedElement.type === 'line') {
            (groupedElement as any).originalLineLength = groupedElement.lineLength || 100;
          }
        }
      });
    }
  }

  // Paper layout interaction methods
  onPaperLayoutMouseDown(event: MouseEvent) {

    // Disable paper movement when in grouping mode or when viewing mode doesn't allow it
    if (this.isGroupingMode || !this.viewingMode.canMovePaper) {
      return;
    }

    // ignore resize handles if your markup uses them
    if ((event.target as HTMLElement)?.classList?.contains('resize-handle'))
      return;


    // Don't handle paper layout dragging if clicking on a canvas element
    if ((event.target as HTMLElement)?.closest('.canvas-element')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const canvasEl = this.canvasRef?.nativeElement;
    if (!canvasEl) return;

    const startX = event.clientX;
    const startY = event.clientY;

    // starting model positions
    const startLeft = this.paperLayoutLeft ?? 0;
    const startTop = this.paperLayoutTop ?? 0;

    // Store initial position for history tracking
    this.paperLayoutStartPosition = { x: startLeft, y: startTop };

    // if you zoom via CSS scale, keep motion/bounds consistent
    const scale = this.zoomLevel ?? 1; // 1 = 100%

    const onMove = (e: MouseEvent) => {

      // Stop paper layout dragging if we're in grouping mode
      if (this.isGroupingMode) {
        onUp(); // Clean up the event listeners
        return;
      }

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // new paper pos (clamped to canvas edges)
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;

      const maxLeft = Math.max(0, canvasEl.clientWidth - this.paperLayoutWidth);
      const maxTop = Math.max(
        0,
        canvasEl.clientHeight - this.paperLayoutHeight
      );

      if (newLeft < 0) newLeft = 0;
      if (newTop < 0) newTop = 0;
      if (newLeft > maxLeft) newLeft = maxLeft;
      if (newTop > maxTop) newTop = maxTop;

      // calculate actual delta applied (important when clamped)
      const appliedDx = newLeft - this.paperLayoutLeft;
      const appliedDy = newTop - this.paperLayoutTop;

      // update paper
      this.paperLayout.left = newLeft;
      this.paperLayout.top = newTop;

      // shift all elements with paper
      this.canvasElements = this.canvasElements.map((el) => ({
        ...el,
        x: el.x + appliedDx,
        y: el.y + appliedDy,
      }));

      this.paperLayoutChange.emit({
        left: this.paperLayoutLeft,
        top: this.paperLayoutTop,
        width: this.paperLayoutWidth,
        height: this.paperLayoutHeight,
      });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  onPaperLayoutResizeStart(event: MouseEvent, handle: string) {

    // Disable paper resizing when in grouping mode or when viewing mode doesn't allow it
    if (this.isGroupingMode || !this.viewingMode.canMovePaper) {
      return;
    }

    this.isPaperLayoutResizing = true;
    this.paperLayoutResizeHandle = handle;
    this.paperLayoutOriginalWidth = this.paperLayoutWidth;
    this.paperLayoutOriginalHeight = this.paperLayoutHeight;
    this.paperLayoutOriginalX = this.paperLayoutLeft;
    this.paperLayoutOriginalY = this.paperLayoutTop;
    this.paperLayoutDragStartX = event.clientX;
    this.paperLayoutDragStartY = event.clientY;

    // Store initial dimensions for history tracking
    this.paperLayoutStartDimensions = { width: this.paperLayoutWidth, height: this.paperLayoutHeight };
    event.stopPropagation();
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent) {

    // Only disable document listeners when explicitly disabled (not during grouping mode)
    if (this.documentListenersDisabled) {
      return;
    }
    
    if (this.isDragging && this.dragElement) {

      let newX = event.clientX - this.dragStartX;
      let newY = event.clientY - this.dragStartY;

      // Apply Smart Layout snapping if enabled
      const snappedPosition = this.applySmartSnap(this.dragElement, newX, newY);
      newX = snappedPosition.x;
      newY = snappedPosition.y;
      
      // Apply auto-sizing if available
      if (snappedPosition.width && snappedPosition.height) {
        this.dragElement.width = snappedPosition.width;
        this.dragElement.height = snappedPosition.height;
      }

      // Calculate the delta movement
      const deltaX = newX - this.dragElement.x;
      const deltaY = newY - this.dragElement.y;

      // Check if the dragged element is part of a group
      const elementGroup = this.getElementGroup(this.dragElement.id);
      if (elementGroup) {
        // Move all elements in the same group together
        elementGroup.elementIds.forEach(groupedElementId => {
          const element = this.canvasElements.find(el => el.id === groupedElementId);
          if (element) {
            // Clamp to canvas bounds for each element
            element.x = Math.max(
              0,
              Math.min(element.x + deltaX, 2000 - element.width)
            );
            
            element.y = Math.max(
              0,
              Math.min(element.y + deltaY, 2000 - element.height)
            );
          }
        });
      } else {
        // Move only the dragged element
      this.dragElement.x = Math.max(
        0,
        Math.min(newX, 2000 - this.dragElement.width)
      );

        
      this.dragElement.y = Math.max(
        0,
        Math.min(newY, 2000 - this.dragElement.height)
      );

      }

      // Row width adjustment will be handled in mouse up event

      this.canvasElementsChange.emit([...this.canvasElements]);
    }

    if (this.isResizing && this.selectedElement) {
      const deltaX = event.clientX - this.resizeStartX;
      const deltaY = event.clientY - this.resizeStartY;

      // Calculate minimum size to ensure elements remain visible in PDF generation
      // PDF uses points (72 points per inch), and we need at least 0.5 points
      // Canvas uses pixels (96 DPI), so minimum pixel size = 0.5 * 96 / 72 = 0.67 pixels
      // Using a more practical minimum to account for precision issues
      // For text elements, we need a larger minimum to ensure visibility in PDF based on font size
      const minSize = this.selectedElement.type === 'text' || this.selectedElement.type === 'textarea' 
        ? this.getMinTextElementWidth(this.selectedElement.fontSize) 
        : this.MIN_ELEMENT_SIZE;

      // Check if the selected element is part of a group
      const elementGroup = this.getElementGroup(this.selectedElement.id);
      const elementsToResize = elementGroup ? 
        this.canvasElements.filter(el => elementGroup.elementIds.has(el.id)) : 
        [this.selectedElement];

      if (this.selectedElement.type === 'line') {
        // Line-specific resizing - adjust length based on rotation
        const angle = this.selectedElement.lineAngle || 0;

        if (angle === 0) {
          // Horizontal line - resize along X axis
          switch (this.resizeHandle) {
            case 'w':
              const newLengthW = Math.max(
                10,
                this.resizeOriginalWidth - deltaX
              );
              this.selectedElement.x =
                this.resizeOriginalX + (this.resizeOriginalWidth - newLengthW);
              this.selectedElement.width = newLengthW;
              this.selectedElement.lineLength = newLengthW;
              break;
            case 'e':
              const newLengthE = Math.max(
                10,
                this.resizeOriginalWidth + deltaX
              );
              this.selectedElement.width = newLengthE;
              this.selectedElement.lineLength = newLengthE;
              break;
          }
        } else if (angle === 90) {
          // Vertical line - resize along Y axis using deltaY
          switch (this.resizeHandle) {
            case 'w':
              // For vertical lines, 'w' handle is at the top, resize using deltaY
              const newLengthW = Math.max(
                10,
                this.resizeOriginalHeight - deltaY
              );
              this.selectedElement.y =
                this.resizeOriginalY + (this.resizeOriginalHeight - newLengthW);
              this.selectedElement.height = newLengthW;
              this.selectedElement.lineLength = newLengthW;
              break;
            case 'e':
              // For vertical lines, 'e' handle is at the bottom, resize using deltaY
              const newLengthE = Math.max(
                10,
                this.resizeOriginalHeight + deltaY
              );
              this.selectedElement.height = newLengthE;
              this.selectedElement.lineLength = newLengthE;
              break;
          }
        }
      } else {
        // Standard resizing for other elements
        switch (this.resizeHandle) {
          case 'nw':
            this.selectedElement.x = Math.max(0, this.resizeOriginalX + deltaX);
            this.selectedElement.y = Math.max(0, this.resizeOriginalY + deltaY);
            this.selectedElement.width = Math.max(
              minSize,
              this.resizeOriginalWidth - deltaX
            );
            this.selectedElement.height = Math.max(
              minSize,
              this.resizeOriginalHeight - deltaY
            );
            break;
          case 'ne':
            this.selectedElement.y = Math.max(0, this.resizeOriginalY + deltaY);
            this.selectedElement.width = Math.max(
              minSize,
              this.resizeOriginalWidth + deltaX
            );
            this.selectedElement.height = Math.max(
              minSize,
              this.resizeOriginalHeight - deltaY
            );
            break;
          case 'sw':
            this.selectedElement.x = Math.max(0, this.resizeOriginalX + deltaX);
            this.selectedElement.width = Math.max(
              minSize,
              this.resizeOriginalWidth - deltaX
            );
            this.selectedElement.height = Math.max(
              minSize,
              this.resizeOriginalHeight + deltaY
            );
            break;
          case 'se':
            this.selectedElement.width = Math.max(
              minSize,
              this.resizeOriginalWidth + deltaX
            );
            this.selectedElement.height = Math.max(
              minSize,
              this.resizeOriginalHeight + deltaY
            );
            break;
        }
      }


      // Apply the same resize operation to all elements in the group
      if (elementGroup && elementsToResize.length > 1 && this.selectedElement) {
        // Calculate the scale factors from the selected element
        const scaleX = this.selectedElement.width / this.resizeOriginalWidth;
        const scaleY = this.selectedElement.height / this.resizeOriginalHeight;
        
        // Find the group bounds (min/max coordinates) for relative positioning
        const groupElements = elementsToResize;
        const groupMinX = Math.min(...groupElements.map(el => (el as any).originalX));
        const groupMinY = Math.min(...groupElements.map(el => (el as any).originalY));
        const groupMaxX = Math.max(...groupElements.map(el => (el as any).originalX + (el as any).originalWidth));
        const groupMaxY = Math.max(...groupElements.map(el => (el as any).originalY + (el as any).originalHeight));
        const groupWidth = groupMaxX - groupMinX;
        const groupHeight = groupMaxY - groupMinY;
        
        elementsToResize.forEach(element => {
          if (element.id !== this.selectedElement!.id) {
            // Calculate relative position within the group (0-1 range)
            const relativeX = ((element as any).originalX - groupMinX) / groupWidth;
            const relativeY = ((element as any).originalY - groupMinY) / groupHeight;
            
            // Apply scaling to the element using stored original dimensions
            // Use appropriate minimum size based on element type
            const elementMinSize = (element.type === 'text' || element.type === 'textarea') 
              ? this.getMinTextElementWidth(element.fontSize) 
              : this.MIN_ELEMENT_SIZE;
            element.width = Math.max(elementMinSize, (element as any).originalWidth * scaleX);
            element.height = Math.max(minSize, (element as any).originalHeight * scaleY);
            
            // Update position to maintain relative position within the scaled group
            element.x = groupMinX + (relativeX * groupWidth * scaleX);
            element.y = groupMinY + (relativeY * groupHeight * scaleY);
            
            // For line elements, also update lineLength
            if (element.type === 'line') {
              element.lineLength = element.width; // Assuming horizontal lines
            }
          }
        });
      }

      // Row adjustments will be handled in mouse up event

      // Padding is now handled by the smart layout system

      this.canvasElementsChange.emit([...this.canvasElements]);
    }

    if (this.isPaperLayoutDragging) {
      const newX = event.clientX - this.paperLayoutDragStartX;
      const newY = event.clientY - this.paperLayoutDragStartY;

      // Calculate the delta movement
      const deltaX = newX - this.paperLayoutLeft;
      const deltaY = newY - this.paperLayoutTop;

      // Update paper layout position
      this.paperLayoutLeft = newX;
      this.paperLayoutTop = newY;

      // Move all elements that are inside the paper layout
      this.moveElementsWithPaper(deltaX, deltaY);

      this.paperLayoutChange.emit({
        left: this.paperLayoutLeft,
        top: this.paperLayoutTop,
        width: this.paperLayoutWidth,
        height: this.paperLayoutHeight,
      });
    }

    if (this.isPaperLayoutResizing) {
      const deltaX = event.clientX - this.paperLayoutDragStartX;
      const deltaY = event.clientY - this.paperLayoutDragStartY;

      const minSize = 100; // Minimum paper size

      // Store original paper position and size for element scaling
      const originalPaperLeft = this.paperLayoutLeft;
      const originalPaperTop = this.paperLayoutTop;
      const originalPaperWidth = this.paperLayoutWidth;
      const originalPaperHeight = this.paperLayoutHeight;

      switch (this.paperLayoutResizeHandle) {
        case 'nw':
          this.paperLayoutLeft = Math.max(
            0,
            this.paperLayoutOriginalX + deltaX
          );
          this.paperLayoutTop = Math.max(0, this.paperLayoutOriginalY + deltaY);
          this.paperLayoutWidth = Math.max(
            minSize,
            this.paperLayoutOriginalWidth - deltaX
          );
          this.paperLayoutHeight = Math.max(
            minSize,
            this.paperLayoutOriginalHeight - deltaY
          );
          break;
        case 'ne':
          this.paperLayoutTop = Math.max(0, this.paperLayoutOriginalY + deltaY);
          this.paperLayoutWidth = Math.max(
            minSize,
            this.paperLayoutOriginalWidth + deltaX
          );
          this.paperLayoutHeight = Math.max(
            minSize,
            this.paperLayoutOriginalHeight - deltaY
          );
          break;
        case 'sw':
          this.paperLayoutLeft = Math.max(
            0,
            this.paperLayoutOriginalX + deltaX
          );
          this.paperLayoutWidth = Math.max(
            minSize,
            this.paperLayoutOriginalWidth - deltaX
          );
          this.paperLayoutHeight = Math.max(
            minSize,
            this.paperLayoutOriginalHeight + deltaY
          );
          break;
        case 'se':
          this.paperLayoutWidth = Math.max(
            minSize,
            this.paperLayoutOriginalWidth + deltaX
          );
          this.paperLayoutHeight = Math.max(
            minSize,
            this.paperLayoutOriginalHeight + deltaY
          );
          break;
        case 'n':
          this.paperLayoutTop = Math.max(0, this.paperLayoutOriginalY + deltaY);
          this.paperLayoutHeight = Math.max(
            minSize,
            this.paperLayoutOriginalHeight - deltaY
          );
          break;
        case 's':
          this.paperLayoutHeight = Math.max(
            minSize,
            this.paperLayoutOriginalHeight + deltaY
          );
          break;
        case 'w':
          this.paperLayoutLeft = Math.max(
            0,
            this.paperLayoutOriginalX + deltaX
          );
          this.paperLayoutWidth = Math.max(
            minSize,
            this.paperLayoutOriginalWidth - deltaX
          );
          break;
        case 'e':
          this.paperLayoutWidth = Math.max(
            minSize,
            this.paperLayoutOriginalWidth + deltaX
          );
          break;
      }

      // Scale elements proportionally
      this.scaleElementsWithPaper(
        originalPaperLeft,
        originalPaperTop,
        originalPaperWidth,
        originalPaperHeight
      );

      this.paperLayoutChange.emit({
        left: this.paperLayoutLeft,
        top: this.paperLayoutTop,
        width: this.paperLayoutWidth,
        height: this.paperLayoutHeight,
      });
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeyDown(event: KeyboardEvent) {
    // Handle undo/redo keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        this.undo();
      } else if ((event.key === 'y') || (event.key === 'z' && event.shiftKey)) {
        event.preventDefault();
        this.redo();
      }
    }
  }

  @HostListener('document:mouseup', ['$event'])
  onDocumentMouseUp(event: MouseEvent) {

    // Only disable document listeners when explicitly disabled (not during grouping mode)
    if (this.documentListenersDisabled) return;
    
    // Emit canvas elements change if we were dragging grouped elements
    if (this.isDragging && this.dragElement && this.getElementGroup(this.dragElement.id)) {
      this.canvasElementsChange.emit([...this.canvasElements]);
    }
    
    // If Smart Layout Mode is enabled and element was dragged, check for row width adjustment
    if (this.isDragging && this.isSmartLayoutMode && this.dragElement && !this.getElementGroup(this.dragElement.id)) {
      this.adjustRowWidths(this.dragElement, false); // false indicates drag operation
      
      // Padding is now handled by the smart layout system
      
      this.canvasElementsChange.emit([...this.canvasElements]);
    }
    
    // If Smart Layout Mode is enabled and element was resized, check for row adjustments
    if (this.isResizing && this.isSmartLayoutMode && this.selectedElement && !this.getElementGroup(this.selectedElement.id)) {
      const oldHeight = this.resizeOriginalHeight;
      const oldWidth = this.resizeOriginalWidth;
      const newHeight = this.selectedElement.height;
      const newWidth = this.selectedElement.width;
      
      // Check if height was resized significantly
      if (Math.abs(newHeight - oldHeight) > 5) { // 5px threshold to avoid micro-adjustments
        this.adjustRowHeights(this.selectedElement);
        
        // Padding is now handled by the smart layout system
        
        this.canvasElementsChange.emit([...this.canvasElements]);
      }
      
      // Check if width was resized significantly
      if (Math.abs(newWidth - oldWidth) > 5) { // 5px threshold to avoid micro-adjustments
        this.adjustRowWidths(this.selectedElement, true); // true indicates width resize
        
        // Padding is now handled by the smart layout system
        
        this.canvasElementsChange.emit([...this.canvasElements]);
      }
    }
    
    // Hide connection line when dragging stops
    this.showConnectionLine = false;
    this.connectionLine = null;
    
    // Add history tracking for completed operations
    if (this.isDragging && this.dragElement && this.dragStartPosition) {
      // Only add to history if the element actually moved
      if (this.dragElement.x !== this.dragStartPosition.x || this.dragElement.y !== this.dragStartPosition.y) {
        this.addToHistory(HistoryActionFactory.createMoveElementAction(
          this.dragElement.id,
          this.dragStartPosition.x,
          this.dragStartPosition.y,
          this.dragElement.x,
          this.dragElement.y
        ));
      }
    }

    if (this.isResizing && this.selectedElement && this.resizeStartDimensions) {
      // Only add to history if the element actually changed size
      if (this.selectedElement.width !== this.resizeStartDimensions.width || 
          this.selectedElement.height !== this.resizeStartDimensions.height) {
        this.addToHistory(HistoryActionFactory.createResizeElementAction(
          this.selectedElement.id,
          this.resizeStartDimensions.width,
          this.resizeStartDimensions.height,
          this.selectedElement.width,
          this.selectedElement.height
        ));
      }
    }

    this.isDragging = false;
    this.isResizing = false;
    this.dragElement = null;
    this.dragStartPosition = null;
    this.resizeStartDimensions = null;
    
    // Check if paper layout was resized and emit event to change dropdown to Custom
    const wasPaperLayoutResizing = this.isPaperLayoutResizing;
    const currentPaperWidth = this.paperLayoutWidth;
    const currentPaperHeight = this.paperLayoutHeight;
    
    // Add history tracking for paper layout operations
    if (this.isPaperLayoutDragging && this.paperLayoutStartPosition) {
      // Only add to history if the paper layout actually moved
      if (this.paperLayoutLeft !== this.paperLayoutStartPosition.x || 
          this.paperLayoutTop !== this.paperLayoutStartPosition.y) {
        this.addToHistory(HistoryActionFactory.createPaperLayoutMoveAction(
          this.paperLayoutStartPosition.x,
          this.paperLayoutStartPosition.y,
          this.paperLayoutLeft,
          this.paperLayoutTop
        ));
      }
    }

    if (wasPaperLayoutResizing && this.paperLayoutStartDimensions) {
      // Only add to history if the paper layout actually changed size
      if (this.paperLayoutWidth !== this.paperLayoutStartDimensions.width || 
          this.paperLayoutHeight !== this.paperLayoutStartDimensions.height) {
        this.addToHistory(HistoryActionFactory.createPaperLayoutResizeAction(
          this.paperLayoutStartDimensions.width,
          this.paperLayoutStartDimensions.height,
          this.paperLayoutWidth,
          this.paperLayoutHeight
        ));
      }
    }

    this.isPaperLayoutDragging = false;
    this.isPaperLayoutResizing = false;
    this.paperLayoutResizeHandle = '';
    this.paperLayoutStartPosition = null;
    this.paperLayoutStartDimensions = null;
    
    // Emit the resize event after cleaning up the state to avoid interference
    if (wasPaperLayoutResizing) {
      // Use setTimeout to ensure this runs after the current event cycle
      setTimeout(() => {
        this.paperLayoutResized.emit({
          width: currentPaperWidth,
          height: currentPaperHeight
        });
      }, 0);
    }
  }


  // Grouping mode mouse event handlers
  onGroupingMouseDown(event: MouseEvent) {
    if (!this.isGroupingMode) return;
    
    // Only start selection if clicking on the canvas container or its children (but not on elements)
    const target = event.target as HTMLElement;
    if (target.classList.contains('canvas-element') || target.closest('.canvas-element')) {
      return;
    }

    // Don't interfere if we're already dragging or resizing
    if (this.isDragging || this.isResizing) return;


    // Store original element positions to prevent unwanted movements
    this.originalElementPositions = {};
    this.canvasElements.forEach(element => {
      this.originalElementPositions[element.id] = { x: element.x, y: element.y };
    });

    this.isSelecting = true;
    // Don't disable document listeners - we want to allow element dragging during grouping mode
    this.elementModificationsBlocked = true; // Block element modifications during selection only
    // Use the canvas container's bounding rect for consistent coordinate system
    const canvasContainer = (event.currentTarget as HTMLElement).closest('.canvas-container') as HTMLElement;
    const rect = canvasContainer.getBoundingClientRect();
    const scale = this.zoomLevel || 1; // Account for zoom level
    this.selectionStart = {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale
    };
    this.selectionRect = {
      x: this.selectionStart.x,
      y: this.selectionStart.y,
      width: 0,
      height: 0
    };
    
    event.preventDefault();
    event.stopPropagation();
  }

  onGroupingMouseMove(event: MouseEvent) {
    if (!this.isGroupingMode || !this.isSelecting || !this.selectionStart) return;
    
    // Don't interfere if we're already dragging or resizing
    if (this.isDragging || this.isResizing) return;

    // Restore element positions if they've been modified
    this.restoreElementPositions();

    // Use the canvas container's bounding rect for consistent coordinate system
    const canvasContainer = (event.currentTarget as HTMLElement).closest('.canvas-container') as HTMLElement;
    const rect = canvasContainer.getBoundingClientRect();
    const scale = this.zoomLevel || 1; // Account for zoom level
    const currentX = (event.clientX - rect.left) / scale;
    const currentY = (event.clientY - rect.top) / scale;

    this.selectionRect = {
      x: Math.min(this.selectionStart.x, currentX),
      y: Math.min(this.selectionStart.y, currentY),
      width: Math.abs(currentX - this.selectionStart.x),
      height: Math.abs(currentY - this.selectionStart.y)
    };
    
    event.preventDefault();
    event.stopPropagation();
  }

  onGroupingMouseUp(event: MouseEvent) {
    if (!this.isGroupingMode || !this.isSelecting || !this.selectionRect) return;
    
    // Don't interfere if we're already dragging or resizing
    if (this.isDragging || this.isResizing) return;

    // Find elements within the selection rectangle
    const elementsInSelection = this.getElementsInSelection(this.selectionRect);
    
      // Group the selected elements
      if (elementsInSelection.length > 1) {
        // Check if any of the selected elements are already in a group
        const alreadyGroupedElements = elementsInSelection.filter(element => 
          this.getElementGroup(element.id) !== null
        );
        
        if (alreadyGroupedElements.length > 0) {
          // Show error message for already grouped elements
          const elementNames = alreadyGroupedElements.map(el => 
            this.getElementTypeDisplayName(el.type)
          ).join(', ');
          
          this.showBanner.emit({
            text: `Cannot group elements: ${elementNames} are already in a group. Please ungroup them first or select only ungrouped elements.`,
            kind: 'warning',
            duration: 5000
          });
          return;
        }
        
        // Always create a new group for each selection (multiple groups support)
        const groupId = this.generateGroupId();
        const groupName = `Group ${this.elementGroups.size + 1}`;
        const groupColor = this.generateGroupColor();
        
        const newGroup: ElementGroup = {
          id: groupId,
          name: groupName,
          elementIds: new Set(elementsInSelection.map(el => el.id)),
          color: groupColor,
          createdAt: new Date()
        };
        
        this.elementGroups.set(groupId, newGroup);
        
        // Emit groups change to update the panel
        this.emitGroupsChange();
      }


    this.isSelecting = false;
    this.selectionStart = null;
    this.elementModificationsBlocked = false; // Re-enable element modifications after selection
    this.originalElementPositions = {}; // Clear stored positions
    
    // Clear the selection rectangle
    setTimeout(() => {
      this.selectionRect = null;
    }, 100);
    
    event.preventDefault();
    event.stopPropagation();
  }

  // Helper methods
  
  /**
   * Ensure element maintains minimum size for PDF generation visibility
   */
  private ensureMinimumSize(element: CanvasElement): void {
    const minSize = 5; // Minimum size in pixels to ensure PDF visibility
    
    if (element.width < minSize) {
      element.width = minSize;
    }
    if (element.height < minSize) {
      element.height = minSize;
    }
  }
  
  private getElementsInSelection(selectionRect: { x: number; y: number; width: number; height: number }): CanvasElement[] {
    return this.canvasElements.filter(element => {
      const elementRect = {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height
      };
      
      // Check if element overlaps with selection rectangle
      return this.rectanglesOverlap(selectionRect, elementRect);
    });
  }

  private rectanglesOverlap(rect1: { x: number; y: number; width: number; height: number }, 
                           rect2: { x: number; y: number; width: number; height: number }): boolean {
    return !(rect1.x + rect1.width < rect2.x || 
             rect2.x + rect2.width < rect1.x || 
             rect1.y + rect1.height < rect2.y || 
             rect2.y + rect2.height < rect1.y);
  }

  private updateCanvasElements() {
    // Emit the updated canvas elements to parent
    this.canvasElementsChange.emit([...this.canvasElements]);
  }

  // Helper methods for group management
  private generateGroupId(): string {
    return 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateGroupColor(): string {
    const colors = [
      '#ef4444', // red
      '#3b82f6', // blue  
      '#10b981', // emerald
      '#f59e0b', // amber
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#84cc16', // lime
    ];
    return colors[this.elementGroups.size % colors.length];
  }

  private getElementGroup(elementId: string): ElementGroup | null {
    for (const group of this.elementGroups.values()) {
      if (group.elementIds.has(elementId)) {
        return group;
      }
    }
    return null;
  }

  private emitGroupsChange() {
    this.elementGroupsChange.emit(new Map(this.elementGroups));
  }

  // Helper method for template
  isElementGrouped(elementId: string): boolean {
    return this.getElementGroup(elementId) !== null;
  }

  // Helper method to get group color for an element
  getElementGroupColor(elementId: string): string {
    const group = this.getElementGroup(elementId);
    return group ? group.color : '#10b981'; // Default green color
  }

  // Helper method to get element type display name
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

  // Method to clear all groupings (can be called when exiting grouping mode)
  clearGroupings() {
    this.elementGroups.clear();
    this.emitGroupsChange();
  }

  // Clean up any active paper layout dragging when entering grouping mode
  cleanupPaperLayoutDragging() {
    // Reset paper layout dragging state
    this.isPaperLayoutDragging = false;
    this.isPaperLayoutResizing = false;
    
    // The onMove function will now check for isGroupingMode and clean up automatically
  }

  // Method to ungroup a specific element
  ungroupElement(elementId: string) {
    const elementGroup = this.getElementGroup(elementId);
    if (elementGroup) {
      elementGroup.elementIds.delete(elementId);
      
      // If only one element is left in the group, automatically ungroup it
      if (elementGroup.elementIds.size === 1) {
        const remainingElementId = elementGroup.elementIds.values().next().value;
        if (remainingElementId) {
          elementGroup.elementIds.delete(remainingElementId);
          this.elementGroups.delete(elementGroup.id);
        }
      }
      
      // If group is empty, remove it
      if (elementGroup.elementIds.size === 0) {
        this.elementGroups.delete(elementGroup.id);
      }
    }
    
    // Emit groups change to update the panel
    this.emitGroupsChange();
  }

  ungroupAllElements() {
    // Clear all groups - create new Map to trigger change detection
    this.elementGroups = new Map();
    // Emit groups change to update the panel
    this.emitGroupsChange();
  }

  // Method to ungroup all elements in a specific group
  ungroupGroup(groupId: string) {
    this.elementGroups.delete(groupId);
    this.emitGroupsChange();
  }

  // Context menu methods
  onElementContextMenu(element: CanvasElement, event: MouseEvent) {
    // Always prevent default browser context menu
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Prevent context menu and properties panel opening if not in edit mode
    if (!this.viewingMode.canEdit) {
      return false;
    }

    const elementGroup = this.getElementGroup(element.id);
    
    // For grouped elements, show custom context menu
    if (elementGroup) {
      // Store the element and position
      this.contextMenuElement = element;
      this.contextMenuPosition = { x: event.clientX, y: event.clientY };
      this.contextMenuVisible = true;

      // Hide context menu when clicking elsewhere
      document.addEventListener('click', this.hideContextMenu.bind(this), { once: true });
      
      return false;
    }
    
    // For non-grouped elements, open properties panel
    this.selectedElement = element;
    this.selectedElementChange.emit(element);
    return false;
  }

  onCanvasRightClick(event: MouseEvent) {
    // Always prevent default browser context menu
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Check if right-clicking on an element
    const target = event.target as HTMLElement;
    const canvasElement = target.closest('.canvas-element');
    
    if (canvasElement) {
      // Find the element data
      const elementId = canvasElement.getAttribute('data-element-id') || 
                       canvasElement.querySelector('[data-element-id]')?.getAttribute('data-element-id');
      
      if (elementId) {
        const element = this.canvasElements.find(el => el.id === elementId);
        if (element) {
          this.onElementContextMenu(element, event);
          return;
        }
      }
    }

    // If right-clicking on empty canvas, deselect current element
    this.selectedElement = null;
    this.selectedElementChange.emit(null);
  }

  onUngroupSingleElement(element: CanvasElement) {
    // Remove the specific element from its group
    this.ungroupElement(element.id);
    this.hideContextMenu();
  }

  private hideContextMenu() {
    this.contextMenuVisible = false;
    this.contextMenuElement = null;
  }

  onElementHover(elementId: string | null) {
    this.hoveredElementId = elementId;
  }

  clearAllGrouping() {
    // Clear all grouping data - create new Map to trigger change detection
    this.elementGroups = new Map();
    this.hoveredElementId = null;
    this.selectedElement = null;
    
    // Emit groups change to update the panel
    this.emitGroupsChange();
  }

  // Restore element positions to their original values during grouping
  private restoreElementPositions() {
    if (!this.isSelecting) return;
    
    let positionsChanged = false;
    this.canvasElements.forEach(element => {
      const originalPos = this.originalElementPositions[element.id];
      if (originalPos && (element.x !== originalPos.x || element.y !== originalPos.y)) {
        element.x = originalPos.x;
        element.y = originalPos.y;
        positionsChanged = true;
      }
    });
    
    if (positionsChanged) {
      // Force change detection to update the DOM
      this.canvasElementsChange.emit([...this.canvasElements]);
    }
  }

  private moveElementsWithPaper(deltaX: number, deltaY: number) {

    // Don't modify elements when explicitly blocked
    if (this.elementModificationsBlocked) {
      return;
    }
    
    const elementsInsidePaper = this.getElementsInsidePaper();

    elementsInsidePaper.forEach((element) => {
      element.x += deltaX;
      element.y += deltaY;
    });

    if (elementsInsidePaper.length > 0) {
      this.canvasElementsChange.emit([...this.canvasElements]);
    }
  }

  private scaleElementsWithPaper(
    originalLeft: number,
    originalTop: number,
    originalWidth: number,
    originalHeight: number
  ) {

    // Don't modify elements when explicitly blocked
    if (this.elementModificationsBlocked) {
      return;
    }
    
    const elementsInsidePaper = this.getElementsInsidePaper();

    const scaleX = this.paperLayoutWidth / originalWidth;
    const scaleY = this.paperLayoutHeight / originalHeight;

    elementsInsidePaper.forEach((element) => {
      // Calculate relative position within paper
      const relativeX = (element.x - originalLeft) / originalWidth;
      const relativeY = (element.y - originalTop) / originalHeight;

      // Scale position and size
      element.x = this.paperLayoutLeft + relativeX * this.paperLayoutWidth;
      element.y = this.paperLayoutTop + relativeY * this.paperLayoutHeight;
      element.width *= scaleX;
      element.height *= scaleY;
    });

    if (elementsInsidePaper.length > 0) {
      this.canvasElementsChange.emit([...this.canvasElements]);
    }
  }

  private getElementsInsidePaper(): CanvasElement[] {
    return this.canvasElements.filter((element) => {
      const elementRight = element.x + element.width;
      const elementBottom = element.y + element.height;
      const paperRight = this.paperLayoutLeft + this.paperLayoutWidth;
      const paperBottom = this.paperLayoutTop + this.paperLayoutHeight;

      return (
        element.x >= this.paperLayoutLeft &&
        element.y >= this.paperLayoutTop &&
        elementRight <= paperRight &&
        elementBottom <= paperBottom
      );
    });
  }

  // Utility methods
  isElementInsidePaper(element: CanvasElement): boolean {
    const elementRight = element.x + element.width;
    const elementBottom = element.y + element.height;
    const paperRight = this.paperLayoutLeft + this.paperLayoutWidth;
    const paperBottom = this.paperLayoutTop + this.paperLayoutHeight;

    return (
      element.x < paperRight &&
      elementRight > this.paperLayoutLeft &&
      element.y < paperBottom &&
      elementBottom > this.paperLayoutTop
    );
  }

  isElementCompletelyInsidePaper(element: CanvasElement): boolean {
    const elementRight = element.x + element.width;
    const elementBottom = element.y + element.height;
    const paperRight = this.paperLayoutLeft + this.paperLayoutWidth;
    const paperBottom = this.paperLayoutTop + this.paperLayoutHeight;

    return (
      element.x >= this.paperLayoutLeft &&
      element.y >= this.paperLayoutTop &&
      elementRight <= paperRight &&
      elementBottom <= paperBottom
    );
  }

  trackElement(index: number, element: CanvasElement): string {
    return element.id;
  }

  private generateId(): string {
    return (
      'element_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    );
  }

  private triggerBubbleAnimation(elementId: string): void {
    // Add element to bubble animation set
    this.bubbleAnimationElements.add(elementId);
    
    // Remove from animation set after animation completes
    setTimeout(() => {
      this.bubbleAnimationElements.delete(elementId);
    }, 500); // Animation duration + small buffer
  }

  // Check if element should have bubble animation
  isElementBubbleAnimating(elementId: string): boolean {
    return this.bubbleAnimationElements.has(elementId);
  }

  private triggerDeleteAnimation(elementId: string): void {
    // Add element to delete animation set
    this.deleteAnimationElements.add(elementId);
    
    // Remove from animation set after animation completes
    setTimeout(() => {
      this.deleteAnimationElements.delete(elementId);
    }, 300); // Animation duration + small buffer
  }

  private triggerBringToFrontAnimation(elementId: string): void {
    // Add element to bring to front animation set
    this.bringToFrontAnimationElements.add(elementId);
    
    // Remove from animation set after animation completes
    setTimeout(() => {
      this.bringToFrontAnimationElements.delete(elementId);
    }, 400); // Animation duration + small buffer
  }

  // Check if element should have delete animation
  isElementDeleting(elementId: string): boolean {
    return this.deleteAnimationElements.has(elementId);
  }

  // Check if element should have bring to front animation
  isElementBringingToFront(elementId: string): boolean {
    return this.bringToFrontAnimationElements.has(elementId);
  }

  private triggerLineOrientationAnimation(elementId: string): void {
    // Add element to line orientation animation set
    this.lineOrientationAnimationElements.add(elementId);
    
    // Remove from animation set after animation completes
    setTimeout(() => {
      this.lineOrientationAnimationElements.delete(elementId);
    }, 400); // Animation duration + small buffer
  }

  // Check if element should have line orientation animation
  isElementLineOrientationAnimating(elementId: string): boolean {
    return this.lineOrientationAnimationElements.has(elementId);
  }

  // Public method to trigger line orientation animation (called from properties component)
  public triggerLineOrientationChangeAnimation(elementId: string): void {
    this.triggerLineOrientationAnimation(elementId);
  }


  private generateUniquePlaceholder(baseName: string): string {
    // Count existing elements with the same base placeholder name
    const existingCount = this.canvasElements.filter(element => {
      if (element.content) {
        const placeholderMatches = element.content.match(/\{\{([^}]+)\}\}/g);
        if (placeholderMatches) {
          return placeholderMatches.some(match => {
            const placeholderName = match.replace(/\{\{|\}\}/g, '');
            return placeholderName.startsWith(baseName);
          });
        }
      }
      return false;
    }).length;

    // Generate unique placeholder name
    if (existingCount === 0) {
      return `{{${baseName}}}`;
    } else {
      return `{{${baseName}_${existingCount + 1}}}`;
    }
  }

  // Public getter methods for live preview
  public getPaperLayoutWidth(): number {
    return this.paperLayoutWidth;
  }

  public getPaperLayoutHeight(): number {
    return this.paperLayoutHeight;
  }

  public getPaperLayoutLeft(): number {
    return this.paperLayoutLeft;
  }

  public getPaperLayoutTop(): number {
    return this.paperLayoutTop;
  }

  public getPaperWidth(): number {
    // Extract width from selectedPaperSize string
    const match = this.selectedPaperSize.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 6;
  }

  public getPaperHeight(): number {
    // Extract height from selectedPaperSize string
    const match = this.selectedPaperSize.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[2]) : 6;
  }

  public getPaperUnit(): string {
    // Extract unit from selectedPaperSize string
    if (this.selectedPaperSize.includes('in')) return 'inch';
    if (this.selectedPaperSize.includes('cm')) return 'cm';
    if (this.selectedPaperSize.includes('mm')) return 'mm';
    return 'inch'; // default
  }

  // Public methods for parent component
  public updatePaperSize(paperSize: string) {
    this.selectedPaperSize = paperSize;

    // Update paper dimensions based on new size
    switch (paperSize) {
      case 'Pallet Label (6 x 6 in)':
        this.paperLayoutWidth = 576; // 6 inches × 96 DPI
        this.paperLayoutHeight = 576; // 6 inches × 96 DPI
        break;
      case 'Shipping Label (4 x 6 in)':
        this.paperLayoutWidth = 384; // 4 inches × 96 DPI
        this.paperLayoutHeight = 576; // 6 inches × 96 DPI
        break;
      case 'Shipping Label (4 x 8 in)':
        this.paperLayoutWidth = 384; // 4 inches × 96 DPI
        this.paperLayoutHeight = 768; // 8 inches × 96 DPI
        break;
      case 'Box Label (3 x 5 in)':
        this.paperLayoutWidth = 288; // 3 inches × 96 DPI
        this.paperLayoutHeight = 480; // 5 inches × 96 DPI
        break;
      case 'Box Label (2 x 4 in)':
        this.paperLayoutWidth = 192; // 2 inches × 96 DPI
        this.paperLayoutHeight = 384; // 4 inches × 96 DPI
        break;
      case 'Pallet Label (6 x 4 in)':
        this.paperLayoutWidth = 576; // 6 inches × 96 DPI
        this.paperLayoutHeight = 384; // 4 inches × 96 DPI
        break;
      case 'Inventory Label (1 x 3 in)':
        this.paperLayoutWidth = 96; // 1 inch × 96 DPI
        this.paperLayoutHeight = 288; // 3 inches × 96 DPI
        break;
      case 'Inventory Label (1.5 x 1 in)':
        this.paperLayoutWidth = 144; // 1.5 inches × 96 DPI
        this.paperLayoutHeight = 96; // 1 inch × 96 DPI
        break;
      case 'Round Label (2 in Ø)':
        this.paperLayoutWidth = 192; // 2 inches × 96 DPI
        this.paperLayoutHeight = 192; // 2 inches × 96 DPI
        break;
      case 'Round Label (3 in Ø)':
        this.paperLayoutWidth = 288; // 3 inches × 96 DPI
        this.paperLayoutHeight = 288; // 3 inches × 96 DPI
        break;
      case 'Address Label (1 x 2.625 in)':
        this.paperLayoutWidth = 96; // 1 inch × 96 DPI
        this.paperLayoutHeight = 252; // 2.625 inches × 96 DPI
        break;
      case 'A4':
        this.paperLayoutWidth = 794; // A4 width in pixels at 96 DPI
        this.paperLayoutHeight = 1123; // A4 height in pixels at 96 DPI
        break;
      case 'Letter':
        this.paperLayoutWidth = 816; // Letter width in pixels at 96 DPI
        this.paperLayoutHeight = 1056; // Letter height in pixels at 96 DPI
        break;
      case 'Custom':
        // Don't change dimensions for Custom - user has already set them via resizing
        // Just keep the current dimensions
        break;
    }

    // Re-center the paper layout with new dimensions only if it's not Custom
    if (paperSize !== 'Custom') {
      this.centerPaperLayout();
    }

    this.paperLayoutChange.emit({
      left: this.paperLayoutLeft,
      top: this.paperLayoutTop,
      width: this.paperLayoutWidth,
      height: this.paperLayoutHeight,
    });
  }

  public clearCanvas() {
    this.canvasElements = [];
    this.selectedElement = null;
    this.canvasElementsChange.emit([]);
    this.selectedElementChange.emit(null);
  }

  public getElementsInsidePaperForSave(): CanvasElement[] {
    return this.canvasElements.filter((element) =>
      this.isElementCompletelyInsidePaper(element)
    );
  }

  // Element manipulation methods
  public deleteElement(elementId: string) {
    const elementToDelete = this.canvasElements.find(el => el.id === elementId);
    if (elementToDelete) {
      // Trigger delete animation
      this.triggerDeleteAnimation(elementId);
      
      // Add to history before deletion
      this.addToHistory(HistoryActionFactory.createRemoveElementAction(elementToDelete));
      
      // Delay actual deletion to allow animation to play
      setTimeout(() => {
        this.canvasElements = this.canvasElements.filter(
          (element) => element.id !== elementId
        );
        if (this.selectedElement?.id === elementId) {
          this.selectedElement = null;
          this.selectedElementChange.emit(null);
        }
        this.canvasElementsChange.emit(this.canvasElements);
      }, 250); // Slightly less than animation duration
    }
  }

  public bringElementToFront(elementId: string) {
    const elementIndex = this.canvasElements.findIndex(
      (element) => element.id === elementId
    );
    if (elementIndex !== -1) {
      // Trigger bring to front animation
      this.triggerBringToFrontAnimation(elementId);
      
      const element = this.canvasElements.splice(elementIndex, 1)[0];
      
      // Add to history before bringing to front
      this.addToHistory(HistoryActionFactory.createBringToFrontAction(
        elementId,
        elementIndex,
        this.canvasElements.length
      ));
      
      this.canvasElements.push(element);
      this.canvasElementsChange.emit(this.canvasElements);
    }
  }

  public updateElement(updatedElement: CanvasElement) {
    const index = this.canvasElements.findIndex(
      (el) => el.id === updatedElement.id
    );
    if (index !== -1) {
      // Store old properties for history
      const oldElement = { ...this.canvasElements[index] };
      
      // Ensure minimum size for PDF generation visibility
      this.ensureMinimumSize(updatedElement);
      
      // Add to history before updating
      this.addToHistory(HistoryActionFactory.createUpdateElementPropertiesAction(
        updatedElement.id,
        oldElement,
        updatedElement
      ));
      
      this.canvasElements[index] = updatedElement;

      // For line elements, ensure dimensions are properly set
      if (updatedElement.type === 'line') {
        // Update lineLength to match the current width/height based on orientation
        const angle = updatedElement.lineAngle || 0;
        if (angle === 0) {
          // Horizontal line - length is width
          this.canvasElements[index].lineLength = updatedElement.width;
          this.canvasElements[index].height = Math.max(
            8,
             (updatedElement.lineWidth || 1) + 6
          );
        } else if (angle === 90) {
          // Vertical line - length is height, but we store it in width for the selection box
          this.canvasElements[index].lineLength = updatedElement.height;
          this.canvasElements[index].width = Math.max(
            8,
            (updatedElement.lineWidth || 1) + 6
          );
          this.canvasElements[index].height = updatedElement.height;
        }
      }

      // Update the selected element reference to keep properties panel visible
      if (
        this.selectedElement &&
        this.selectedElement.id === updatedElement.id
      ) {
        this.selectedElement = this.canvasElements[index];
        this.selectedElementChange.emit(this.selectedElement);
      }

      this.canvasElementsChange.emit(this.canvasElements);
    }
  }

  // Zoom methods
  zoomIn() {
    if (this.zoomLevel < this.maxZoom) {
      this.zoomLevel = Math.min(this.zoomLevel + this.zoomStep, this.maxZoom);
      this.applyZoom();
      // Ruler marks are now static and don't change with zoom
    }
  }

  zoomOut() {
    if (this.zoomLevel > this.minZoom) {
      this.zoomLevel = Math.max(this.zoomLevel - this.zoomStep, this.minZoom);
      this.applyZoom();
      // Ruler marks are now static and don't change with zoom
    }
  }

  resetZoom() {
    this.zoomLevel = 1.0;
    this.applyZoom();
    // Ruler marks are now static and don't change with zoom
  }

  setZoom(level: number) {
    this.zoomLevel = Math.max(this.minZoom, Math.min(level, this.maxZoom));
    this.applyZoom();
    // Ruler marks are now static and don't change with zoom
  }

  private applyZoom() {
    const canvasElement = this.canvasRef?.nativeElement;
    if (canvasElement) {
      canvasElement.style.transform = `scale(${this.zoomLevel})`;
      canvasElement.style.transformOrigin = 'top left';
    }

    // keep rulers in sync with the zoom used on the wrapper
    this.viewScale = this.zoomLevel;
    // and refresh pixel phase because origin can shift slightly
    this.updatePixelPhase();
  }

  getZoomPercentage(): number {
    return Math.round(this.zoomLevel * 100);
  }

  // Helper method for template calculations
  getMaxValue(a: number, b: number): number {
    return Math.max(a, b);
  }

  // Handle mouse wheel zoom
  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent) {
    // Only zoom when Ctrl key is held down
    if (event.ctrlKey) {
      event.preventDefault();

      if (event.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
    }
  }


  @HostListener('document:contextmenu', ['$event'])
  onDocumentContextMenu(event: MouseEvent) {
    // Hide context menu if clicking outside of canvas elements
    const target = event.target as HTMLElement;
    const isCanvasElement = target.closest('.canvas-element');
    
    if (!isCanvasElement) {
      this.hideContextMenu();
    }
  }

  /**
   * Get barcode data for display
   */
  getBarcodeData(element: CanvasElement): string {
    let barcodeData = element.content || '123456789012';

    // If it's a placeholder, show placeholder text
    if (barcodeData.includes('{{') && barcodeData.includes('}}')) {
      return barcodeData; // Show the placeholder syntax
    }

    return barcodeData;
  }


  /**
   * Get QR code data for display
   */
  getQrData(element: CanvasElement): string {
    let qrData = element.content || 'https://example.com';

    // If it's a placeholder, show placeholder text
    if (qrData.includes('{{') && qrData.includes('}}')) {
      return qrData; // Show the placeholder syntax
    }

    return qrData;
  }

  /**
   * Handle horizontal ruler mark hover - shows VERTICAL line preview
   */

  onHorizontalRulerHover(event: MouseEvent, mark: RulerMark) {
    // Use actual mouse position relative to canvas container for precise positioning
    const canvasContainer = this.canvasRef.nativeElement.parentElement;
    const rect = canvasContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    this.hoverPreviewLine = { type: 'vertical', position: x };
  }

  /**
   * Handle vertical ruler mark hover - shows HORIZONTAL line preview
   */

  onVerticalRulerHover(event: MouseEvent, mark: RulerMark) {
    // Use actual mouse position relative to canvas container for precise positioning
    const canvasContainer = this.canvasRef.nativeElement.parentElement;
    const rect = canvasContainer.getBoundingClientRect();
    const y = event.clientY - rect.top;
    this.hoverPreviewLine = { type: 'horizontal', position: y };
  }

  /**
   * Handle ruler mark hover out
   */
  onRulerMarkHoverOut() {
    this.hoverPreviewLine = null;
  }

  /**
   * Handle horizontal ruler mark click - creates VERTICAL lines
   */
  onHorizontalRulerClick(event: MouseEvent, mark: RulerMark) {
    event.preventDefault();
    event.stopPropagation();


    // Use actual mouse position relative to canvas container for precise positioning
    const canvasContainer = this.canvasRef.nativeElement.parentElement;
    const rect = canvasContainer.getBoundingClientRect();
    const position = event.clientX - rect.left;

    // Toggle vertical reference line (remove if exists, add if doesn't)
    const existingIndex = this.verticalReferenceLines.indexOf(position);
    if (existingIndex > -1) {
      this.verticalReferenceLines.splice(existingIndex, 1);
    } else {
      this.verticalReferenceLines.push(position);
    }
  }

  /**
   * Handle vertical ruler mark click - creates HORIZONTAL lines
   */
  onVerticalRulerClick(event: MouseEvent, mark: RulerMark) {
    event.preventDefault();
    event.stopPropagation();


    // Use actual mouse position relative to canvas container for precise positioning
    const canvasContainer = this.canvasRef.nativeElement.parentElement;
    const rect = canvasContainer.getBoundingClientRect();
    const position = event.clientY - rect.top;

    // Toggle horizontal reference line (remove if exists, add if doesn't)
    const existingIndex = this.horizontalReferenceLines.indexOf(position);
    if (existingIndex > -1) {
      this.horizontalReferenceLines.splice(existingIndex, 1);
    } else {
      this.horizontalReferenceLines.push(position);
    }
  }

  /**
   * Clear all reference lines
   */
  clearAllReferenceLines() {
    this.horizontalReferenceLines = [];
    this.verticalReferenceLines = [];
  }

  roundPx(v: number) {
    return Math.round(v);
  }

  private _viewScale = 1;
  get viewScale(): number {
    return this._viewScale;
  }
  set viewScale(v: number) {
    this._viewScale = v || 1;
    // keep tick/grid origins aligned when scale changes
    Promise.resolve().then(() => this.updatePixelPhase?.());
  }

  // (already suggested earlier; include if not present)
  phaseX = 0;
  phaseY = 0;
  snapPx(v: number) {
    const dpr = window.devicePixelRatio || 1;
    return Math.round(v * dpr) / dpr;
  }
  updatePixelPhase() {
    const el = this.canvasRef?.nativeElement;
    if (!el) return;
    const r = el.getBoundingClientRect(),
      dpr = window.devicePixelRatio || 1;
    this.phaseX = -((r.left * dpr - Math.round(r.left * dpr)) / dpr);
    this.phaseY = -((r.top * dpr - Math.round(r.top * dpr)) / dpr);

  }

  onImageImported(imageData: { src: string; name: string; width: number; height: number }): void {
    // If we have a current image element, update it
    if (this.currentImageElement && this.currentImageElement.type === 'image') {
      this.currentImageElement.imageSrc = imageData.src;
      this.currentImageElement.imageName = imageData.name;
      this.currentImageElement.imageWidth = imageData.width;
      this.currentImageElement.imageHeight = imageData.height;
      
      // Update the element in the canvas
      const index = this.canvasElements.findIndex(el => el.id === this.currentImageElement!.id);
      if (index !== -1) {
        this.canvasElements[index] = { ...this.currentImageElement };
        this.canvasElementsChange.emit([...this.canvasElements]);
      }
    }
    
    // Close the dialog
    this.showImageImportDialog = false;
    this.currentImageElement = null;
  }

  onCloseImageImportDialog(): void {
    this.showImageImportDialog = false;
    this.currentImageElement = null;
  }

  // Smart Layout Methods
  private calculateSnapPositions(draggedElement: CanvasElement): { x?: number; y?: number; type: 'edge' | 'center' }[] {
    const snapPositions: { x?: number; y?: number; type: 'edge' | 'center' }[] = [];
    
    // Get all other elements for snapping
    const otherElements = this.canvasElements.filter(el => el.id !== draggedElement.id);
    
    for (const element of otherElements) {
      // Calculate snap positions for edges and centers
      const elementLeft = element.x;
      const elementRight = element.x + element.width;
      const elementTop = element.y;
      const elementBottom = element.y + element.height;
      const elementCenterX = element.x + element.width / 2;
      const elementCenterY = element.y + element.height / 2;
      
      // Dragged element dimensions
      const draggedLeft = draggedElement.x;
      const draggedRight = draggedElement.x + draggedElement.width;
      const draggedTop = draggedElement.y;
      const draggedBottom = draggedElement.y + draggedElement.height;
      const draggedCenterX = draggedElement.x + draggedElement.width / 2;
      const draggedCenterY = draggedElement.y + draggedElement.height / 2;
      
      // Edge snapping
      snapPositions.push(
        { x: elementLeft - draggedElement.width, y: draggedTop, type: 'edge' }, // Left edge
        { x: elementRight, y: draggedTop, type: 'edge' }, // Right edge
        { x: draggedLeft, y: elementTop - draggedElement.height, type: 'edge' }, // Top edge
        { x: draggedLeft, y: elementBottom, type: 'edge' } // Bottom edge
      );
      
      // Center snapping
      snapPositions.push(
        { x: elementCenterX - draggedElement.width / 2, y: draggedTop, type: 'center' }, // Center X
        { x: draggedLeft, y: elementCenterY - draggedElement.height / 2, type: 'center' } // Center Y
      );
    }
    
    return snapPositions;
  }

  private applySmartSnap(draggedElement: CanvasElement, newX: number, newY: number): { x: number; y: number; width?: number; height?: number } {
    if (!this.isSmartLayoutMode) {
      this.showConnectionLine = false;
      this.connectionLine = null;
      return { x: newX, y: newY };
    }
    
    const snapPositions = this.calculateSnapPositions(draggedElement);
    let snappedX = newX;
    let snappedY = newY;
    let autoWidth = draggedElement.width;
    let autoHeight = draggedElement.height;
    
    // Check for horizontal snapping
    for (const snap of snapPositions) {
      if (snap.x !== undefined && Math.abs(newX - snap.x) <= this.snapThreshold) {
        snappedX = snap.x;
        break;
      }
    }
    
    // Check for vertical snapping
    for (const snap of snapPositions) {
      if (snap.y !== undefined && Math.abs(newY - snap.y) <= this.snapThreshold) {
        snappedY = snap.y;
        break;
      }
    }
    
    // Check for automatic sizing based on row/column space
    const autoSizeResult = this.calculateAutoSize(draggedElement, snappedX, snappedY);
    if (autoSizeResult) {
      autoWidth = autoSizeResult.width;
      autoHeight = autoSizeResult.height;
    }
    
    // Check for connection line (element below another element)
    this.checkForConnectionLine(draggedElement, snappedX, snappedY);
    
    return { x: snappedX, y: snappedY, width: autoWidth, height: autoHeight };
  }

  private checkForConnectionLine(draggedElement: CanvasElement, newX: number, newY: number) {
    if (!this.isSmartLayoutMode || !this.smartLayoutSettings.alignmentLines) {
      return;
    }
    
    const alignmentThreshold = 20; // pixels
    let alignmentType: 'horizontal' | 'vertical' | 'below' | null = null;
    let closestElement: CanvasElement | null = null;
    let minDistance = Infinity;
    
    for (const element of this.canvasElements) {
      if (element.id === draggedElement.id) continue;
      
      // Calculate precise element boundaries
      const elementLeft = element.x;
      const elementRight = element.x + element.width;
      const elementTop = element.y;
      const elementBottom = element.y + element.height;
      const elementCenterX = element.x + element.width / 2;
      const elementCenterY = element.y + element.height / 2;
      
      const draggedLeft = newX;
      const draggedRight = newX + draggedElement.width;
      const draggedTop = newY;
      const draggedBottom = newY + draggedElement.height;
      const draggedCenterX = newX + draggedElement.width / 2;
      const draggedCenterY = newY + draggedElement.height / 2;
      
      // Check for horizontal alignment (same Y level) - more precise
      const horizontalDistance = Math.abs(draggedCenterY - elementCenterY);
      if (horizontalDistance <= alignmentThreshold) {
        if (horizontalDistance < minDistance) {
          minDistance = horizontalDistance;
          closestElement = element;
          alignmentType = 'horizontal';
        }
      }
      
      // Check for vertical alignment (same X level) - more precise
      const verticalDistance = Math.abs(draggedCenterX - elementCenterX);
      if (verticalDistance <= alignmentThreshold) {
        if (verticalDistance < minDistance) {
          minDistance = verticalDistance;
          closestElement = element;
          alignmentType = 'vertical';
        }
      }
      
      // Check for element below another element - more precise
      const belowDistance = Math.abs(draggedTop - elementBottom);
      if (draggedTop >= elementBottom - alignmentThreshold && 
          draggedTop <= elementBottom + alignmentThreshold) {
        
        // Check if elements are horizontally overlapping or close
        const horizontalOverlap = !(draggedRight < elementLeft || draggedLeft > elementRight);
        const horizontalGap = Math.min(
          Math.abs(draggedLeft - elementRight),
          Math.abs(draggedRight - elementLeft)
        );
        
        if (horizontalOverlap || horizontalGap <= alignmentThreshold) {
          if (belowDistance < minDistance) {
            minDistance = belowDistance;
            closestElement = element;
            alignmentType = 'below';
          }
        }
      }
    }
    
    // Show connection line based on alignment type with precise coordinates
    if (closestElement && alignmentType) {
      this.showConnectionLine = true;
      
      // Calculate precise reference element center
      const referenceCenterX = closestElement.x + closestElement.width / 2;
      const referenceCenterY = closestElement.y + closestElement.height / 2;
      
      // Get canvas container bounds for accurate line positioning
      const canvasElement = this.canvasRef?.nativeElement;
      if (!canvasElement) return;
      
      const canvasRect = canvasElement.getBoundingClientRect();
      const canvasLeft = canvasRect.left;
      const canvasTop = canvasRect.top;
      
      switch (alignmentType) {
        case 'horizontal':
          // Horizontal alignment - show horizontal line across the paper layout through reference center
          this.connectionLine = {
            startX: this.paperLayoutLeft,
            startY: referenceCenterY,
            endX: this.paperLayoutLeft + this.paperLayoutWidth,
            endY: referenceCenterY
          };
          break;
          
        case 'vertical':
          // Vertical alignment - show vertical line across the paper layout starting from the top of the first element
          this.connectionLine = {
            startX: referenceCenterX,
            startY: closestElement.y,
            endX: referenceCenterX,
            endY: this.paperLayoutTop + this.paperLayoutHeight
          };
          break;
          
        case 'below':
          // Element below another - show horizontal line across the paper layout at the bottom of reference element
          this.connectionLine = {
            startX: this.paperLayoutLeft,
            startY: closestElement.y + closestElement.height,
            endX: this.paperLayoutLeft + this.paperLayoutWidth,
            endY: closestElement.y + closestElement.height
          };
          break;
      }
    } else {
      this.showConnectionLine = false;
      this.connectionLine = null;
    }
  }

  private adjustRowHeights(resizedElement: CanvasElement) {
    if (!this.isSmartLayoutMode || !this.smartLayoutSettings.heightWiseAdjustment) {
      return;
    }

    const rowThreshold = 30; // pixels - elements in same row if Y overlap is within this
    const newHeight = resizedElement.height;
    const originalHeight = this.resizeOriginalHeight;
    
    // Find elements in the same row based on Y-overlap (same logic as width adjustment)
    const elementsInRow = this.canvasElements.filter(element => {
      if (element.id === resizedElement.id) return false;
      
      // Check for Y-overlap within tolerance
      const elementTop = resizedElement.y;
      const elementBottom = resizedElement.y + resizedElement.height;
      const otherTop = element.y;
      const otherBottom = element.y + element.height;
      
      // Calculate overlap
      const overlap = Math.max(0, Math.min(elementBottom, otherBottom) - Math.max(elementTop, otherTop));
      const minHeight = Math.min(resizedElement.height, element.height);
      
      // Consider elements in same row if they have significant Y-overlap (at least 30% of smaller element's height)
      // or if they are within the threshold distance
      const overlapRatio = minHeight > 0 ? overlap / minHeight : 0;
      return overlapRatio >= 0.3 || Math.abs(resizedElement.y - element.y) <= rowThreshold;
    });
    
    if (elementsInRow.length > 0) {
      
      // Synchronize heights - all stuck elements should have the same height
      const targetHeight = resizedElement.height;
      elementsInRow.forEach(element => {
        element.height = targetHeight;
        
      });
      
      // Implement intelligent resizing - elements accommodate each other without overlapping
      this.implementIntelligentResizing(resizedElement, elementsInRow, 'height');
    }
    
  }

  private initializeOriginalDimensions(elements: CanvasElement[]) {
    elements.forEach(element => {
      // Only store original dimensions if they haven't been stored yet
      if (!(element as any).originalHeight) {
        (element as any).originalHeight = element.height;
      }
      if (!(element as any).originalWidth) {
        (element as any).originalWidth = element.width;
      }
    });
  }


  private implementIntelligentResizing(resizedElement: CanvasElement, stuckElements: CanvasElement[], resizeType: 'height' | 'width') {
    const paperLeft = this.paperLayoutLeft;
    const paperRight = this.paperLayoutLeft + this.paperLayoutWidth;
    const paperTop = this.paperLayoutTop;
    const paperBottom = this.paperLayoutTop + this.paperLayoutHeight;
    
    if (resizeType === 'height') {
      // For height resizing, adjust widths to accommodate each other
      const allElements = [resizedElement, ...stuckElements];
      const sortedElements = allElements.sort((a, b) => a.x - b.x);
      
      // Calculate total available width
      const totalAvailableWidth = paperRight - paperLeft;
      let totalCurrentWidth = sortedElements.reduce((sum, el) => sum + el.width, 0);
      
      // If elements exceed available width, proportionally reduce their widths
      if (totalCurrentWidth > totalAvailableWidth) {
        const availableForElements = totalAvailableWidth;
        const reductionRatio = availableForElements / totalCurrentWidth;
        sortedElements.forEach(el => {
          el.width = Math.max(50, el.width * reductionRatio);
        });
      }
      
      // Reposition elements to fill available space with padding
      let currentX = paperLeft;
      const finalTotalWidth = sortedElements.reduce((sum, el) => sum + el.width, 0);
      const availableForElements = totalAvailableWidth;
      const spacing = sortedElements.length > 1 ? Math.max(0, (availableForElements - finalTotalWidth) / (sortedElements.length - 1)) : 0;
      
      sortedElements.forEach((el, index) => {
        el.x = currentX;
        currentX += el.width + spacing;
      });
      
    } else if (resizeType === 'width') {
      // For width resizing, implement smart width adjustment where one element's increase decreases others
      const allElements = [resizedElement, ...stuckElements];
      const sortedElements = allElements.sort((a, b) => a.x - b.x);
      
      // Calculate total available width
      const totalAvailableWidth = paperRight - paperLeft;
      
      // Calculate the change in width of the resized element
      const originalWidth = this.resizeOriginalWidth;
      const newWidth = resizedElement.width;
      const widthChange = newWidth - originalWidth;
      
      if (Math.abs(widthChange) > 5) { // Only if there's a significant change
        // Find the index of the resized element
        const resizedIndex = sortedElements.findIndex(el => el.id === resizedElement.id);
        
        if (resizedIndex !== -1) {
          // Distribute the width change among other elements
          const otherElements = sortedElements.filter((el, index) => index !== resizedIndex);
          
          if (otherElements.length > 0) {
            // Calculate how much width each other element should lose/gain
            const widthChangePerElement = -widthChange / otherElements.length;
            
            otherElements.forEach(element => {
              const newElementWidth = Math.max(50, element.width + widthChangePerElement);
              element.width = newElementWidth;
            });
          }
        }
      }
      
      // Ensure total width doesn't exceed available space (accounting for padding)
      const totalWidth = sortedElements.reduce((sum, el) => sum + el.width, 0);
      if (totalWidth > totalAvailableWidth) {
        const availableForElements = totalAvailableWidth;
        const reductionRatio = availableForElements / totalWidth;
        sortedElements.forEach(el => {
          el.width = Math.max(50, el.width * reductionRatio);
        });
      }
      
      // Reposition elements to fill available space with padding
      let currentX = paperLeft;
      const finalTotalWidth = sortedElements.reduce((sum, el) => sum + el.width, 0);
      const availableForElements = totalAvailableWidth;
      const spacing = sortedElements.length > 1 ? Math.max(0, (availableForElements - finalTotalWidth) / (sortedElements.length - 1)) : 0;
      
      sortedElements.forEach((el, index) => {
        el.x = currentX;
        currentX += el.width + spacing;
      });
    }
  }

  private adjustRowWidths(element: CanvasElement, isWidthResize: boolean = false) {
    if (!this.isSmartLayoutMode || !this.smartLayoutSettings.rowWiseAdjustment) {
      return;
    }

    const rowThreshold = 30; // pixels - elements in same row if Y overlap is within this
    const paperLeft = this.paperLayoutLeft;
    const paperRight = this.paperLayoutLeft + this.paperLayoutWidth;
    
    
    // Find elements in the same row based on Y-overlap
    const elementsInRow = this.canvasElements.filter(otherElement => {
      if (otherElement.id === element.id) return false;
      
      // Check for Y-overlap within tolerance
      const elementTop = element.y;
      const elementBottom = element.y + element.height;
      const otherTop = otherElement.y;
      const otherBottom = otherElement.y + otherElement.height;
      
      // Calculate overlap
      const overlap = Math.max(0, Math.min(elementBottom, otherBottom) - Math.max(elementTop, otherTop));
      const minHeight = Math.min(element.height, otherElement.height);
      
      // Consider elements in same row if they have significant Y-overlap (at least 30% of smaller element's height)
      const overlapRatio = minHeight > 0 ? overlap / minHeight : 0;
      return overlapRatio >= 0.3 || Math.abs(element.y - otherElement.y) <= rowThreshold;
    });
    
    if (elementsInRow.length === 0) return;
    
    // Add the current element to the row for calculations
    const allRowElements = [...elementsInRow, element];
    
    if (isWidthResize) {
      if (elementsInRow.length > 0) {
        
        // Synchronize heights - all stuck elements should have the same height
        const targetHeight = element.height;
        elementsInRow.forEach(stuckElement => {
          stuckElement.height = targetHeight;
          
        });
        
        // Implement intelligent resizing - elements accommodate each other without overlapping
        this.implementIntelligentResizing(element, elementsInRow, 'width');
      }
      
    } else {
      // If this is a drag operation, synchronize heights and use space distribution logic
      const sortedElements = allRowElements.sort((a, b) => a.x - b.x);
      
      // Synchronize heights - all stuck elements should have the same height
      const targetHeight = Math.max(...sortedElements.map(el => el.height));
      sortedElements.forEach(el => {
        el.height = targetHeight;
        
      });
      
      // Calculate total available width in the paper layout
      const totalAvailableWidth = paperRight - paperLeft;
      
      // Calculate current total width of all elements in row (including gaps)
      const currentTotalWidth = sortedElements.reduce((total, el) => total + el.width, 0);
      const totalWidthWithPadding = currentTotalWidth;
      
      // If elements don't fill the full width, distribute the remaining space
      if (totalWidthWithPadding < totalAvailableWidth) {
        const remainingSpace = totalAvailableWidth - totalWidthWithPadding;
        const spacePerElement = remainingSpace / sortedElements.length;
        
        // Adjust each element's width
        sortedElements.forEach(el => {
          el.width = Math.max(50, el.width + spacePerElement); // Minimum 50px width
        });
      }
      // If elements exceed the paper width, proportionally reduce their widths
      else if (totalWidthWithPadding > totalAvailableWidth) {
        const availableForElements = totalAvailableWidth;
        const reductionRatio = availableForElements / currentTotalWidth;
        
        sortedElements.forEach(el => {
          el.width = Math.max(50, el.width * reductionRatio); // Minimum 50px width
        });
      }
      
      // Reposition elements to fill the row evenly with padding
      let currentX = paperLeft;
      const totalElementWidth = sortedElements.reduce((sum, el) => sum + el.width, 0);
      const availableForElements = totalAvailableWidth;
      const spacing = sortedElements.length > 1 ? Math.max(0, (availableForElements - totalElementWidth) / (sortedElements.length - 1)) : 0;
      
      sortedElements.forEach((el, index) => {
        el.x = currentX;
        currentX += el.width + spacing;
      });
      
    }
  }

  private calculateAutoSize(draggedElement: CanvasElement, newX: number, newY: number): { width: number; height: number } | null {
    if (!this.isSmartLayoutMode) {
      return null;
    }

    const rowThreshold = 30; // pixels - elements in same row if Y difference is within this
    const minElementWidth = 50; // minimum width for an element
    const minElementHeight = 30; // minimum height for an element
    
    // Find elements in the same row (similar Y position)
    const elementsInRow = this.canvasElements.filter(element => 
      element.id !== draggedElement.id && 
      Math.abs(element.y - newY) <= rowThreshold
    );
    
    if (elementsInRow.length === 0) {
      return null;
    }
    
    // Check if there's available space in the row
    const paperLeft = this.paperLayoutLeft;
    const paperRight = this.paperLayoutLeft + this.paperLayoutWidth;
    
    // Calculate available space in the row
    let availableSpace = 0;
    let canFitInRow = false;
    
    // Sort elements by X position
    const sortedElements = elementsInRow.sort((a, b) => a.x - b.x);
    
    // Check if we can fit in existing gaps
    for (let i = 0; i < sortedElements.length - 1; i++) {
      const currentElement = sortedElements[i];
      const nextElement = sortedElements[i + 1];
      const gap = nextElement.x - (currentElement.x + currentElement.width);
      
      if (gap >= minElementWidth) {
        availableSpace = gap;
        canFitInRow = true;
        break;
      }
    }
    
    // Check space at the end of the row
    const lastElement = sortedElements[sortedElements.length - 1];
    const endSpace = paperRight - (lastElement.x + lastElement.width);
    
    if (endSpace >= minElementWidth && endSpace > availableSpace) {
      availableSpace = endSpace;
      canFitInRow = true;
    }
    
    // Check space at the beginning of the row
    const firstElement = sortedElements[0];
    const startSpace = firstElement.x - paperLeft;
    
    if (startSpace >= minElementWidth && startSpace > availableSpace) {
      availableSpace = startSpace;
      canFitInRow = true;
    }
    
    if (canFitInRow && availableSpace >= minElementWidth) {
      // Auto-size the element to fit the available space
      const minWidth = (draggedElement.type === 'text' || draggedElement.type === 'textarea') 
        ? this.getMinTextElementWidth(draggedElement.fontSize) 
        : minElementWidth;
      const newWidth = Math.max(minWidth, Math.min(availableSpace - 10, draggedElement.width * 2)); // Leave 10px margin
      const newHeight = Math.max(minElementHeight, draggedElement.height);
      
      return { width: newWidth, height: newHeight };
    }
    
    // Check for column-based auto-sizing (similar logic for vertical arrangement)
    const columnThreshold = 30; // pixels - elements in same column if X difference is within this
    
    const elementsInColumn = this.canvasElements.filter(element => 
      element.id !== draggedElement.id && 
      Math.abs(element.x - newX) <= columnThreshold
    );
    
    if (elementsInColumn.length > 0) {
      const paperTop = this.paperLayoutTop;
      const paperBottom = this.paperLayoutTop + this.paperLayoutHeight;
      
      // Sort elements by Y position
      const sortedColumnElements = elementsInColumn.sort((a, b) => a.y - b.y);
      
      // Check available space in column
      let columnAvailableSpace = 0;
      let canFitInColumn = false;
      
      // Check gaps between elements
      for (let i = 0; i < sortedColumnElements.length - 1; i++) {
        const currentElement = sortedColumnElements[i];
        const nextElement = sortedColumnElements[i + 1];
        const gap = nextElement.y - (currentElement.y + currentElement.height);
        
        if (gap >= minElementHeight) {
          columnAvailableSpace = gap;
          canFitInColumn = true;
          break;
        }
      }
      
      // Check space at the end and beginning of column
      const lastColumnElement = sortedColumnElements[sortedColumnElements.length - 1];
      const endColumnSpace = paperBottom - (lastColumnElement.y + lastColumnElement.height);
      
      const firstColumnElement = sortedColumnElements[0];
      const startColumnSpace = firstColumnElement.y - paperTop;
      
      const maxColumnSpace = Math.max(endColumnSpace, startColumnSpace);
      
      if (maxColumnSpace >= minElementHeight && maxColumnSpace > columnAvailableSpace) {
        columnAvailableSpace = maxColumnSpace;
        canFitInColumn = true;
      }
      
      if (canFitInColumn && columnAvailableSpace >= minElementHeight) {
        const minWidth = (draggedElement.type === 'text' || draggedElement.type === 'textarea') 
          ? this.getMinTextElementWidth(draggedElement.fontSize) 
          : minElementWidth;
        const newWidth = Math.max(minWidth, draggedElement.width);
        const newHeight = Math.max(minElementHeight, Math.min(columnAvailableSpace - 10, draggedElement.height * 2)); // Leave 10px margin
        
        return { width: newWidth, height: newHeight };
      }
    }
    
    return null;
  }


  private calculateDynamicFlowLayout(draggedElement: CanvasElement): { x: number; y: number } {
    if (!this.isSmartLayoutMode) {
      return { x: draggedElement.x, y: draggedElement.y };
    }
    
    // Simple flow layout: arrange elements in a grid-like pattern
    const otherElements = this.canvasElements.filter(el => el.id !== draggedElement.id);
    if (otherElements.length === 0) {
      return { x: draggedElement.x, y: draggedElement.y };
    }
    
    // Calculate average spacing and arrange elements
    const sortedElements = otherElements.sort((a, b) => a.x - b.x);
    const spacing = 20; // Default spacing
    const startX = Math.min(...otherElements.map(el => el.x));
    const startY = Math.min(...otherElements.map(el => el.y));
    
    // Simple horizontal flow
    let currentX = startX;
    let currentY = startY;
    
    for (const element of sortedElements) {
      element.x = currentX;
      element.y = currentY;
      currentX += element.width + spacing;
      
      // Wrap to next row if needed
      if (currentX > this.paperLayoutWidth - draggedElement.width) {
        currentX = startX;
        currentY += Math.max(...sortedElements.map(el => el.height)) + spacing;
      }
    }
    
    // Position the dragged element at the end
    const lastElement = sortedElements[sortedElements.length - 1];
    return {
      x: lastElement.x + lastElement.width + spacing,
      y: lastElement.y
    };
  }

  // Method to update smart layout settings
  updateSmartLayoutSettings(settings: SmartLayoutSettings) {
    this.smartLayoutSettings = { ...settings };
  }

  // ==========================================================================
  // Undo/Redo Methods
  // ==========================================================================

  /**
   * Undo the last action
   */
  undo(): void {
    const action = this.historyService.undo();
    if (action) {
      this.executeUndoAction(action);
      this.updateUndoRedoState();
    }
  }

  /**
   * Redo the next action
   */
  redo(): void {
    const action = this.historyService.redo();
    if (action) {
      this.executeRedoAction(action);
      this.updateUndoRedoState();
    }
  }

  /**
   * Update undo/redo button states
   */
  private updateUndoRedoState(): void {
    this.canUndo = this.historyService.canUndo();
    this.canRedo = this.historyService.canRedo();
  }

  /**
   * Execute an undo action
   */
  private executeUndoAction(action: any): void {
    switch (action.type) {
      case HistoryActionType.ADD_ELEMENT:
        this.undoAddElement(action.data);
        break;
      case HistoryActionType.REMOVE_ELEMENT:
        this.undoRemoveElement(action.data);
        break;
      case HistoryActionType.MOVE_ELEMENT:
        this.undoMoveElement(action.data);
        break;
      case HistoryActionType.RESIZE_ELEMENT:
        this.undoResizeElement(action.data);
        break;
      case HistoryActionType.UPDATE_ELEMENT_PROPERTIES:
        this.undoUpdateElementProperties(action.data);
        break;
      case HistoryActionType.DUPLICATE_ELEMENT:
        this.undoDuplicateElement(action.data);
        break;
      case HistoryActionType.GROUP_ELEMENTS:
        this.undoGroupElements(action.data);
        break;
      case HistoryActionType.UNGROUP_ELEMENTS:
        this.undoUngroupElements(action.data);
        break;
      case HistoryActionType.PAPER_LAYOUT_MOVE:
        this.undoPaperLayoutMove(action.data);
        break;
      case HistoryActionType.PAPER_LAYOUT_RESIZE:
        this.undoPaperLayoutResize(action.data);
        break;
      case HistoryActionType.BRING_TO_FRONT:
        this.undoBringToFront(action.data);
        break;
    }
  }

  /**
   * Execute a redo action
   */
  private executeRedoAction(action: any): void {
    switch (action.type) {
      case HistoryActionType.ADD_ELEMENT:
        this.redoAddElement(action.data);
        break;
      case HistoryActionType.REMOVE_ELEMENT:
        this.redoRemoveElement(action.data);
        break;
      case HistoryActionType.MOVE_ELEMENT:
        this.redoMoveElement(action.data);
        break;
      case HistoryActionType.RESIZE_ELEMENT:
        this.redoResizeElement(action.data);
        break;
      case HistoryActionType.UPDATE_ELEMENT_PROPERTIES:
        this.redoUpdateElementProperties(action.data);
        break;
      case HistoryActionType.DUPLICATE_ELEMENT:
        this.redoDuplicateElement(action.data);
        break;
      case HistoryActionType.GROUP_ELEMENTS:
        this.redoGroupElements(action.data);
        break;
      case HistoryActionType.UNGROUP_ELEMENTS:
        this.redoUngroupElements(action.data);
        break;
      case HistoryActionType.PAPER_LAYOUT_MOVE:
        this.redoPaperLayoutMove(action.data);
        break;
      case HistoryActionType.PAPER_LAYOUT_RESIZE:
        this.redoPaperLayoutResize(action.data);
        break;
      case HistoryActionType.BRING_TO_FRONT:
        this.redoBringToFront(action.data);
        break;
    }
  }

  // Undo implementations
  private undoAddElement(data: any): void {
    this.canvasElements = this.canvasElements.filter(el => el.id !== data.element.id);
    this.updateCanvasElements();
  }

  private undoRemoveElement(data: any): void {
    this.canvasElements.push(data.element);
    this.updateCanvasElements();
  }

  private undoMoveElement(data: any): void {
    const element = this.canvasElements.find(el => el.id === data.elementId);
    if (element) {
      element.x = data.fromX;
      element.y = data.fromY;
      this.updateCanvasElements();
    }
  }

  private undoResizeElement(data: any): void {
    const element = this.canvasElements.find(el => el.id === data.elementId);
    if (element) {
      element.width = data.fromWidth;
      element.height = data.fromHeight;
      this.updateCanvasElements();
    }
  }

  private undoUpdateElementProperties(data: any): void {
    const element = this.canvasElements.find(el => el.id === data.elementId);
    if (element) {
      Object.assign(element, data.oldProperties);
      this.updateCanvasElements();
    }
  }

  private undoDuplicateElement(data: any): void {
    this.canvasElements = this.canvasElements.filter(el => el.id !== data.duplicatedElement.id);
    this.updateCanvasElements();
  }

  private undoGroupElements(data: any): void {
    // Remove the group
    this.elementGroups.delete(data.groupId);
    this.elementGroupsChange.emit(this.elementGroups);
  }

  private undoUngroupElements(data: any): void {
    // Recreate the group
    const group: ElementGroup = {
      id: data.groupId,
      name: `Group ${data.groupId}`,
      elementIds: new Set(data.elementIds),
      color: this.generateGroupColor(),
      createdAt: new Date()
    };
    this.elementGroups.set(data.groupId, group);
    this.elementGroupsChange.emit(this.elementGroups);
  }

  private undoPaperLayoutMove(data: any): void {
    this.paperLayoutLeft = data.fromX;
    this.paperLayoutTop = data.fromY;
    this.paperLayoutChange.emit({
      left: this.paperLayoutLeft,
      top: this.paperLayoutTop,
      width: this.paperLayoutWidth,
      height: this.paperLayoutHeight
    });
  }

  private undoPaperLayoutResize(data: any): void {
    this.paperLayoutWidth = data.fromWidth;
    this.paperLayoutHeight = data.fromHeight;
    this.paperLayoutResized.emit({
      width: this.paperLayoutWidth,
      height: this.paperLayoutHeight
    });
  }

  // Redo implementations
  private redoAddElement(data: any): void {
    this.canvasElements.push(data.element);
    this.updateCanvasElements();
  }

  private redoRemoveElement(data: any): void {
    this.canvasElements = this.canvasElements.filter(el => el.id !== data.element.id);
    this.updateCanvasElements();
  }

  private redoMoveElement(data: any): void {
    const element = this.canvasElements.find(el => el.id === data.elementId);
    if (element) {
      element.x = data.finalX;
      element.y = data.finalY;
      this.updateCanvasElements();
    }
  }

  private redoResizeElement(data: any): void {
    const element = this.canvasElements.find(el => el.id === data.elementId);
    if (element) {
      element.width = data.finalWidth;
      element.height = data.finalHeight;
      this.updateCanvasElements();
    }
  }

  private redoUpdateElementProperties(data: any): void {
    const element = this.canvasElements.find(el => el.id === data.elementId);
    if (element) {
      Object.assign(element, data.newProperties);
      this.updateCanvasElements();
    }
  }

  private redoDuplicateElement(data: any): void {
    this.canvasElements.push(data.duplicatedElement);
    this.updateCanvasElements();
  }

  private redoGroupElements(data: any): void {
    const group: ElementGroup = {
      id: data.groupId,
      name: `Group ${data.groupId}`,
      elementIds: new Set(data.elementIds),
      color: this.generateGroupColor(),
      createdAt: new Date()
    };
    this.elementGroups.set(data.groupId, group);
    this.elementGroupsChange.emit(this.elementGroups);
  }

  private redoUngroupElements(data: any): void {
    this.elementGroups.delete(data.groupId);
    this.elementGroupsChange.emit(this.elementGroups);
  }

  private redoPaperLayoutMove(data: any): void {
    this.paperLayoutLeft = data.finalX;
    this.paperLayoutTop = data.finalY;
    this.paperLayoutChange.emit({
      left: this.paperLayoutLeft,
      top: this.paperLayoutTop,
      width: this.paperLayoutWidth,
      height: this.paperLayoutHeight
    });
  }

  private redoPaperLayoutResize(data: any): void {
    this.paperLayoutWidth = data.finalWidth;
    this.paperLayoutHeight = data.finalHeight;
    this.paperLayoutResized.emit({
      width: this.paperLayoutWidth,
      height: this.paperLayoutHeight
    });
  }

  private undoBringToFront(data: any): void {
    const element = this.canvasElements.find(el => el.id === data.elementId);
    if (element) {
      // Remove from current position
      const currentIndex = this.canvasElements.findIndex(el => el.id === data.elementId);
      if (currentIndex !== -1) {
        const element = this.canvasElements.splice(currentIndex, 1)[0];
        // Insert at original position
        this.canvasElements.splice(data.fromIndex, 0, element);
        this.updateCanvasElements();
      }
    }
  }

  private redoBringToFront(data: any): void {
    const element = this.canvasElements.find(el => el.id === data.elementId);
    if (element) {
      // Remove from current position
      const currentIndex = this.canvasElements.findIndex(el => el.id === data.elementId);
      if (currentIndex !== -1) {
        const element = this.canvasElements.splice(currentIndex, 1)[0];
        // Insert at final position (end of array)
        this.canvasElements.push(element);
        this.updateCanvasElements();
      }
    }
  }

  /**
   * Add an action to history
   */
  private addToHistory(action: any): void {
    this.historyService.addAction(action);
    this.updateUndoRedoState();
  }

}


