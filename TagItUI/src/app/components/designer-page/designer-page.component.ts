import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { DesignerComponent } from '../designer/designer.component';
import { LabelTemplateService, ApiConfigService } from '../../services';
import { PdfGenerationService } from '../../services/pdf-generation.service';
import { TemplateManagementService } from '../../services/template-management.service';
import { DashboardService } from '../../services/dashboard.service';
import { ViewingModeService, ViewingMode, DEFAULT_VIEWING_MODE, ViewingModeFactory } from '../../services/viewing-mode.service';
import { LivePreviewPopupService } from '../../services/live-preview-popup.service';
import { filter } from 'rxjs/operators';

interface SmartLayoutSettings {
  elementSticking: boolean;
  rowWiseAdjustment: boolean;
  heightWiseAdjustment: boolean;
  alignmentLines: boolean;
}

@Component({
  selector: 'app-designer-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DesignerComponent],
  templateUrl: './designer-page.component.html',
  styleUrls: ['./designer-page.component.scss']
})
export class DesignerPageComponent implements OnInit, AfterViewInit, OnDestroy {
  // Theme and UI state
  isDarkMode = true;
  isSidebarExpanded = false;
  selectedPaperSize = 'Pallet Label (6 x 6 in)';
  clearReferenceLinesSignal = false;

  // Tool state
  selectedTool:
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
  isGroupingMode = false;
  isSmartLayoutMode = false;
  elementGroups: Map<string, any> = new Map();

  // Smart Layout Panel state
  isSmartLayoutPanelVisible = false;
  smartLayoutSettings: SmartLayoutSettings = {
    elementSticking: true,
    rowWiseAdjustment: true,
    heightWiseAdjustment: true,
    alignmentLines: true
  };


  // Template state
  selectedTemplate: any = null;
  showDeleteDialog = false;
  
  // Viewing mode state
  viewingMode: ViewingMode = DEFAULT_VIEWING_MODE;
  
  // Query parameters
  templateId: string | null = null;
  librarySource: string | null = null;
  mode: string | null = null;

  constructor(
    private labelTemplateService: LabelTemplateService,
    private pdfService: PdfGenerationService,
    private templateManagementService: TemplateManagementService,
    private apiConfig: ApiConfigService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private dashboardService: DashboardService,
    private viewingModeService: ViewingModeService,
    private livePreviewPopupService: LivePreviewPopupService
  ) {}

