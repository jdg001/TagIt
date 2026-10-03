import { Injectable } from '@angular/core';
import { DashboardService } from './dashboard.service';

export interface ViewingMode {
  type: 'edit' | 'read-only' | 'public-library' | 'collaboration';
  canEdit: boolean;
  canSave: boolean;
  canGeneratePDF: boolean;
  canChangeSize: boolean;
  showNavigation: boolean;
  showFullHeader: boolean;
  saveMode: 'update' | 'clone' | 'disabled';
  saveTooltip: string;
  canMovePaper: boolean;
  canDeleteTemplate: boolean;
  canSendForReview: boolean;
  showPropertiesPanel: boolean;
  canCreateNew: boolean;
  canClearCanvas: boolean;
  showCommentsButton: boolean;
  canViewComments: boolean;
  canResolveComments: boolean;
  commentsEnabledByDefault: boolean;
  canSaveAsNew: boolean; // [CHANGE] Control whether "Save New" option is available
  allowCollaboration: boolean; // NEW: Enable collaboration features
}

// Default viewing mode constant
export const DEFAULT_VIEWING_MODE: ViewingMode = {
  type: 'edit',
  canEdit: true,
  canSave: true,
  canGeneratePDF: false,
  canChangeSize: true,
  showNavigation: true,
  showFullHeader: true,
  saveMode: 'update',
  saveTooltip: 'Save template',
  canMovePaper: true,
  canDeleteTemplate: true,
  canSendForReview: false,
  showPropertiesPanel: true,
  canCreateNew: true,
  canClearCanvas: true,
  showCommentsButton: false,
  canViewComments: false,
  canResolveComments: false,
  commentsEnabledByDefault: false,
  canSaveAsNew: true, // [CHANGE] Default allows save as new
  allowCollaboration: false // NEW: Default collaboration disabled
};

// ViewingMode factory for creating common modes
export class ViewingModeFactory {
  static createEditMode(): ViewingMode {
    return {
      ...DEFAULT_VIEWING_MODE,
      type: 'edit',
      canEdit: true,
      canSave: true,
      canGeneratePDF: false,
      canChangeSize: true,
      showNavigation: true,
      showFullHeader: true,
      saveMode: 'update',
      saveTooltip: 'Save template',
      canMovePaper: true,
      canDeleteTemplate: true,
      canSendForReview: false,
      showPropertiesPanel: true,
      canCreateNew: true,
      canClearCanvas: true,
      showCommentsButton: false,
      canViewComments: false,
      canResolveComments: false,
      commentsEnabledByDefault: false,
      allowCollaboration: false
    };
  }

  static createReadOnlyMode(): ViewingMode {
    return {
      ...DEFAULT_VIEWING_MODE,
      type: 'read-only',
      canEdit: false,
      canSave: false,
      canGeneratePDF: false,
      canChangeSize: false,
      showNavigation: false,
      showFullHeader: false,
      saveMode: 'disabled',
      saveTooltip: 'Cannot save - template is under review',
      canMovePaper: false,
      canDeleteTemplate: false,
      canSendForReview: false,
      showPropertiesPanel: false,
      canCreateNew: false,
      canClearCanvas: false,
      showCommentsButton: false,
      canViewComments: false,
      canResolveComments: false,
      commentsEnabledByDefault: false,
      allowCollaboration: false
    };
  }

  static createPublicLibraryMode(): ViewingMode {
    return {
      ...DEFAULT_VIEWING_MODE,
      type: 'public-library',
      canEdit: false, // Elements should not be movable
      canSave: false, // Hide save button for published templates
      canGeneratePDF: true,
      canChangeSize: true, // Only paper size can be changed
      showNavigation: false, // Hide navigation bar
      showFullHeader: true,
      saveMode: 'clone',
      saveTooltip: 'Save design with new paper size',
      canMovePaper: false, // Paper should not be movable
      canDeleteTemplate: true, // Show delete button for published templates
      canSendForReview: false,
      showPropertiesPanel: false, // Hide properties panel since elements can't be edited
      canCreateNew: false, // Cannot create new elements
      canClearCanvas: false, // Cannot clear canvas
      showCommentsButton: false,
      canViewComments: false,
      canResolveComments: false,
      commentsEnabledByDefault: false,
      allowCollaboration: false
    };
  }

