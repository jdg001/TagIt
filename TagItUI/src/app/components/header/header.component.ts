import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LabelTemplateService, CanvasElement, LabelSize, LABEL_SIZES, DesignStateService, CreateDesignStateRequest, ThemeService } from '../../services';
import { DashboardService } from '../../services/dashboard.service';
import { TemplateManagementService } from '../../services/template-management.service';
import { PdfGenerationService } from '../../services/pdf-generation.service';
import { ApiConfigService } from '../../services/api-config.service';
import { CommentService } from '../../services/comment.service';
import { TemplateThumbnailService } from '../../services/template-thumbnail.service';
import { CollaborationService } from '../../services/collaboration.service';
import { TooltipDirective } from '../tooltip/tooltip.directive';
import { CsvImportComponent, CsvImportData } from '../csv-import/csv-import.component';
import { ViewingMode, DEFAULT_VIEWING_MODE } from '../../services/viewing-mode.service';

type BannerKind = 'info' | 'success' | 'warning' | 'error';
interface BannerMsg { id: number; text: string; kind: BannerKind; dismissing?: boolean; }

@Component({
    standalone: true,
    selector: 'app-header',
    imports: [CommonModule, FormsModule, TooltipDirective, CsvImportComponent],
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy, OnChanges {
  @Input() canvasElements: CanvasElement[] = [];
  @Input() paperLayoutLeft: number = 0;
  @Input() paperLayoutTop: number = 0;
  @Input() paperLayoutWidth: number = 576; // 6 inches × 96 DPI
  @Input() paperLayoutHeight: number = 576; // 6 inches × 96 DPI
  @Input() selectedTemplate: any = null;
  @Input() canvasComponent: any = null;
  @Input() viewingMode: ViewingMode = DEFAULT_VIEWING_MODE;
  @Input() currentDesignStateId: number | null = null; // [CHANGE] Current design state ID for comments
  @Input() hasSelection: boolean = false;
  @Input() canUndo: boolean = false;
  @Input() canRedo: boolean = false;
  @Input() elementGroups: Map<string, any> = new Map();
  @Input() isCollaborationMode: boolean = false; // Current collaboration mode state
  @Input() librarySource: string | null = null; // Library source to determine if template is from public library

  @Output() canvasElementsChange = new EventEmitter<CanvasElement[]>();
  @Output() selectedElementChange = new EventEmitter<CanvasElement | null>();
  @Output() selectedPaperSizeChange = new EventEmitter<string>();
  @Output() paperLayoutChange = new EventEmitter<{left: number, top: number, width: number, height: number}>();
  @Output() selectedTemplateChange = new EventEmitter<any>();
  @Output() showDeleteDialogChange = new EventEmitter<boolean>();
  @Output() themeChange = new EventEmitter<boolean>();
  @Output() clearReferenceLines = new EventEmitter<void>();
  @Output() clearAll = new EventEmitter<void>();
  @Output() resetZoom = new EventEmitter<void>();
  @Output() clearGrouping = new EventEmitter<void>();
  @Output() resetSmartLayout = new EventEmitter<void>();
  @Output() commentModeChange = new EventEmitter<boolean>(); // [CHANGE] Comment mode change event
  @Output() undo = new EventEmitter<void>();
  @Output() redo = new EventEmitter<void>();
  @Output() bringToFront = new EventEmitter<void>();
  @Output() deleteSelected = new EventEmitter<void>();
  @Output() viewCommentsClick = new EventEmitter<void>(); // [CHANGE] View comments button click event
  @Output() ungroupAll = new EventEmitter<void>();
  @Output() collaborationModeChange = new EventEmitter<boolean>(); // Collaboration mode toggle event

  // Internal state
  isDarkMode = true;
  selectedPaperSize = 'Pallet Label (6 x 6 in)'; // Default to Pallet Label paper size
  isCommentMode = false; // [CHANGE] Comment mode state
  commentCount = 0; // [CHANGE] Number of comments
  unresolvedCommentCount = 0; // [CHANGE] Number of unresolved comments
  
  // Collaboration mode state (now received as input)
  collaborationUsers: any[] = [];
  currentSessionId: string | null = null;
  
  // Placeholder dialog state
  showPlaceholderDialog = false;
  placeholderValues: { [key: string]: string } = {};
  
  // CSV import dialog state
  showCsvImportDialog = false;
  csvImportData: CsvImportData | null = null;
  currentTemplateId: number | null = null;
  
  // PDF generation timeout
  private pdfGenerationTimeout: any = null;
  
  // Paper size dropdown state
  showPaperSizeDropdown = false;

  // Standard paper sizes
  standardPaperSizes = [
    { name: 'A4', width: 8.27, height: 11.69, unit: 'inch', description: 'A4 (8.27 × 11.69 in)' },
    { name: 'Letter', width: 8.5, height: 11, unit: 'inch', description: 'Letter (8.5 × 11 in)' },
    { name: 'Legal', width: 8.5, height: 14, unit: 'inch', description: 'Legal (8.5 × 14 in)' },
    { name: 'A3', width: 11.69, height: 16.54, unit: 'inch', description: 'A3 (11.69 × 16.54 in)' },
    { name: 'A5', width: 5.83, height: 8.27, unit: 'inch', description: 'A5 (5.83 × 8.27 in)' }
  ];
  
  // Paper size input properties
  paperWidth = 6; // Default Pallet Label width in inches
  paperHeight = 6; // Default Pallet Label height in inches
  paperUnit = 'inch'; // Default unit
  selectedDefaultSize = 'Pallet Label (6 x 6 in)'; // Default to Pallet Label size
  labelSizes = LABEL_SIZES; // Predefined label sizes
  isSaving = false;
  isDeleting = false;
  isGeneratingPDF = false;
  isSendingForReview = false;
  isTemplateSubmitted = false;
  showTemplateNameDialog = false;
  templateName = '';
  templateDescription = '';
  isCheckingDuplicate = false;
  isDuplicateName = false;
  duplicateCheckTimeout: any = null;
  showDeleteDialog = false;
  showSaveExistingDialog = false;
  showSendForReviewDialog = false;
  selectedReviewerId: string = '';
  availableReviewers: any[] = [];
  isDeleteRequestMode = false; // Track if we're in delete request mode
  
  // Dropdown states
  showReviewerDropdown = false;
  
  // Reviewer workflow state
  showRejectDialog = false;
  rejectComments = '';
  isRejecting = false;

  comments: any[] = []; // Array to store comments

  banners: BannerMsg[] = [];
  private _bannerSeq = 0;

  constructor(
    private labelTemplateService: LabelTemplateService,
    public templateManagementService: TemplateManagementService,
    private designStateService: DesignStateService,
    private pdfService: PdfGenerationService,
    private apiConfigService: ApiConfigService,
    private elementRef: ElementRef,
    private http: HttpClient,
    private dashboardService: DashboardService,
    private router: Router,
    private commentService: CommentService,
    private thumbnailService: TemplateThumbnailService,
    private themeService: ThemeService,
    private collaborationService: CollaborationService
  ) {}

  ngOnInit() {
    this.initializeTheme();
    this.calculatePaperLayout();
  }

  private initializeTheme(): void {
    // Initialize theme from centralized service
    this.isDarkMode = this.themeService.initializeComponentTheme();
    
    // Subscribe to theme changes
    this.themeService.onThemeChange().subscribe(isDarkMode => {
      this.isDarkMode = isDarkMode;
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    // Detect when selectedTemplate is passed via @Input()
    if (changes['selectedTemplate'] && changes['selectedTemplate'].currentValue) {
      const template = changes['selectedTemplate'].currentValue;
      
      // Set currentTemplateId for PDF generation
      if (template.templateId) {
        this.currentTemplateId = template.templateId;
        console.log('HeaderComponent: currentTemplateId set to:', this.currentTemplateId);
      }
      
      // If this is a new template (not just a change), also load template content
      if (changes['selectedTemplate'].previousValue === null || 
          changes['selectedTemplate'].previousValue?.templateId !== template.templateId) {
        this.onSelectTemplate(template);
      }
    }
  }

  ngOnDestroy() {
    if (this.duplicateCheckTimeout) {
      clearTimeout(this.duplicateCheckTimeout);
    }
  }

  onToggleTheme() {
    // Use centralized theme service
    this.themeService.toggleTheme();
    this.themeChange.emit(this.themeService.isDarkMode);
  }

  onUndo() {
    this.undo.emit();
  }

  onRedo() {
    this.redo.emit();
  }

  onBringToFront() {
    this.bringToFront.emit();
  }

  onDeleteSelected() {
    this.deleteSelected.emit();
  }

  onUngroupAll() {
    this.ungroupAll.emit();
  }

  get hasGroups(): boolean {
    return this.elementGroups && this.elementGroups.size > 0;
  }

  // Method to set theme state from parent component
  setThemeState(isDarkMode: boolean) {
    this.isDarkMode = isDarkMode;
  }



  onSelectTemplate(template: any) {
    this.selectedTemplate = template;
    this.currentTemplateId = template.templateId;
    
    // Clear placeholder values when loading a new template
    this.placeholderValues = {};
    this.showPlaceholderDialog = false;
    
    // Load the template content using the template management service
    this.templateManagementService.selectTemplate(template).subscribe({
      next: (loadResult) => {
        
        // Restore paper size information if available
        if (loadResult.paperWidth !== undefined) {
          this.paperWidth = loadResult.paperWidth;
        }
        if (loadResult.paperHeight !== undefined) {
          this.paperHeight = loadResult.paperHeight;
        }
        if (loadResult.paperUnit !== undefined) {
          this.paperUnit = loadResult.paperUnit;
        }
        
        // Determine the correct dropdown selection based on loaded dimensions
        this.determinePaperSizeSelection(loadResult);
        
        // Update the paper size selection based on the determined selection
        this.selectedPaperSize = this.selectedDefaultSize;
        
        // Emit paper size change to update the dropdown display
        this.selectedPaperSizeChange.emit(this.selectedPaperSize);
        
        // Check if we have valid paper layout dimensions from the template
        if (loadResult.paperLayoutLeft !== undefined && 
            loadResult.paperLayoutTop !== undefined &&
            loadResult.paperLayoutWidth !== undefined && 
            loadResult.paperLayoutHeight !== undefined &&
            loadResult.paperLayoutWidth > 0 && 
            loadResult.paperLayoutHeight > 0) {
          
          // Use the saved paper layout dimensions
          this.paperLayoutChange.emit({
            left: loadResult.paperLayoutLeft,
            top: loadResult.paperLayoutTop,
            width: loadResult.paperLayoutWidth,
            height: loadResult.paperLayoutHeight
          });
          
        } else {
          // Recalculate paper layout based on loaded paper size
          this.calculatePaperLayout();
        }
        
        // Emit canvas elements to parent component AFTER paper layout is set
        setTimeout(() => {
          this.canvasElementsChange.emit(loadResult.canvasElements);
          
          // Emit the loaded template data to parent component
          this.selectedTemplateChange.emit(template);
          
          // Emit paper size change
          this.selectedPaperSizeChange.emit(loadResult.selectedPaperSize);
          
          // Clear selected element since we're loading a new template
          this.selectedElementChange.emit(null);
          
        }, 100); // Small delay to ensure paper layout is processed first
      },
      error: (error) => {
        this.showBanner('Error loading template. Please try again.', 'error', 3500);
      }
    });
  }

  onDeleteTemplate(template: any, event: Event) {
    event.stopPropagation();
    this.selectedTemplate = template;
    this.showDeleteDialog = true;
    this.showDeleteDialogChange.emit(true);
  }

  onDeleteSelectedTemplate() {
    if (!this.selectedTemplate) {
      return;
    }
    
    // For published templates, show send for review dialog instead of delete dialog
    if (this.isTemplatePublished()) {
      this.isDeleteRequestMode = true; // Set delete request mode
      this.selectedReviewerId = '';
      this.loadAvailableReviewers();
      this.showSendForReviewDialog = true;
    } else {
      // For draft templates, show regular delete dialog
      this.isDeleteRequestMode = false; // Reset delete request mode
      this.showDeleteDialog = true;
      this.showDeleteDialogChange.emit(true);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;

    // Close paper size dropdown if clicking outside
    const paperSizeDropdown = this.elementRef.nativeElement.querySelector(
      '.paper-size-dropdown'
    );
    if (
      this.showPaperSizeDropdown &&
      paperSizeDropdown &&
      !paperSizeDropdown.contains(target)
    ) {
      this.closePaperSizeDropdown();
    }

  }


  // Template saving functionality
  onSaveTemplate() {
    if (this.isSaving) return;

    if (this.canvasElements.length === 0) {
      this.showBanner('Please add some elements to the canvas before saving.', 'warning', 3500);
      return;
    }

    // Check if a template is already selected/saved
    if (this.selectedTemplate) {
      this.showSaveExistingDialog = true;
      return;
    }

    // Show template name dialog for new template
    this.templateName = `Label Template - ${new Date().toLocaleString()}`;
    this.templateDescription = 'Label template created with tagIT designer';
    this.showTemplateNameDialog = true;
  }

  confirmSaveTemplate() {
    if (!this.templateName.trim()) {
      this.showBanner('Please enter a template name.', 'warning');
      return;
    }

    // Check for duplicate name before saving
    if (this.isDuplicateName) {
      this.showBanner('A template with this name already exists. Please choose a different name.', 'error');
      return;
    }

    // If we're still checking for duplicates, wait for it to complete
    if (this.isCheckingDuplicate) {
      this.showBanner('Please wait while we check for duplicate names...', 'info');
      return;
    }

    this.isSaving = true;
    this.showTemplateNameDialog = false;

    // Reset API detection to ensure we get the latest backend URL
    this.apiConfigService.resetDetection();

    // First, save the template data to LabelTemplate (for design storage)
    const templateData = {
      name: this.templateName.trim(),
      description: this.templateDescription.trim(),
      paperSize: this.selectedPaperSize,
      paperWidth: this.paperWidth,
      paperHeight: this.paperHeight,
      paperUnit: this.paperUnit,
      selectedDefaultSize: this.selectedDefaultSize,
      canvasElements: this.canvasElements,
      paperLayoutLeft: this.canvasComponent?.paperLayout?.left || this.paperLayoutLeft,
      paperLayoutTop: this.canvasComponent?.paperLayout?.top || this.paperLayoutTop,
      paperLayoutWidth: this.paperLayoutWidth,
      paperLayoutHeight: this.paperLayoutHeight
    };

    // Save template first, then create design state (if not clone mode)
    return this.labelTemplateService.saveTemplate(templateData).subscribe({
      next: (response) => {
        if (!response.templateId) {
          this.showBanner('Template saved but no template ID returned. Please try again.', 'error');
          this.isSaving = false;
          return;
        }

        // Check if this is clone mode (public library save)
        if (this.viewingMode.saveMode === 'clone') {
          // Clone mode: Save template but don't create design state
          this.showBanner(`Template cloned successfully! New Template ID: ${response.templateId}`, 'success', 4500);
          this.isSaving = false;
          
          // Set the newly saved template as the selected template
          this.selectedTemplate = {
            templateId: response.templateId,
            name: this.templateName.trim(),
            description: this.templateDescription.trim(),
            paperWidth: this.paperWidth,
            paperHeight: this.paperHeight,
            unit: this.paperUnit,
            jsonSchema: this.getTemplateData()
          };
          
          // Update currentTemplateId for CSV import
          this.currentTemplateId = response.templateId || null;
              
          // Reset template submission status for new template
          this.isTemplateSubmitted = false;
          
          // Emit the selected template change
          this.selectedTemplateChange.emit(this.selectedTemplate);
          
          // Refresh templates list to include the newly saved template
          this.templateManagementService.refreshTemplates().subscribe({
            next: () => {},
            error: (error) => console.error('Error refreshing templates:', error)
          });
        } else {
          // Normal mode: Create design state entry for this template
          const designStateRequest: CreateDesignStateRequest = {
            templateId: response.templateId,
            designerId: this.dashboardService.getCurrentUserId(),
            state: 'Draft',
            versionNumber: 1,
            comments: 'Initial draft save',
            stateChangedBy: this.dashboardService.getCurrentUserId()
          };

          this.designStateService.createDesignState(designStateRequest).subscribe({
            next: (designStateResponse) => {
              this.showBanner(`Design saved successfully! Template ID: ${response.templateId}, Design State ID: ${designStateResponse.designStateId}`, 'success', 4500);
              this.isSaving = false;
              
              // Set the newly saved template as the selected template
              this.selectedTemplate = {
                templateId: response.templateId,
                name: this.templateName.trim(),
                description: this.templateDescription.trim(),
                paperWidth: this.paperWidth,
                paperHeight: this.paperHeight,
                unit: this.paperUnit,
                jsonSchema: this.getTemplateData()
              };
              
              // Update currentTemplateId for CSV import
              this.currentTemplateId = response.templateId || null;
                  
              // Reset template submission status for new template
              this.isTemplateSubmitted = false;
              
              // Emit the selected template change
              this.selectedTemplateChange.emit(this.selectedTemplate);
              
              // Invalidate thumbnail cache for the saved template
              if (response.templateId) {
                this.thumbnailService.invalidateTemplateCache(response.templateId);
              }
              
              // Refresh templates list to include the newly saved template
              this.templateManagementService.refreshTemplates().subscribe({
                next: () => {},
                error: (error) => console.error('Error refreshing templates:', error)
              });
            },
            error: (error) => {
              this.showBanner('Template saved but failed to create design state. Please try again.', 'error');
              this.isSaving = false;
            }
          });
        }
      },
      error: (error: any) => {
        const currentUrl = this.apiConfigService.getCurrentApiUrl();
        this.showBanner(`Error saving template: ${error.message} · Tried URL: ${currentUrl}`, 'error', 5500);
        this.isSaving = false;
      }
    });
  }

  cancelSaveTemplate() {
    this.showTemplateNameDialog = false;
    this.templateName = '';
    this.templateDescription = '';
    this.isDuplicateName = false;
    this.isCheckingDuplicate = false;
    if (this.duplicateCheckTimeout) {
      clearTimeout(this.duplicateCheckTimeout);
    }
  }

  // Save existing template dialog methods
  onSaveNewTemplate() {
    this.showSaveExistingDialog = false;
    // Clear selected template to allow saving as new
    this.selectedTemplate = null;
    this.currentTemplateId = null; // Clear current template ID
    this.selectedTemplateChange.emit(null);
    // Show template name dialog for new template
    this.templateName = `Label Template - ${new Date().toLocaleString()}`;
    this.templateDescription = 'Label template created with tagIT designer';
    this.showTemplateNameDialog = true;
  }

  onUpdateExistingTemplate() {
    if (!this.selectedTemplate) {
      this.showBanner('No template selected to update.', 'error');
      return;
    }

    this.showSaveExistingDialog = false;
    this.isSaving = true;

    // Create template data for update (same format as saveTemplate)
    const templateData = {
      name: this.selectedTemplate.name,
      description: this.selectedTemplate.description,
      paperSize: this.selectedPaperSize,
      paperWidth: this.paperWidth,
      paperHeight: this.paperHeight,
      paperUnit: this.paperUnit,
      selectedDefaultSize: this.selectedDefaultSize,
      canvasElements: this.canvasElements,
      paperLayoutLeft: this.canvasComponent?.paperLayout?.left || this.paperLayoutLeft,
      paperLayoutTop: this.canvasComponent?.paperLayout?.top || this.paperLayoutTop,
      paperLayoutWidth: this.paperLayoutWidth,
      paperLayoutHeight: this.paperLayoutHeight
    };

    // Create proper LabelTemplate object for update API
    const labelTemplate = this.createLabelTemplateObject(templateData);

    // Update the existing template
    this.labelTemplateService.updateTemplate(this.selectedTemplate.templateId, labelTemplate).subscribe({
      next: (response) => {
        this.showBanner(`Template updated successfully!`, 'success', 3500);
        this.isSaving = false;
        
        // Update the selected template with new data
        this.selectedTemplate = {
          ...this.selectedTemplate,
          name: templateData.name,
          description: templateData.description,
          paperWidth: templateData.paperWidth,
          paperHeight: templateData.paperHeight,
          unit: templateData.paperUnit,
          jsonSchema: this.getTemplateData()
        };
        
        // Emit the updated template
        this.selectedTemplateChange.emit(this.selectedTemplate);
        
        // Invalidate thumbnail cache for the updated template
        if (this.selectedTemplate.templateId) {
          this.thumbnailService.invalidateTemplateCache(this.selectedTemplate.templateId);
        }
        
        // Refresh templates list
        this.templateManagementService.refreshTemplates().subscribe({
          next: () => {},
          error: (error) => console.error('Error refreshing templates:', error)
        });
        
        // Ensure currentTemplateId is set correctly for CSV import
        this.currentTemplateId = this.selectedTemplate.templateId;
      },
      error: (error: any) => {
        this.showBanner(`Error updating template: ${error.message}`, 'error', 5000);
        this.isSaving = false;
      }
    });
  }

  cancelSaveExistingDialog() {
    this.showSaveExistingDialog = false;
  }

  // Send for Review functionality
  onSendForReview() {
    if (!this.selectedTemplate) {
      this.showBanner('No template selected to send for review.', 'error');
      return;
    }

    if (this.isSendingForReview) return;

    // [CHANGE] Check if there are unresolved comments
    if (this.hasUnresolvedComments()) {
      this.showBanner('Cannot send for review. Please resolve all comments first.', 'error');
      return;
    }

    // Load available reviewers
    this.loadAvailableReviewers();
    this.isDeleteRequestMode = false; // Reset delete request mode for regular send for review
    this.showSendForReviewDialog = true;
  }

  // [CHANGE] Check if there are unresolved comments
  private hasUnresolvedComments(): boolean {
    return this.unresolvedCommentCount > 0;
  }

  loadAvailableReviewers() {
    const apiUrl = this.apiConfigService.getCurrentApiUrl();
    if (!apiUrl) {
      console.error('API URL not configured');
      this.showBanner('API URL not configured', 'error');
      // Use fallback data for testing (excluding current user)
      this.availableReviewers = [
        { userId: 1, name: 'John Reviewer', email: 'john@example.com' },
        { userId: 2, name: 'Jane Reviewer', email: 'jane@example.com' },
        { userId: 3, name: 'Bob Reviewer', email: 'bob@example.com' }
      ].filter(reviewer => reviewer.userId !== this.dashboardService.getCurrentUserId());
      return;
    }

    // Construct the reviewers URL
    const reviewersUrl = `${apiUrl}/dashboard/reviewers`;
    this.http.get<any[]>(reviewersUrl).subscribe({
      next: (reviewers) => {
        // Map backend ReviewerDto to frontend format and filter out current user
        this.availableReviewers = reviewers
          .map(reviewer => ({
            userId: reviewer.userId,
            name: reviewer.username,
            email: `${reviewer.username}@company.com` // Fallback email format
          }))
          .filter(reviewer => reviewer.userId !== this.dashboardService.getCurrentUserId());
      },
      error: (error) => {
        console.error('Error loading reviewers:', error);
        this.showBanner('Error loading reviewers list. Using fallback data.', 'warning');
        // Fallback to mock data (excluding current user)
        this.availableReviewers = [
          { userId: 1, name: 'John Reviewer', email: 'john@example.com' },
          { userId: 2, name: 'Jane Reviewer', email: 'jane@example.com' },
          { userId: 3, name: 'Bob Reviewer', email: 'bob@example.com' }
        ].filter(reviewer => reviewer.userId !== this.dashboardService.getCurrentUserId());
      }
    });
  }

  // Helper method to get design state ID for a template
  private getDesignStateIdForTemplate(templateId: number): Promise<number | null> {
    const apiUrl = this.apiConfigService.getCurrentApiUrl();
    if (!apiUrl) {
      return Promise.reject('API URL not configured');
    }

    const currentStateUrl = `${apiUrl}/designstate/templates/${templateId}/current`;

    return this.http.get<any>(currentStateUrl).toPromise()
      .then((response: any) => {
        if (response && response.designStateId) {
          return response.designStateId;
        }
        return null;
      })
      .catch((error) => {
        console.error('Error getting design state ID:', error);
        throw error;
      });
  }

  confirmSendForReview() {
    if (!this.selectedTemplate) {
      this.showBanner('No template selected to send for review.', 'error');
      return;
    }

    if (this.isSendingForReview) return;

    // Check if user is trying to assign their own template to themselves
    if (this.selectedReviewerId && parseInt(this.selectedReviewerId) === this.dashboardService.getCurrentUserId() && 
        Number(this.selectedTemplate.designerId) === Number(this.dashboardService.getCurrentUserId())) {
      this.showBanner('You cannot assign your own template to yourself. Please select a different reviewer or choose "Any Available Reviewer".', 'error', 5000);
      return;
    }

    this.isSendingForReview = true;

    const reviewData = {
      StateChangedBy: this.dashboardService.getCurrentUserId(),
      ReviewerId: this.selectedReviewerId ? parseInt(this.selectedReviewerId) : null,
      Comments: null,
      StateChangedAt: new Date().toISOString(),
      IsDeleteRequest: this.isDeleteRequestMode // Add flag to indicate if this is a delete request
    };

    const apiUrl = this.apiConfigService.getCurrentApiUrl();
    if (!apiUrl) {
      this.isSendingForReview = false;
      console.error('API URL not configured');
      this.showBanner('API URL not configured', 'error');
      return;
    }

    // First get the design state ID for this template
    this.getDesignStateIdForTemplate(this.selectedTemplate.templateId).then(designStateId => {
      if (!designStateId) {
        this.isSendingForReview = false;
        this.showBanner('Could not find design state for template', 'error');
        return;
      }

      const submitUrl = `${apiUrl}/designstate/${designStateId}/submit-review`;

      this.http.post(submitUrl, reviewData).subscribe({
        next: (response: any) => {
          this.isSendingForReview = false;
          this.showSendForReviewDialog = false;
          this.isTemplateSubmitted = true;
          
          // Capture the reviewer ID before resetting it
          const wasAssignedToSpecificReviewer = this.selectedReviewerId && this.selectedReviewerId !== '';
          this.selectedReviewerId = '';
          
          let message: string;
          if (this.isDeleteRequestMode) {
            message = wasAssignedToSpecificReviewer 
              ? 'Delete request sent for review to assigned reviewer!' 
              : 'Delete request sent for review to all reviewers!';
          } else {
            message = wasAssignedToSpecificReviewer 
              ? 'Template sent for review to assigned reviewer!' 
              : 'Template sent for review to all reviewers!';
          }
          
          this.showBanner(message, 'success', 4000);
        },
        error: (error) => {
          this.isSendingForReview = false;
          console.error('Error submitting template for review:', error);
          
          let errorMessage = 'Error submitting template for review';
          if (error.error && error.error.message) {
            errorMessage = error.error.message;
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          this.showBanner(errorMessage, 'error');
        }
      });
    }).catch(error => {
      console.error('Error getting design state ID:', error);
      this.isSendingForReview = false;
      this.showBanner('Error getting template state', 'error');
    });
  }

  cancelSendForReview() {
    this.showSendForReviewDialog = false;
    this.selectedReviewerId = '';
    this.isDeleteRequestMode = false; // Reset delete request mode
  }

  // Helper methods for reviewer workflow
  isReviewer(): boolean {
    const hasReviewerRole = this.dashboardService.hasRole('Reviewer');
    return hasReviewerRole;
  }

  isDesigner(): boolean {
    const hasDesignerRole = this.dashboardService.hasRole('Designer');
    return hasDesignerRole;
  }

  isTemplateAssignedToReviewer(): boolean {
    const isAssigned = this.selectedTemplate && this.selectedTemplate.designState === 'Assigned';
    return isAssigned;
  }

  isTemplateApproved(): boolean {
    const isApproved = this.selectedTemplate && this.selectedTemplate.designState === 'Approved';
    return isApproved;
  }

  isTemplatePublished(): boolean {
    const isPublished = this.selectedTemplate && this.selectedTemplate.designState === 'Published';
    return isPublished;
  }

  // [CHANGE] Check if template has any comments - now uses backend service
  hasComments(): boolean {
    // This will be updated to use backend service in the next step
    // For now, return false to avoid blocking approval
    return false;
  }

  // [CHANGE] Check for unresolved comments using backend service
  checkUnresolvedComments(): Promise<boolean> {
    if (!this.currentDesignStateId) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      this.commentService.hasUnresolvedComments(this.currentDesignStateId!)
        .subscribe({
          next: (hasUnresolved) => {
            resolve(hasUnresolved);
          },
          error: (error) => {
            console.error('[HEADER] Error checking unresolved comments:', error);
            resolve(false); // Default to false on error
          }
        });
    });
  }


  // [CHANGE] Check if accept button should be shown and enabled
  shouldShowAcceptButton(): boolean {
    return this.shouldShowReviewerButtons() && 
           (this.isTemplateAssignedToReviewer() || this.isTemplateApproved()) &&
           !this.isTemplatePublished() && // Hide if template is published
           !this.hasComments(); // Disable if comments exist
  }

  shouldShowReviewerButtons(): boolean {
    const isReviewer = this.isReviewer();
    const isTemplateInReviewState = this.isTemplateAssignedToReviewer() || this.isTemplateApproved();
    const isTemplateAssignedToCurrentReviewer = this.isTemplateAssignedToCurrentReviewer();
    
    return isReviewer && isTemplateInReviewState && isTemplateAssignedToCurrentReviewer;
  }

  isTemplateAssignedToCurrentReviewer(): boolean {
    if (!this.selectedTemplate) {
      return false;
    }
    
    const currentUserId = this.dashboardService.getCurrentUserId();
    const templateReviewerId = this.selectedTemplate.reviewerId;
    const templateDesignState = this.selectedTemplate.designState;
    
    // Template is assigned to current reviewer if state is 'Assigned' or 'Approved' and reviewerId matches current user ID
    return (templateDesignState === 'Assigned' || templateDesignState === 'Approved') && templateReviewerId === currentUserId;
  }

  shouldShowDesignerButtons(): boolean {
    return this.isDesigner();
  }

  shouldShowSaveButton(): boolean {
    // Show save button for designers, or when no template is selected (new template)
    return this.isDesigner() || !this.selectedTemplate;
  }

  shouldShowSendForReviewButton(): boolean {
    // Show send for review button for designers when template exists and not submitted
    return this.isDesigner() && this.selectedTemplate && !this.isTemplateSubmitted;
  }

  // Reviewer workflow methods
  async onAcceptTemplate() {
    if (!this.selectedTemplate) return;
    
    // [CHANGE] Check for unresolved comments first
    const hasUnresolved = await this.checkUnresolvedComments();
    if (hasUnresolved) {
      this.showBanner('Cannot approve template with unresolved comments. Please resolve all comments before approval.', 'error');
      return;
    }
    
    // Call backend to accept the template
    const apiUrl = this.apiConfigService.getCurrentApiUrl();
    if (!apiUrl) {
      this.showBanner('API URL not configured', 'error');
      return;
    }

    const acceptData = {
      stateChangedBy: this.dashboardService.getCurrentUserId(),
      comments: 'Template accepted for review',
      stateChangedAt: new Date().toISOString()
    };

    // First get the design state ID for this template
    this.getDesignStateIdForTemplate(this.selectedTemplate.templateId).then(designStateId => {
      if (!designStateId) {
        this.showBanner('Could not find design state for template', 'error');
        return;
      }

      const acceptUrl = `${apiUrl}/designstate/${designStateId}/approve`;

      this.http.post(acceptUrl, acceptData).subscribe({
        next: (response) => {
          // Update the selected template's design state
          if (this.selectedTemplate) {
            this.selectedTemplate.designState = 'Approved';
          }
          this.showBanner('Template accepted! You can now publish it.', 'success', 4000);
        },
        error: (error) => {
          console.error('Error accepting template:', error);
          // [CHANGE] Show specific error message from backend
          const errorMessage = error.error?.message || error.message || 'Error accepting template';
          this.showBanner(errorMessage, 'error');
        }
      });
    }).catch(error => {
      console.error('Error getting design state ID:', error);
      this.showBanner('Error getting template state', 'error');
    });
  }

  onRejectTemplate() {
    this.showRejectDialog = true;
  }

  confirmRejectTemplate() {
    if (!this.selectedTemplate || !this.rejectComments.trim()) {
      this.showBanner('Please provide rejection comments', 'warning');
      return;
    }

    this.isRejecting = true;
    
    const apiUrl = this.apiConfigService.getCurrentApiUrl();
    if (!apiUrl) {
      this.showBanner('API URL not configured', 'error');
      this.isRejecting = false;
      return;
    }

    const rejectData = {
      stateChangedBy: this.dashboardService.getCurrentUserId(),
      comments: this.rejectComments.trim(),
      stateChangedAt: new Date().toISOString()
    };

    // First get the design state ID for this template
    this.getDesignStateIdForTemplate(this.selectedTemplate.templateId).then(designStateId => {
      if (!designStateId) {
        this.isRejecting = false;
        this.showBanner('Could not find design state for template', 'error');
        return;
      }

      // Reject the template (comments are already saved individually when added)
      const rejectUrl = `${apiUrl}/designstate/${designStateId}/reject`;
      this.http.post(rejectUrl, rejectData).subscribe({
        next: (response) => {
          this.showBanner('Template rejected and returned to designer', 'success', 4000);
          this.cancelRejectTemplate();
          // Navigate back to dashboard to see the updated state
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          console.error('Error rejecting template:', error);
          this.showBanner('Error rejecting template', 'error');
          this.isRejecting = false;
        }
      });
    }).catch(error => {
      console.error('Error getting design state ID:', error);
      this.isRejecting = false;
      this.showBanner('Error getting template state', 'error');
    });
  }

  cancelRejectTemplate() {
    this.showRejectDialog = false;
    this.rejectComments = '';
    this.isRejecting = false;
  }

  // [CHANGE] Toggle comment mode
  toggleCommentMode() {
    this.isCommentMode = !this.isCommentMode;
    
    // Emit the comment mode change to parent components
    this.commentModeChange.emit(this.isCommentMode);
  }

  // Check if collaboration button should be shown
  shouldShowCollaborationButton(): boolean {
    // Only show collaboration button for templates from public library
    return this.librarySource === 'public';
  }

  // Toggle collaboration mode
  toggleCollaborationMode() {
    const newCollaborationMode = !this.isCollaborationMode;
    
    // Emit the collaboration mode change to parent components
    this.collaborationModeChange.emit(newCollaborationMode);
    
    if (newCollaborationMode) {
      this.showBanner('Collaboration mode enabled', 'info');
    } else {
      this.showBanner('Collaboration mode disabled', 'info');
    }
  }

  onPublishTemplate() {
    if (!this.selectedTemplate) return;
    
    // Call backend to publish the template
    const apiUrl = this.apiConfigService.getCurrentApiUrl();
    if (!apiUrl) {
      this.showBanner('API URL not configured', 'error');
      return;
    }

    const publishData = {
      stateChangedBy: this.dashboardService.getCurrentUserId(),
      comments: 'Template published',
      stateChangedAt: new Date().toISOString()
    };

    // First get the design state ID for this template
    this.getDesignStateIdForTemplate(this.selectedTemplate.templateId).then(designStateId => {
      if (!designStateId) {
        this.showBanner('Could not find design state for template', 'error');
        return;
      }

      const publishUrl = `${apiUrl}/designstate/${designStateId}/publish`;

      this.http.post(publishUrl, publishData).subscribe({
        next: (response) => {
          this.showBanner('Template published successfully!', 'success', 4000);
          // Template published successfully
        },
        error: (error) => {
          console.error('Error publishing template:', error);
          this.showBanner('Error publishing template', 'error');
        }
      });
    }).catch(error => {
      console.error('Error getting design state ID:', error);
      this.showBanner('Error getting template state', 'error');
    });
  }

  // Helper method to create LabelTemplate object for update API
  private createLabelTemplateObject(templateData: any): any {
    // Use the paper dimensions from the component
    const paperWidth = templateData.paperWidth;
    const paperHeight = templateData.paperHeight;
    const paperUnit = templateData.paperUnit;
    
    const labelTemplate = {
      name: templateData.name || `Label Template - ${new Date().toLocaleString()}`,
      description: templateData.description || 'Label template created with tagIT designer',
      paperWidth: paperWidth,
      paperHeight: paperHeight,
      unit: paperUnit,
      jsonSchema: this.pdfService.createJsonSchema(
        templateData.canvasElements,
        paperWidth,
        paperHeight,
        paperUnit,
        this.canvasComponent?.paperLayout?.left || this.paperLayoutLeft, // Get from canvas if available
        this.canvasComponent?.paperLayout?.top || this.paperLayoutTop,   // Get from canvas if available
        this.canvasComponent?.paperLayout?.width || this.paperLayoutWidth, // Get from canvas if available
        this.canvasComponent?.paperLayout?.height || this.paperLayoutHeight // Get from canvas if available
      )
    };

    return labelTemplate;
  }

  // Check for duplicate template name with debouncing
  onTemplateNameChange() {
    if (this.duplicateCheckTimeout) {
      clearTimeout(this.duplicateCheckTimeout);
    }

    // Clear previous duplicate status
    this.isDuplicateName = false;
    this.isCheckingDuplicate = false;

    if (!this.templateName.trim()) {
      return;
    }

    // Debounce the duplicate check by 500ms
    this.duplicateCheckTimeout = setTimeout(() => {
      this.checkDuplicateName();
    }, 500);
  }

  // Check if template name already exists
  private checkDuplicateName() {
    if (!this.templateName.trim()) {
      this.isDuplicateName = false;
      this.isCheckingDuplicate = false;
      return;
    }

    this.isCheckingDuplicate = true;
    
    this.labelTemplateService.checkDuplicateName(this.templateName.trim()).subscribe({
      next: (isDuplicate: boolean) => {
        this.isDuplicateName = isDuplicate;
        this.isCheckingDuplicate = false;
      },
      error: (error: any) => {
        this.isDuplicateName = false;
        this.isCheckingDuplicate = false;
      }
    });
  }

  // Clear canvas functionality
  onClearCanvas() {
    if (this.canvasElements.length === 0) {
      return;
    }

    // Emit clear all event to parent component
    this.clearAll.emit();
    
    // Clear all elements from canvas
    this.canvasElementsChange.emit([]);
    this.selectedElementChange.emit(null);
    
    // Reset paper size to default
    this.resetPaperSizeToDefault();
    
    // Clear placeholder values
    this.placeholderValues = {};
    this.showPlaceholderDialog = false;
  }

  // Reset paper size to default values
  private resetPaperSizeToDefault() {
    // Reset to default Pallet Label size
    this.selectedPaperSize = 'Pallet Label (6 x 6 in)';
    this.selectedDefaultSize = 'Pallet Label (6 x 6 in)';
    this.paperWidth = 6;
    this.paperHeight = 6;
    this.paperUnit = 'inch';
    
    // Emit paper size change
    this.selectedPaperSizeChange.emit('Pallet Label (6 x 6 in)');
    
    // Calculate centered position (original position when page loads)
    const canvasWidth = 1200; // Default canvas width
    const canvasHeight = 800; // Default canvas height
    const paperWidth = 576; // 6 inches × 96 DPI
    const paperHeight = 576; // 6 inches × 96 DPI
    
    const centeredLeft = Math.max(0, (canvasWidth - paperWidth) / 2);
    const centeredTop = Math.max(0, (canvasHeight - paperHeight) / 2);
    
    // Reset paper layout to original centered position and size
    const defaultLayout = {
      left: centeredLeft,
      top: centeredTop,
      width: paperWidth,
      height: paperHeight
    };
    this.paperLayoutChange.emit(defaultLayout);
  }

  // Add new template functionality
  onAddNewTemplate() {
    // Clear the canvas
    this.canvasElementsChange.emit([]);
    this.selectedElementChange.emit(null);
    
    // Clear template selection
    this.selectedTemplate = null;
    this.currentTemplateId = null;
    this.selectedTemplateChange.emit(null);
    
    // Reset paper size to default
    this.resetPaperSizeToDefault();
    
    // Clear placeholder values
    this.placeholderValues = {};
    this.showPlaceholderDialog = false;
    
    
    // Reset zoom, grouping, and smart layout
    this.resetZoom.emit();
    this.clearGrouping.emit();
    this.resetSmartLayout.emit();
    
    // Clear all reference lines
    this.clearReferenceLines.emit();
    
  }

  // Generate PDF functionality
  onGeneratePDF() {
    if (this.isGeneratingPDF) {
      return;
    }

    if (this.canvasElements.length === 0) {
      this.showBanner('Please add some elements to the canvas before generating PDF.', 'warning', 3500);
      return;
    }

    // Check if we have a current template ID first (before checking placeholders)
    if (!this.currentTemplateId) {
      this.showBanner('Please save the template before generating the PDF.', 'warning');
      return;
    }

    // Check for any placeholders (always ask for values on each PDF generation)
    const elementsWithPlaceholders = this.getElementsWithPlaceholders();
    
    if (elementsWithPlaceholders.length > 0) {
      // Clear previous placeholder values to ensure fresh input
      this.placeholderValues = {};
      this.showPlaceholderDialog = true;
      return;
    }

    this.generatePDFDirectly();
  }

  private generatePDFDirectly() {
    try {
      this.isGeneratingPDF = true;
      
      // Set a timeout to prevent PDF generation from getting stuck
      this.pdfGenerationTimeout = setTimeout(() => {
        if (this.isGeneratingPDF) {
          this.isGeneratingPDF = false;
          this.showBanner('PDF generation timed out. Please try again.', 'error');
        }
      }, 30000); // 30 second timeout

      // Get resolved placeholder values (same logic as before)
      const resolvedData: { [key: string]: any } = {};
      
      this.canvasElements.forEach(element => {
        if ((element.type === 'text' || element.type === 'textarea' || element.type === 'barcode' || element.type === 'qr') && element.content) {
          let resolvedContent = element.content;
          
          // Replace all {{placeholder}} with actual values
          const placeholderMatches = element.content.match(/\{\{([^}]+)\}\}/g);
          if (placeholderMatches) {
            placeholderMatches.forEach((match: string) => {
              const placeholderName = match.replace(/\{\{|\}\}/g, '');
              if (this.placeholderValues[placeholderName]) {
                resolvedContent = resolvedContent.replace(match, this.placeholderValues[placeholderName]);
              }
            });
          }
          
          // Extract placeholder names for the resolved content
          const originalPlaceholderMatches = element.content.match(/\{\{([^}]+)\}\}/g);
          if (originalPlaceholderMatches) {
            originalPlaceholderMatches.forEach((match: string) => {
              const placeholderName = match.replace(/\{\{|\}\}/g, '');
              resolvedData[placeholderName] = resolvedContent;
            });
          }
        }
      });

      // Generate PDF using the same approach as CSV import
      this.pdfService.generatePdf(this.currentTemplateId!, { data: resolvedData }).subscribe({
        next: (pdfBlob) => {
          this.isGeneratingPDF = false;
          if (this.pdfGenerationTimeout) {
            clearTimeout(this.pdfGenerationTimeout);
            this.pdfGenerationTimeout = null;
          }
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          this.pdfService.downloadPdf(pdfBlob, `label-template-${timestamp}.pdf`);
          this.showBanner('PDF generated successfully!', 'success');
        },
        error: (error: any) => {
          this.isGeneratingPDF = false;
          if (this.pdfGenerationTimeout) {
            clearTimeout(this.pdfGenerationTimeout);
            this.pdfGenerationTimeout = null;
          }
          this.showBanner(`Error generating PDF: ${error.message}`, 'error');
        }
      });
    } catch (error) {
      this.isGeneratingPDF = false;
      if (this.pdfGenerationTimeout) {
        clearTimeout(this.pdfGenerationTimeout);
        this.pdfGenerationTimeout = null;
      }
      this.showBanner('An error occurred while generating PDF. Please try again.', 'error');
    }
  }

  private generatePDFWithResolvedPlaceholders() {
    try {
      this.isGeneratingPDF = true;
      
      // Set a timeout to prevent PDF generation from getting stuck
      this.pdfGenerationTimeout = setTimeout(() => {
        if (this.isGeneratingPDF) {
          this.isGeneratingPDF = false;
          this.showBanner('PDF generation timed out. Please try again.', 'error');
        }
      }, 30000); // 30 second timeout

      // Get PDF generation data with resolved placeholders
      const pdfData = this.getTemplateDataWithResolvedPlaceholders();
        
    // Validate that we have the required data
    if (!pdfData['canvasElements'] || pdfData['canvasElements'].length === 0) {
      this.isGeneratingPDF = false;
      this.showBanner('No elements found to generate PDF.', 'warning');
      return;
    }
    
    if (!pdfData['paperLayout'] || !pdfData['paperLayout']['width'] || !pdfData['paperLayout']['height']) {
      this.isGeneratingPDF = false;
      this.showBanner('Invalid paper layout information.', 'error');
      return;
    }

      // First save the template, then generate PDF
      this.saveTemplateForPDFGeneration(pdfData);
    } catch (error) {
      this.isGeneratingPDF = false;
      if (this.pdfGenerationTimeout) {
        clearTimeout(this.pdfGenerationTimeout);
        this.pdfGenerationTimeout = null;
      }
      this.showBanner('An error occurred while generating PDF. Please try again.', 'error');
    }
  }

  private saveTemplateForPDFGeneration(pdfData: any) {
    try {
      // Save template with placeholder tokens intact
      const templateData = this.getTemplateData(); // Get original template data with placeholders
    
    // Ensure template data has required properties
    const saveData = {
      name: `PDF Generation Template - ${new Date().toLocaleString()}`,
      description: 'Template for PDF generation with placeholders',
      paperSize: templateData['paperSize'],
      paperWidth: templateData['paperWidth'],
      paperHeight: templateData['paperHeight'],
      paperUnit: templateData['paperUnit'],
      selectedDefaultSize: templateData['selectedDefaultSize'],
      canvasElements: templateData['canvasElements'],
      paperLayoutLeft: templateData['paperLayout'].left,
      paperLayoutTop: templateData['paperLayout'].top,
      paperLayoutWidth: templateData['paperLayout'].width,
      paperLayoutHeight: templateData['paperLayout'].height
    };
    
    this.labelTemplateService.saveTemplate(saveData).subscribe({
      next: (savedTemplate) => {
        
        // Set the current template ID for future bulk PDF generation
        if (savedTemplate.templateId) {
          this.currentTemplateId = savedTemplate.templateId;
          
          // Set the newly saved template as the selected template
          this.selectedTemplate = {
            templateId: savedTemplate.templateId,
            name: saveData.name,
            description: saveData.description,
            paperWidth: saveData.paperWidth,
            paperHeight: saveData.paperHeight,
            unit: saveData.paperUnit,
            jsonSchema: templateData
          };
          
          // Emit the selected template change
          this.selectedTemplateChange.emit(this.selectedTemplate);
        }
        
        // Now generate PDF with the saved template and resolved data
        if (savedTemplate.templateId) {
          this.generatePDFFromSavedTemplate(savedTemplate.templateId, pdfData);
        } else {
          this.showBanner('Failed to get template ID. Please try again.', 'error');
          this.isGeneratingPDF = false;
        }
      },
      error: (error) => {
        this.showBanner('Failed to save template. Please try again.', 'error');
        this.isGeneratingPDF = false;
      }
    });
    } catch (error) {
      this.isGeneratingPDF = false;
      this.showBanner('An error occurred while saving template. Please try again.', 'error');
    }
  }

  private generatePDFFromSavedTemplate(templateId: number, pdfData: any) {
    try {
      // Create request data with resolved placeholder values
      const requestData: { [key: string]: any } = {};
    
    // Extract resolved placeholder values
    if (pdfData.canvasElements) {
      pdfData.canvasElements.forEach((element: any) => {
        if ((element.type === 'text' || element.type === 'textarea' || element.type === 'barcode' || element.type === 'qr') && element.content) {
          // Find the original placeholder name for this resolved content
          const originalElement = this.canvasElements.find(e => e.id === element.id);
          if (originalElement && originalElement.content) {
            const placeholderMatches = originalElement.content.match(/\{\{([^}]+)\}\}/g);
            if (placeholderMatches) {
              placeholderMatches.forEach((match: string) => {
                const placeholderName = match.replace(/\{\{|\}\}/g, '');
                requestData[placeholderName] = element.content;
              });
            }
          }
        }
      });
    }

    // Generate PDF using backend API
    this.pdfService.generatePdf(templateId, { data: requestData }).subscribe({
      next: (pdfBlob) => {
        this.isGeneratingPDF = false;
        if (this.pdfGenerationTimeout) {
          clearTimeout(this.pdfGenerationTimeout);
          this.pdfGenerationTimeout = null;
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.pdfService.downloadPdf(pdfBlob, `label-template-${timestamp}.pdf`);
      },
      error: (error: any) => {
        this.isGeneratingPDF = false;
        if (this.pdfGenerationTimeout) {
          clearTimeout(this.pdfGenerationTimeout);
          this.pdfGenerationTimeout = null;
        }
        this.showBanner(`PDF generation failed: ${error.message}`, 'error', 5000);
      }
    });
    } catch (error) {
      this.isGeneratingPDF = false;
      if (this.pdfGenerationTimeout) {
        clearTimeout(this.pdfGenerationTimeout);
        this.pdfGenerationTimeout = null;
      }
      this.showBanner('An error occurred while generating PDF. Please try again.', 'error');
    }
  }


  /**
   * Get template data for PDF generation
   */
  private getTemplateData(): Record<string, any> {
    const templateData = {
      // Paper size and layout information
      paperSize: this.selectedPaperSize || 'A4',
      paperWidth: this.paperWidth || 4.0,
      paperHeight: this.paperHeight || 6.0,
      paperUnit: this.paperUnit || 'inch',
      selectedDefaultSize: this.selectedDefaultSize || 'shipping-4x6',
      paperLayout: {
        left: 0, // PDF coordinates start at (0,0)
        top: 0,  // PDF coordinates start at (0,0)
        width: this.paperWidth || 4.0, // Paper width in inches
        height: this.paperHeight || 6.0  // Paper height in inches
      },
      
      // Canvas elements with all their properties - include ALL elements for PDF generation
      canvasElements: this.canvasElements.map(element => {
        // Validate element properties
        if (!element.id || !element.type) {
          return null;
        }

        // Keep original pixel coordinates - createJsonSchema will handle the conversion
        const elementData = {
          id: element.id,
          type: element.type,
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          unit: 'px', // Keep as pixels for createJsonSchema
          content: element.content || '',
          fontSize: element.fontSize || 12,
          color: element.color || '#000000',
          fontFamily: element.fontFamily || 'Arial',
          fontWeight: element.fontWeight || 'normal',
          fillColor: element.fillColor || 'transparent',
          borderColor: element.borderColor || 'transparent',
          borderWidth: element.borderWidth || 0,
          isTemplateComponent: element.isTemplateComponent || false,
          templateComponentType: element.templateComponentType || '',
          // Line-specific properties
          lineLength: element.lineLength,
          lineAngle: element.lineAngle,
          lineColor: element.lineColor,
          lineWidth: element.lineWidth,
          // Barcode-specific properties
          barcodeType: element.barcodeType,
          // Image-specific properties
          imageSrc: element.imageSrc,
          imageName: element.imageName,
          imageWidth: element.imageWidth,
          imageHeight: element.imageHeight
        };
        
        
        return elementData;
      }).filter(element => element !== null), // Remove invalid elements
      

      // Metadata
      generatedAt: new Date().toISOString(),
      elementCount: this.canvasElements.length
    };


    return templateData;
  }

  // Clear selected template
  clearSelectedTemplate() {
    this.selectedTemplate = null;
    this.currentTemplateId = null;
    this.selectedTemplateChange.emit(null);
  }

  onPaperSizeChange(size: string) {
    this.selectedPaperSize = size;
    
    // If it's a standard paper size, update the paper dimensions
    const standardSize = this.standardPaperSizes.find(ps => ps.name === size);
    if (standardSize) {
      this.paperWidth = standardSize.width;
      this.paperHeight = standardSize.height;
      this.paperUnit = standardSize.unit;
      this.selectedDefaultSize = size; // Set to the actual paper size name
    }
    
    this.calculatePaperLayout();
    this.selectedPaperSizeChange.emit(size);
  }

  onPaperSizeChangeEvent(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.onPaperSizeChange(target.value);
  }

  onPaperSizeInputChange() {
    // Format the input values to 2 decimal places
    this.paperWidth = this.formatToTwoDecimals(this.paperWidth);
    this.paperHeight = this.formatToTwoDecimals(this.paperHeight);
    
    // Convert the input values to pixels and update the paper layout
    this.calculatePaperLayoutFromInputs();
    this.selectedPaperSizeChange.emit('Custom');
  }

  onWidthInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value);
    if (!isNaN(value)) {
      this.paperWidth = this.formatToTwoDecimals(value);
      this.onPaperSizeInputChange();
    }
  }

  onHeightInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value);
    if (!isNaN(value)) {
      this.paperHeight = this.formatToTwoDecimals(value);
      this.onPaperSizeInputChange();
    }
  }

  // Method to set custom paper size when paper layout is manually resized
  setCustomPaperSize(widthInches: number, heightInches: number) {
    this.selectedDefaultSize = 'custom';
    this.selectedPaperSize = 'Custom';
    this.paperWidth = this.formatToTwoDecimals(widthInches);
    this.paperHeight = this.formatToTwoDecimals(heightInches);
    this.paperUnit = 'inch';
    
    // Don't recalculate paper layout position since user has already positioned it
    // Just emit the paper size change to update the dropdown
    this.selectedPaperSizeChange.emit('Custom');
  }

  // Method to format numbers to 2 decimal places
  private formatToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  // Getter for formatted paper width
  get formattedPaperWidth(): number {
    return this.formatToTwoDecimals(this.paperWidth);
  }

  // Getter for formatted paper height
  get formattedPaperHeight(): number {
    return this.formatToTwoDecimals(this.paperHeight);
  }

  onDefaultSizeChange(size: string) {
    this.selectedDefaultSize = size;

  if (size === 'custom') {
    this.calculatePaperLayoutFromInputs();
    this.selectedPaperSizeChange.emit('Custom');
    return;
  }

    // Check if it's a standard paper size
  const standardSize = this.standardPaperSizes.find(ps => ps.name === size);
  if (standardSize) {
    this.paperWidth = standardSize.width;
    this.paperHeight = standardSize.height;
    this.paperUnit = standardSize.unit;
    this.selectedPaperSize = standardSize.name;
    this.calculatePaperLayoutFromInputs();
    this.selectedPaperSizeChange.emit(standardSize.name);
    return;
  }

    // Find the selected label size (try both by name and by key for backward compatibility)
  const selectedLabelSize = this.labelSizes.find(labelSize =>
    labelSize.name === size || this.getLabelSizeKey(labelSize) === size
  );

  let emittedName = 'Custom';
  if (selectedLabelSize) {
    this.paperWidth = selectedLabelSize.width;
    this.paperHeight = selectedLabelSize.height;
    this.paperUnit = selectedLabelSize.unit;
    this.selectedPaperSize = selectedLabelSize.name;
    this.selectedDefaultSize = selectedLabelSize.name; // Set the actual label name
    emittedName = selectedLabelSize.name;
  } else {
      // Fallback to some default values
    this.paperWidth = 4.0;
    this.paperHeight = 6.0;
    this.paperUnit = 'inch';
    this.selectedPaperSize = 'Custom';
    this.selectedDefaultSize = 'custom';
  }

  this.calculatePaperLayoutFromInputs();
  this.selectedPaperSizeChange.emit(emittedName);    // emit the real name
  }

  // Paper size dropdown methods
  togglePaperSizeDropdown() {
    this.showPaperSizeDropdown = !this.showPaperSizeDropdown;
  }

  closePaperSizeDropdown() {
    this.showPaperSizeDropdown = false;
  }

  selectPaperSize(size: string) {
    this.onDefaultSizeChange(size);
    this.closePaperSizeDropdown();
  }

  getPaperSizeDisplayName(): string {
    if (this.selectedDefaultSize === 'custom') {
      return 'Custom';
    }
    
    // Find in standard paper sizes
    const standardSize = this.standardPaperSizes.find(s => s.name === this.selectedDefaultSize);
    if (standardSize) {
      return standardSize.description;
    }
    
    // Find in label sizes (now directly by name)
    const labelSize = this.labelSizes.find(s => s.name === this.selectedDefaultSize);
    if (labelSize) {
      return labelSize.name;
    }
    
    return this.selectedDefaultSize;
  }


  // Helper method to generate a key for label sizes
  getLabelSizeKey(labelSize: LabelSize): string {
    return labelSize.name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/x/g, 'x')
      .replace(/ø/g, 'diameter');
  }

  /**
   * Determine the correct paper size selection for the dropdown based on loaded dimensions
   */
  private determinePaperSizeSelection(loadResult: any): void {
    // First check if we have saved selectedDefaultSize
    if (loadResult.selectedDefaultSize !== undefined && loadResult.selectedDefaultSize !== null && loadResult.selectedDefaultSize !== 'custom') {
      this.selectedDefaultSize = loadResult.selectedDefaultSize;
      return;
    }

    // Check if dimensions match any standard paper sizes with more tolerance for floating point precision
    const matchingStandardSize = this.standardPaperSizes.find(ps => 
      Math.abs(ps.width - this.paperWidth) < 0.05 && 
      Math.abs(ps.height - this.paperHeight) < 0.05 && 
      ps.unit === this.paperUnit
    );

    if (matchingStandardSize) {
      this.selectedDefaultSize = matchingStandardSize.name;
      return;
    }

    // Check if dimensions match any label sizes with more tolerance for floating point precision
    const matchingLabelSize = this.labelSizes.find(ls => 
      Math.abs(ls.width - this.paperWidth) < 0.05 && 
      Math.abs(ls.height - this.paperHeight) < 0.05 && 
      ls.unit === this.paperUnit
    );

    if (matchingLabelSize) {
      this.selectedDefaultSize = matchingLabelSize.name;
      return;
    }

    // If no match found, set to custom
    this.selectedDefaultSize = 'custom';
  }

  // Get current paper size description for display
  getCurrentPaperSizeDescription(): string {
    // Check if a standard paper size is selected in the dropdown
    const standardSize = this.standardPaperSizes.find(ps => ps.name === this.selectedDefaultSize);
    if (standardSize) {
      return standardSize.description;
    }
    
    // Check if selectedPaperSize is a standard size
    const selectedStandardSize = this.standardPaperSizes.find(ps => ps.name === this.selectedPaperSize);
    if (selectedStandardSize) {
      return selectedStandardSize.description;
    }
    
    // For custom sizes, show the current dimensions
    return `Custom (${this.formatToTwoDecimals(this.paperWidth)} × ${this.formatToTwoDecimals(this.paperHeight)} ${this.paperUnit})`;
  }

  private calculatePaperLayout() {
    const containerWidth = window.innerWidth - 300; // Account for sidebar
    const containerHeight = window.innerHeight - 100; // Account for header

    let width: number, height: number;

    // Always use the current paperWidth and paperHeight values if they are set
    if (this.paperWidth && this.paperHeight && this.paperUnit) {
      width = this.convertToPixels(this.paperWidth, this.paperUnit);
      height = this.convertToPixels(this.paperHeight, this.paperUnit);
    } else {
      // Fallback to standard paper sizes
      const standardSize = this.standardPaperSizes.find(ps => ps.name === this.selectedPaperSize);
      if (standardSize) {
        width = this.convertToPixels(standardSize.width, standardSize.unit);
        height = this.convertToPixels(standardSize.height, standardSize.unit);
      } else {
        // Final fallback to A4
        width = 794; // A4 width in pixels at 96 DPI
        height = 1123; // A4 height in pixels at 96 DPI
      }
    }

    // Center the paper layout
    const centeredLeft = Math.max(0, (containerWidth - width) / 2);
    const centeredTop = Math.max(0, (containerHeight - height) / 2);


    this.paperLayoutChange.emit({
      left: centeredLeft,
      top: centeredTop,
      width: width,
      height: height
    });
  }

  private calculatePaperLayoutFromInputs() {
    const containerWidth = window.innerWidth - 300; // Account for sidebar
    const containerHeight = window.innerHeight - 100; // Account for header

    // Convert input values to pixels
    const width = this.convertToPixels(this.paperWidth, this.paperUnit);
    const height = this.convertToPixels(this.paperHeight, this.paperUnit);

    // Center the paper layout
    // Calculate centered paper layout position
    const centeredLeft = Math.max(0, (containerWidth - width) / 2);
    const centeredTop = Math.max(0, (containerHeight - height) / 2);

    this.paperLayoutChange.emit({
      left: centeredLeft,
      top: centeredTop,
      width: width,
      height: height
    });
  }

  private convertToPixels(value: number, unit: string): number {
    const dpi = 96; // Standard web DPI
    
    if (unit === 'cm') {
      // Convert cm to inches, then to pixels
      // 1 inch = 2.54 cm
      const inches = value / 2.54;
      return inches * dpi;
    } else if (unit === 'inch') {
      // Convert inches to pixels
      return value * dpi;
    }
    
    return value; // Fallback
  }


  onSelectTemplateEvent(event: Event) {
    const target = event.target as HTMLSelectElement;
    const templateName = target.value;
    if (templateName) {
      // Find the template by name
      const template = this.templateManagementService.getCurrentState().savedTemplates.find(t => t.name === templateName);
      this.onSelectTemplate(template);
    } else {
      this.onSelectTemplate(null);
    }
  }


  private getElementsCompletelyInsidePaper(): CanvasElement[] {
    const elementsInside = this.canvasElements.filter(element => {
      const elementRight = element.x + element.width;
      const elementBottom = element.y + element.height;
      const paperRight = this.paperLayoutLeft + this.paperLayoutWidth;
      const paperBottom = this.paperLayoutTop + this.paperLayoutHeight;
      
      // Use a small tolerance for boundary validation to handle floating-point precision issues
      const tolerance = 0.1;
      const isInside = element.x >= (this.paperLayoutLeft - tolerance) && 
                      element.y >= (this.paperLayoutTop - tolerance) && 
                      elementRight <= (paperRight + tolerance) && 
                      elementBottom <= (paperBottom + tolerance);
      
      
      return isInside;
    });
    
    
    return elementsInside;
  }

  // Helper method to check if an element is inside paper layout (for logging purposes)
  private isElementInsidePaperLayout(element: CanvasElement): boolean {
    const elementRight = element.x + element.width;
    const elementBottom = element.y + element.height;
    const paperRight = this.paperLayoutLeft + this.paperLayoutWidth;
    const paperBottom = this.paperLayoutTop + this.paperLayoutHeight;
    
    // Use a small tolerance for boundary validation
    const tolerance = 0.1;
    return element.x >= (this.paperLayoutLeft - tolerance) && 
           element.y >= (this.paperLayoutTop - tolerance) && 
           elementRight <= (paperRight + tolerance) && 
           elementBottom <= (paperBottom + tolerance);
  }


  private validateDatabaseContent(templateData: any) {
    // Ensure all required fields are present
    return {
      ...templateData,
      name: templateData.name || 'Untitled Template',
      description: templateData.description || '',
      paperSize: templateData.paperSize || 'Pallet Label (6 x 6 in)',
      canvasElements: templateData.canvasElements || [],
      paperLayoutLeft: templateData.paperLayoutLeft || 0,
      paperLayoutTop: templateData.paperLayoutTop || 0,
      paperLayoutWidth: templateData.paperLayoutWidth || 576,
      paperLayoutHeight: templateData.paperLayoutHeight || 576
    };
  }

  // Missing methods that are referenced in template
  cancelDeleteTemplate() {
    this.showDeleteDialog = false;
  }

  confirmDeleteTemplate() {
    if (!this.selectedTemplate) {
      return;
    }

    this.isDeleting = true;

    this.labelTemplateService.deleteTemplate(this.selectedTemplate.templateId).subscribe({
      next: () => {
        this.isDeleting = false;
        this.showDeleteDialog = false;
        
        // Show success banner
        this.showBanner(`Template "${this.selectedTemplate.name}" deleted successfully!`, 'success', 4000);
        
        // Invalidate thumbnail cache for the deleted template
        if (this.selectedTemplate.templateId) {
          this.thumbnailService.invalidateTemplateCache(this.selectedTemplate.templateId);
        }
        
        this.selectedTemplate = null;
        this.selectedTemplateChange.emit(null);
        this.templateManagementService.refreshTemplates();
        
        // Clear canvas and reset to defaults when template is deleted
        this.canvasElementsChange.emit([]);
        this.selectedElementChange.emit(null);
        this.resetPaperSizeToDefault();
        this.placeholderValues = {};
        this.showPlaceholderDialog = false;
        this.resetZoom.emit();
        this.clearGrouping.emit();
        this.resetSmartLayout.emit();
        this.clearReferenceLines.emit();
      },
      error: (error: any) => {
        this.isDeleting = false;
        console.error('Error deleting template:', error);
        this.showBanner('Error deleting template: ' + (error.error?.message || error.message || 'Unknown error'), 'error');
      }
    });
  }





  // Placeholder-related methods
  getElementsWithPlaceholders(): CanvasElement[] {
    return this.canvasElements.filter(element => {
      if (element.type === 'text' || element.type === 'textarea' || element.type === 'barcode' || element.type === 'qr') {
        return this.hasPlaceholderSyntax(element.content || '');
      }
      return false;
    });
  }

  getUnresolvedPlaceholders(): CanvasElement[] {
    return this.canvasElements.filter(element => {
      if (element.type === 'text') {
        return this.hasPlaceholderSyntax(element.content || '') &&
               !this.isPlaceholderResolved(element.content || '');
      } else if (element.type === 'textarea') {
        return this.hasPlaceholderSyntax(element.content || '') &&
               !this.isPlaceholderResolved(element.content || '');
      } else if (element.type === 'barcode') {
        // Barcodes are always placeholders and need data
        return this.hasPlaceholderSyntax(element.content || '') &&
               !this.isPlaceholderResolved(element.content || '');
      } else if (element.type === 'qr') {
        // QR codes are always placeholders and need data
        return this.hasPlaceholderSyntax(element.content || '') &&
               !this.isPlaceholderResolved(element.content || '');
      }
      return false;
    });
  }

  private hasPlaceholderSyntax(content: string): boolean {
    return /\{\{[^}]+\}\}/.test(content);
  }

  private isPlaceholderResolved(content: string): boolean {
    const placeholderMatches = content.match(/\{\{([^}]+)\}\}/g);
    if (!placeholderMatches) return true;
    
    return placeholderMatches.every((match: string) => {
      const placeholderName = match.replace(/\{\{|\}\}/g, '');
      return this.placeholderValues[placeholderName] && 
             this.placeholderValues[placeholderName].trim() !== '';
    });
  }

  onPlaceholderValueUpdate(event: { placeholderType: string, value: string }) {
    this.placeholderValues[event.placeholderType] = event.value;
  }

  onPlaceholderInput(event: Event, placeholderType: string) {
    const target = event.target as HTMLInputElement;
    this.placeholderValues[placeholderType] = target.value;
  }

  onPlaceholderDialogClose() {
    this.showPlaceholderDialog = false;
    // Reset PDF generation state if it was stuck
    if (this.isGeneratingPDF) {
      this.isGeneratingPDF = false;
    }
  }

  // CSV Import methods
  onShowCsvImport() {
    
    // Check if a template is loaded or if we have canvas elements (new template)
    if (!this.currentTemplateId && (!this.canvasElements || this.canvasElements.length === 0)) {
      this.showBanner('Please load a template or create a new template with placeholders first before importing CSV data for bulk PDF generation.', 'warning', 5000);
      return;
    }
    
    // If we have canvas elements but no currentTemplateId, auto-save the template
    if (!this.currentTemplateId && this.canvasElements && this.canvasElements.length > 0) {
      this.autoSaveTemplateForCsvImport();
      return;
    }
    
    this.showCsvImportDialog = true;
  }

  private autoSaveTemplateForCsvImport() {
    try {
      
      // Get template data
      const templateData = this.getTemplateData();
      
      // Create proper template data structure for saving
      const saveData = {
        name: `CSV Import Template - ${new Date().toLocaleString()}`,
        description: 'Template for CSV bulk PDF generation',
        paperSize: templateData['paperSize'],
        paperWidth: templateData['paperWidth'],
        paperHeight: templateData['paperHeight'],
        paperUnit: templateData['paperUnit'],
        selectedDefaultSize: templateData['selectedDefaultSize'],
        canvasElements: templateData['canvasElements'],
        paperLayoutLeft: templateData['paperLayout'].left,
        paperLayoutTop: templateData['paperLayout'].top,
        paperLayoutWidth: templateData['paperLayout'].width,
        paperLayoutHeight: templateData['paperLayout'].height
      };
      
      // Save the template
      this.labelTemplateService.saveTemplate(saveData).subscribe({
        next: (savedTemplate) => {
          
          // Set the current template ID
          if (savedTemplate.templateId) {
            this.currentTemplateId = savedTemplate.templateId;
            
            // Set the newly saved template as the selected template
            this.selectedTemplate = {
              templateId: savedTemplate.templateId,
              name: saveData.name,
              description: saveData.description,
              paperWidth: saveData.paperWidth,
              paperHeight: saveData.paperHeight,
              unit: saveData.paperUnit,
              jsonSchema: templateData
            };
            
            // Emit the selected template change
            this.selectedTemplateChange.emit(this.selectedTemplate);
            
            // Now open the CSV import dialog
            this.showCsvImportDialog = true;
          } else {
            this.showBanner('Failed to get template ID. Please try again.', 'error');
          }
        },
        error: (error) => {
          this.showBanner('Failed to save template. Please try again.', 'error');
        }
      });
    } catch (error) {
      this.showBanner('An error occurred while saving template. Please try again.', 'error');
    }
  }

  onCsvImportCancelled() {
    this.showCsvImportDialog = false;
    this.csvImportData = null;
  }

  onCsvDataImported(data: CsvImportData) {
    this.csvImportData = data;
    this.showCsvImportDialog = false;
    
    // Auto-fill placeholder values with CSV data
    this.autoFillPlaceholdersFromCsv(data);
  }

  onBulkPdfGenerated(pdfBlob: Blob) {
    // Keep the dialog open so users can generate more PDFs
    // The PDF is already downloaded by the CSV import component
    // We can add additional handling here if needed
  }

  private autoFillPlaceholdersFromCsv(data: CsvImportData) {
    // Get the first row of data to auto-fill placeholders
    if (data.rows.length > 0) {
      const firstRow = data.rows[0];
      const placeholderTypes = this.getUniquePlaceholderTypes();
      
      // Try to match CSV headers with placeholder types
      placeholderTypes.forEach(placeholderType => {
        const matchingHeader = data.headers.find(header => 
          header.toLowerCase().includes(placeholderType.toLowerCase()) ||
          placeholderType.toLowerCase().includes(header.toLowerCase())
        );
        
        if (matchingHeader && firstRow[matchingHeader]) {
          this.placeholderValues[placeholderType] = firstRow[matchingHeader];
        }
      });
      
    }
  }

  onPlaceholderDialogComplete() {
    try {
      const unresolvedPlaceholders = this.getUnresolvedPlaceholders();
      
      if (unresolvedPlaceholders.length > 0) {
        this.showBanner('Please fill in all placeholder values before generating PDF.', 'warning');
        return;
      }
      
      this.showPlaceholderDialog = false;
      this.generatePDFDirectly();
    } catch (error) {
      this.showBanner('An error occurred while processing placeholder values. Please try again.', 'error');
    }
  }

  getUniquePlaceholderTypes(): string[] {
    const types: string[] = [];
    
    this.canvasElements.forEach(element => {
      if ((element.type === 'text' || element.type === 'textarea' || element.type === 'barcode' || element.type === 'qr') && element.content) {
        const placeholderMatches = element.content.match(/\{\{([^}]+)\}\}/g);
        if (placeholderMatches) {
          placeholderMatches.forEach((match: string) => {
            const placeholderName = match.replace(/\{\{|\}\}/g, '');
            if (!types.includes(placeholderName)) {
              types.push(placeholderName);
            }
          });
        }
      }
    });
    
    return types;
  }

  isPlaceholderFromTextarea(placeholderType: string): boolean {
    return this.canvasElements.some(element => 
      element.type === 'textarea' && 
      element.content && 
      element.content.includes(`{{${placeholderType}}}`)
    );
  }

  private getTemplateDataWithResolvedPlaceholders(): Record<string, any> {
    const templateData = this.getTemplateData();
    
    // Replace placeholder content with resolved values
    templateData['canvasElements'] = templateData['canvasElements'].map((element: any) => {
      if ((element.type === 'text' || element.type === 'textarea' || element.type === 'barcode' || element.type === 'qr') && element.content) {
        let resolvedContent = element.content;
        
        // Replace all {{placeholder}} with actual values
        const placeholderMatches = element.content.match(/\{\{([^}]+)\}\}/g);
        if (placeholderMatches) {
          placeholderMatches.forEach((match: string) => {
            const placeholderName = match.replace(/\{\{|\}\}/g, '');
            if (this.placeholderValues[placeholderName]) {
              resolvedContent = resolvedContent.replace(match, this.placeholderValues[placeholderName]);
            }
          });
        }
        
        return {
          ...element,
          content: resolvedContent
        };
      } else if (element.type === 'image') {
        // For image elements, ensure all image properties are preserved
        return {
          ...element,
          // Keep all image properties as they are (no placeholder resolution needed for images)
          imageSrc: element.imageSrc,
          imageName: element.imageName,
          imageWidth: element.imageWidth,
          imageHeight: element.imageHeight
        };
      }
      return element;
    });
    
    return templateData;
  }

  showBanner(text: string, kind: BannerKind = 'info', ms = 3000) {
    const id = ++this._bannerSeq;
    this.banners = [...this.banners, { id, text, kind }];
    window.setTimeout(() => this.dismissBanner(id), ms);
  }

  dismissBanner(id: number) {
    const banner = this.banners.find(b => b.id === id);
    if (banner) {
      // Mark banner as dismissing to trigger CSS animation
      banner.dismissing = true;
      
      // Remove from array after animation completes
      setTimeout(() => {
        this.banners = this.banners.filter(b => b.id !== id);
      }, 300); // Match CSS animation duration
    }
  }

  trackBanner(index: number, banner: BannerMsg): number {
    return banner.id;
  }

  // ==========================================
  // Modern Dropdown Methods
  // ==========================================

  toggleReviewerDropdown(): void {
    this.showReviewerDropdown = !this.showReviewerDropdown;
  }

  selectReviewer(reviewerId: string): void {
    this.selectedReviewerId = reviewerId;
    this.showReviewerDropdown = false;
  }

  getReviewerDisplayName(): string {
    if (!this.selectedReviewerId) {
      return 'Any Available Reviewer';
    }
    
    const reviewer = this.availableReviewers.find(r => r.userId.toString() === this.selectedReviewerId);
    return reviewer ? `${reviewer.name}` : 'Any Available Reviewer';
  }

  // [CHANGE] Comment-related methods
  onViewCommentsClick(): void {
    this.isCommentMode = !this.isCommentMode;
    this.commentModeChange.emit(this.isCommentMode);
    this.viewCommentsClick.emit();
  }

  setCommentCount(count: number): void {
    this.commentCount = count;
  }

  // [CHANGE] Set unresolved comment count
  setUnresolvedCommentCount(count: number): void {
    this.unresolvedCommentCount = count;
  }

  setCommentMode(enabled: boolean): void {
    this.isCommentMode = enabled;
  }

  // [CHANGE] Method to enable comment mode by default (for rejected templates)
  enableCommentModeByDefault(): void {
    this.isCommentMode = true;
  }

  // Navigate to dashboard when brand/logo is clicked
  onBrandClick(): void {
    this.router.navigate(['/dashboard']);
  }

}