  ngOnInit() {
    // Load theme preference from localStorage, default to dark mode
    const savedTheme = localStorage.getItem('tagit-theme');
    this.isDarkMode = savedTheme === 'light' ? false : true;

    // If no theme preference is saved, explicitly set to dark mode
    if (!savedTheme) {
      this.isDarkMode = true;
      localStorage.setItem('tagit-theme', 'dark');
    }

    // Apply initial theme
    document.body.classList.toggle('dark-theme', this.isDarkMode);

    // Listen for navigation events to close live preview when leaving designer page
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        // If navigating away from designer page, close live preview
        if (!event.url.includes('/designer')) {
          if (this.livePreviewPopupService.isPreviewOpen()) {
            this.livePreviewPopupService.closePreview();
          }
        }
      });

    // Check for template loading from query parameters
    this.route.queryParams.subscribe(params => {
      // Store query parameters
      this.templateId = params['templateId'];
      this.librarySource = params['librarySource'];
      this.mode = params['mode'];
      
      if (params['templateId']) {
        this.loadTemplateForViewing(params['templateId'], params['version'], params['mode']);
      } else {
        // For new templates, determine viewing mode based on available parameters
        this.updateViewingMode(null);
      }
    });
  }

  ngAfterViewInit() {
    // Set the theme state in the header component after view initialization
    if (this.cdr) {
      this.cdr.detectChanges();
    }
  }

  // Event handlers

  onPaperSizeChange(size: string): void {
    this.selectedPaperSize = size;
  }

  onSelectedPaperSizeChange(size: string): void {
    this.selectedPaperSize = size;
  }


  onSelectedTemplateChange(template: any): void {
    this.selectedTemplate = template;
    // Update viewing mode when template changes (e.g., after saving)
    this.updateViewingMode(template);
  }

  onShowDeleteDialogChange(show: boolean): void {
    this.showDeleteDialog = show;
  }

  onThemeChange(isDark: boolean): void {
    this.isDarkMode = isDark;
    document.body.classList.toggle('dark-theme', isDark);
    localStorage.setItem('tagit-theme', isDark ? 'dark' : 'light');
  }

  onClearReferenceLines(): void {
    this.clearReferenceLinesSignal = true;
    setTimeout(() => {
      this.clearReferenceLinesSignal = false;
    }, 100);
  }

  onClearAll(): void {
    // This method is no longer needed as canvas state is managed by DesignerComponent
  }

  onResetZoom(): void {
    // Reset zoom logic
  }

  onClearGrouping(): void {
    this.elementGroups.clear();
  }

  onResetSmartLayout(): void {
    this.smartLayoutSettings = {
      elementSticking: true,
      rowWiseAdjustment: true,
      heightWiseAdjustment: true,
      alignmentLines: true
    };
  }

  onSidebarExpandedChange(expanded: boolean): void {
    this.isSidebarExpanded = expanded;
  }

  onSelectedToolChange(tool: any): void {
    this.selectedTool = tool;
  }

  onToolDragStart(event: any): void {
    // Handle tool drag start
  }

  onTemplateComponentDragStart(event: any): void {
    // Handle template component drag start
  }

  onPlaceholderDragStart(event: any): void {
    // Handle placeholder drag start
  }

  onCreateElement(element: any): void {
    // Handle create element
  }

  onGroupingModeChange(mode: boolean): void {
    this.isGroupingMode = mode;
  }

  onSmartLayoutModeChange(mode: boolean): void {
    this.isSmartLayoutMode = mode;
  }

  onElementGroupsChange(groups: Map<string, any>): void {
    this.elementGroups = groups;
  }

  onCanvasShowBanner(banner: any): void {
    // Handle canvas banner
  }

  onElementUpdate(element: any): void {
    // Handle element update
  }

  onElementDelete(element: any): void {
    // Handle element delete
  }

  onElementDeselect(): void {
    // This method is no longer needed as canvas state is managed by DesignerComponent
  }

  onElementBringToFront(): void {
    // Handle bring to front
  }

  onUngroupAllElements(): void {
    this.elementGroups.clear();
  }

  onUngroupSingleElement(element: any): void {
    // Handle ungroup single element
  }

  onUngroupGroup(group: any): void {
    // Handle ungroup group
  }

  onElementHover(element: any): void {
    // Handle element hover
  }

  onSmartLayoutSettingsChange(settings: SmartLayoutSettings): void {
    this.smartLayoutSettings = settings;
  }

  onToggleSmartLayoutPanel(): void {
    this.isSmartLayoutPanelVisible = !this.isSmartLayoutPanelVisible;
  }

  loadTemplateForViewing(templateId: string, version?: string, mode?: string): void {
    // Load template data from the backend
    this.labelTemplateService.getTemplate(parseInt(templateId))
      .subscribe({
        next: (template) => {
          // Fetch design state information to get the complete template data
          console.log('Fetching template with versions for templateId:', templateId);
          this.dashboardService.getTemplateWithVersions(parseInt(templateId))
            .subscribe({
              next: (templateWithVersions) => {
                console.log('getTemplateWithVersions response:', templateWithVersions);
                
                // Merge the template data with design state information
                this.selectedTemplate = {
                  ...template,
                  designStateId: templateWithVersions.designStateId, // [FIX] Include designStateId for comments
                  designState: templateWithVersions.designState || 'Draft',
                  designerId: templateWithVersions.designerId,
                  designerName: templateWithVersions.designerName,
                  reviewerId: templateWithVersions.reviewerId,
                  reviewerName: templateWithVersions.reviewerName
                };
                
                // Update viewing mode based on loaded template
                this.updateViewingMode(this.selectedTemplate);
                
                console.log('Template with design state loaded:', {
                  templateId: template.templateId,
                  templateName: template.name,
                  designState: this.selectedTemplate.designState,
                  reviewerId: this.selectedTemplate.reviewerId,
                  viewingMode: this.viewingMode,
                  selectedTemplate: this.selectedTemplate
                });
              },
              error: (error) => {
                console.error('Error loading template with versions:', error);
                console.log('Falling back to basic template data with default design state');
                // Fallback to basic template data with default design state
                this.selectedTemplate = {
                  ...template,
                  designStateId: null, // [FIX] Include designStateId field (null for fallback)
                  designState: 'Draft',
                  designerId: null,
                  designerName: null,
                  reviewerId: null,
                  reviewerName: null
                };
                this.updateViewingMode(this.selectedTemplate);
                console.log('Using fallback template data:', this.selectedTemplate);
              }
            });
        },
        error: (error) => {
          console.error('Error loading template:', error);
        }
      });
  }

  /**
   * Update viewing mode based on template and query parameters
   */
  private updateViewingMode(template: any): void {
    // Check if this is collaboration mode
    if (this.mode === 'collaborate') {
      // Use special collaboration mode for public library templates
      if (this.librarySource === 'public') {
        this.viewingMode = ViewingModeFactory.createPublicLibraryCollaborationMode();
        console.log('Public library collaboration mode activated:', {
          template: template?.name || 'New Template',
          librarySource: this.librarySource,
          viewingMode: this.viewingMode
        });
      } else {
        this.viewingMode = ViewingModeFactory.createCollaborationMode();
        console.log('Collaboration mode activated:', {
          template: template?.name || 'New Template',
          librarySource: this.librarySource,
          viewingMode: this.viewingMode
        });
      }
    } else {
      this.viewingMode = this.viewingModeService.determineViewingMode(
        template,
        this.librarySource || undefined,
        template?.designState
      );
      
      console.log('Viewing mode updated:', {
        template: template?.name || 'New Template',
        librarySource: this.librarySource,
        designState: template?.designState,
        viewingMode: this.viewingMode
      });
    }
  }

  ngOnDestroy() {
    // Close live preview when leaving designer page
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

}