  static createCollaborationMode(): ViewingMode {
    return {
      ...DEFAULT_VIEWING_MODE,
      type: 'collaboration',
      canEdit: true,           // Allow editing in collaboration
      canSave: false,          // Don't allow saving (collaboration is temporary)
      canGeneratePDF: true,    // Allow PDF generation
      canChangeSize: true,     // Allow paper size changes
      showNavigation: true,    // Show navigation panel
      showFullHeader: true,    // Show full header with collaboration controls
      saveMode: 'disabled',    // Disable saving
      saveTooltip: 'Saving disabled in collaboration mode',
      canMovePaper: true,      // Allow paper movement
      canDeleteTemplate: false, // Don't allow deleting template
      canSendForReview: false, // Don't allow sending for review
      showPropertiesPanel: true, // Show properties panel for editing
      canCreateNew: true,      // Allow creating new elements
      canClearCanvas: true,    // Allow clearing canvas
      showCommentsButton: false, // Hide comments in collaboration
      canViewComments: false,
      canResolveComments: false,
      commentsEnabledByDefault: false,
      canSaveAsNew: false,     // Don't allow save as new
      allowCollaboration: true // Enable collaboration features
    };
  }

  static createPublicLibraryCollaborationMode(): ViewingMode {
    return {
      ...DEFAULT_VIEWING_MODE,
      type: 'collaboration',
      canEdit: true,           // Allow editing in collaboration
      canSave: true,           // Allow saving for public library collaboration
      canGeneratePDF: true,    // Allow PDF generation
      canChangeSize: true,     // Allow paper size changes
      showNavigation: true,    // Show navigation panel
      showFullHeader: true,    // Show full header with collaboration controls
      saveMode: 'update',      // Use update save mode to create design state entries
      saveTooltip: 'Save template and create design state entry',
      canMovePaper: true,      // Allow paper movement
      canDeleteTemplate: false, // Don't allow deleting template
      canSendForReview: true,  // Allow sending for review after saving
      showPropertiesPanel: true, // Show properties panel for editing
      canCreateNew: true,      // Allow creating new elements
      canClearCanvas: true,    // Allow clearing canvas
      showCommentsButton: false, // Hide comments in collaboration
      canViewComments: false,
      canResolveComments: false,
      commentsEnabledByDefault: false,
      canSaveAsNew: true,      // Allow save as new
      allowCollaboration: true // Enable collaboration features
    };
  }

  static createRejectedTemplateMode(): ViewingMode {
    return {
      ...DEFAULT_VIEWING_MODE,
      type: 'edit', // Designer should be able to edit to resolve comments
      canEdit: true, // Designer can edit while reviewing comments
      canSave: true, // Can save after resolving comments
      canGeneratePDF: false,
      canChangeSize: true, // Allow paper size changes
      showNavigation: true, // Show navigation panel for tools
      showFullHeader: true,
      saveMode: 'update',
      saveTooltip: 'Save template after resolving comments',
      canMovePaper: true,
      canDeleteTemplate: true,
      canSendForReview: false, // Cannot send for review until comments resolved
      showPropertiesPanel: true, // Show properties panel for editing
      canCreateNew: true,
      canClearCanvas: false, // Prevent clearing canvas while reviewing comments
      showCommentsButton: true, // Show View Comments button
      canViewComments: true, // Can view reviewer comments
      canResolveComments: true, // Can resolve comments
      commentsEnabledByDefault: true, // Comments mode enabled by default
      canSaveAsNew: false, // [CHANGE] Cannot save as new in rejected mode
      allowCollaboration: false
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class ViewingModeService {
  
  constructor(private dashboardService: DashboardService) {}

  /**
   * Determine viewing mode based on template state, library source, design state, and user role
   */
  determineViewingMode(
    template: any, 
    librarySource?: string, 
    designState?: string
  ): ViewingMode {
    
    // Extract design state from template if not provided separately
    const templateDesignState = designState || template?.designState;
    
    // Get current user role
    const isReviewer = this.dashboardService.hasRole('Reviewer');
    
    // Rejected template mode for designers (Rejected state)
    if (templateDesignState === 'Rejected' && !isReviewer) {
      return ViewingModeFactory.createRejectedTemplateMode();
    }

    // Read-only mode for submitted templates (UnderReview and Assigned states)
    if (templateDesignState === 'UnderReview' || templateDesignState === 'Assigned') {
      return ViewingModeFactory.createReadOnlyMode();
    }

    // Read-only mode for reviewers viewing any template (except public library)
    // BUT: Allow designers to create/edit even if they have reviewer role
    if (isReviewer && librarySource !== 'public' && !this.dashboardService.hasRole('Designer')) {
      const readOnlyMode = ViewingModeFactory.createReadOnlyMode();
      // Allow header controls for reviewers so they can see Accept/Reject buttons
      readOnlyMode.showFullHeader = true;
      return readOnlyMode;
    }

    // Public library mode
    if (librarySource === 'public') {
      return ViewingModeFactory.createPublicLibraryMode();
    }

    // Default edit mode for designers
    const editMode = ViewingModeFactory.createEditMode();
    
    // Set Send for Review based on template state
    // Only show if template is saved (has templateId) and not already under review or assigned
    if (template?.templateId && templateDesignState !== 'UnderReview' && templateDesignState !== 'Assigned') {
      editMode.canSendForReview = true;
    }

    // Validate the viewing mode before returning
    if (!this.validateViewingMode(editMode)) {
      console.warn('Generated viewing mode failed validation, falling back to default');
      return DEFAULT_VIEWING_MODE;
    }

    return editMode;
  }

  /**
   * Check if the current mode allows editing
   */
  isEditMode(viewingMode: ViewingMode): boolean {
    return viewingMode.type === 'edit' || viewingMode.type === 'public-library';
  }

  /**
   * Validate viewing mode object
   */
  validateViewingMode(mode: ViewingMode): boolean {
    if (!mode) return false;
    
    // Check required properties
    const requiredProps = [
      'type', 'canEdit', 'canSave', 'canGeneratePDF', 'canChangeSize',
      'showNavigation', 'showFullHeader', 'saveMode', 'saveTooltip',
      'canMovePaper', 'canDeleteTemplate', 'canSendForReview',
      'showPropertiesPanel', 'canCreateNew', 'canClearCanvas',
      'showCommentsButton', 'canViewComments', 'canResolveComments', 'commentsEnabledByDefault'
    ];
    
    for (const prop of requiredProps) {
      if (mode[prop as keyof ViewingMode] === undefined) {
        console.warn(`ViewingMode validation failed: missing property '${prop}'`);
        return false;
      }
    }
    
    // Check type validity
    if (!['edit', 'read-only', 'public-library'].includes(mode.type)) {
      console.warn(`ViewingMode validation failed: invalid type '${mode.type}'`);
      return false;
    }
    
    // Check saveMode validity
    if (!['update', 'clone', 'disabled'].includes(mode.saveMode)) {
      console.warn(`ViewingMode validation failed: invalid saveMode '${mode.saveMode}'`);
      return false;
    }
    
    return true;
  }

  /**
   * Check if the current mode is read-only
   */
  isReadOnlyMode(viewingMode: ViewingMode): boolean {
    return viewingMode.type === 'read-only';
  }

  /**
   * Check if the current mode is public library
   */
  isPublicLibraryMode(viewingMode: ViewingMode): boolean {
    return viewingMode.type === 'public-library';
  }

  /**
   * Get appropriate CSS classes for the viewing mode
   */
  getViewingModeClasses(viewingMode: ViewingMode): string[] {
    const classes = [`viewing-mode-${viewingMode.type}`];
    
    if (!viewingMode.canEdit) {
      classes.push('read-only');
    }
    
    if (!viewingMode.showNavigation) {
      classes.push('no-navigation');
    }
    
    return classes;
  }
}
