import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, interval } from 'rxjs';

import { DashboardService, User, TemplateWithVersions, DashboardStats, TemplateConflict, EditSession, ConcurrentEditWarning } from '../../services/dashboard.service';
import { AuthService, UserInfo } from '../../services/auth.service';
import { ApiConfigService } from '../../services/api-config.service';
import { LabelTemplateService } from '../../services/label-template.service';
import { ThemeService } from '../../services/theme.service';
import { TooltipDirective } from '../tooltip/tooltip.directive';
import { TemplateThumbnailComponent } from '../template-thumbnail/template-thumbnail.component';
import { UserManagementComponent } from '../user-management/user-management.component';
import { TenantManagementComponent } from '../tenant-management/tenant-management.component';

type BannerKind = 'info' | 'success' | 'warning' | 'error';
interface BannerMsg { id: number; text: string; kind: BannerKind; dismissing?: boolean; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective, TemplateThumbnailComponent, UserManagementComponent, TenantManagementComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('conflictModal') conflictModal!: ElementRef;
  @ViewChild('versionModal') versionModal!: ElementRef;
  @ViewChild('statusDropdown') statusDropdown!: ElementRef;
  @ViewChild('versionDropdown') versionDropdown!: ElementRef;

  // Component state
  private destroy$ = new Subject<void>();
  isLoading = false;
  currentUser: User | null = null;
  authenticatedUser: UserInfo | null = null;
  tagitAdmin = false;
  userRoles: string[] = ['Designer'];
  userRole: string = 'Designer'; // Primary role for backward compatibility
  userId: number = 1; // Will be loaded from localStorage
  isDarkMode = true; // Default to dark mode
  isRoleSelectorMode = false; // [CHANGE] Track role selector mode state

  // Dashboard data
  usersCount: number = 0; // Users count received from user-management component
  tenantsCount: number = 0; // Tenants count received from tenant-management component

  // Template libraries
  publicLibrary: TemplateWithVersions[] = [];
  localLibrary: TemplateWithVersions[] = [];
  mySubmittedLibrary: TemplateWithVersions[] = []; // Designer's own submissions
  allSubmissionsLibrary: TemplateWithVersions[] = []; // All submissions for reviewers
  assignedLibrary: TemplateWithVersions[] = [];

  // Current view
  activeTab: 'public' | 'local' | 'my-submitted' | 'all-submissions' | 'assigned' | 'users' | 'tenants' = 'public';
  selectedTemplate: TemplateWithVersions | null = null;
  selectedVersion: number = 0;

  // Conflict resolution
  activeConflicts: TemplateConflict[] = [];
  activeEditSessions: EditSession[] = [];
  concurrentEditWarning: ConcurrentEditWarning | null = null;
  showConflictModal = false;
  showVersionModal = false;

  // Filters and search
  searchQuery = '';
  statusFilter = 'all';
  versionFilter = 'latest';
  
  // Dropdown states
  showStatusDropdown = false;
  showVersionDropdown = false;

  // Real-time updates
  private updateInterval = interval(120000); // Update every 2 minutes (reduced frequency)
  private lastUpdateTime = 0;
  private readonly MIN_UPDATE_INTERVAL = 30000; // Minimum 30 seconds between updates

  // Comment dialog states
  showAcceptDialog = false;
  showRejectDialog = false;
  showDeleteDialog = false;
  showSendForReviewDialog = false;
  acceptComments = '';
  rejectComments = '';
  isAccepting = false;
  isRejecting = false;
  isDeleting = false;
  isSendingForReview = false;
  selectedTemplateForAction: TemplateWithVersions | null = null;

  // Send for review dialog states
  availableReviewers: any[] = [];
  selectedReviewerId = '';
  showReviewerDropdown = false;

  // Banner messages
  banners: BannerMsg[] = [];
  private _bannerSeq = 0;

  constructor(
    private dashboardService: DashboardService,
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private apiConfigService: ApiConfigService,
    private labelTemplateService: LabelTemplateService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    // [CHANGE] Check if role selector mode is enabled
    this.isRoleSelectorMode = localStorage.getItem('useRoleSelector') === 'true';
    
    this.initializeTagitAdminFlag();
    this.initializeUser();
    this.initializeTheme();
    this.loadDashboardData(true); // Force initial load
    this.startRealTimeUpdates();
  }

  private initializeTheme(): void {
    // Initialize theme from centralized service
    this.isDarkMode = this.themeService.initializeComponentTheme();
    
    // Subscribe to theme changes
    this.themeService.onThemeChange().subscribe(isDarkMode => {
      this.isDarkMode = isDarkMode;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Helper methods for status display
  getStatusIcon(designState?: string, template?: TemplateWithVersions): string {
    switch (designState) {
      case 'Draft': return '●';
      case 'UnderReview': return '●';
      case 'Assigned': return '👤'; // User icon for assigned
      case 'Approved': return '●';
      case 'Published': return '●';
      case 'Rejected': return '●';
      case 'DeleteUnderReview': return '🗑️'; // Trash icon for delete under review
      case 'DeleteAssigned': return '🗑️👤'; // Trash + user icon for delete assigned
      case 'DeleteApproved': return '🗑️✅'; // Trash + checkmark icon for delete approved
      default: return '●';
    }
  }

  getStatusText(designState?: string, template?: TemplateWithVersions): string {
    switch (designState) {
      case 'Draft': return 'Draft';
      case 'UnderReview': return 'Under Review';
      case 'Assigned': return 'Assigned';
      case 'Approved': return 'Approved';
      case 'Published': return 'Published';
      case 'Rejected': return 'Rejected';
      case 'DeleteUnderReview': return 'Delete Under Review';
      case 'DeleteAssigned': return 'Delete Assigned';
      case 'DeleteApproved': return 'Delete Approved';
      default: return 'Unknown';
    }
  }

  getStatusBadgeClass(template: TemplateWithVersions): string {
    return 'status-' + (template.designState || 'unknown').toLowerCase();
  }

  private initializeUser(): void {
    // Get authenticated user info
    this.authenticatedUser = this.authService.getUserInfo();
    
    this.userId = this.dashboardService.getCurrentUserId();
    this.userRoles = this.dashboardService.getCurrentUserRoles();
    
    // Set current user based on authenticated user or fallback to test user
    if (this.authenticatedUser) {
      this.currentUser = {
        userId: this.userId,
        username: this.authenticatedUser.name || this.authenticatedUser.email,
        roles: this.userRoles
      };
    } else {
      // Fallback to test user for backward compatibility
      this.currentUser = {
        userId: this.userId,
        username: 'Test User',
        roles: this.userRoles
      };
    }
    
    // Set initial tab based on roles (priority: Admin > Designer > Reviewer)
    if (this.hasRole('Admin')) {
      this.activeTab = 'users';
      this.statusFilter = 'all';
    } else if (this.hasRole('Designer')) {
      this.activeTab = 'local';
      this.statusFilter = 'all';
    } else if (this.hasRole('Reviewer')) {
      this.activeTab = 'all-submissions';
      this.statusFilter = 'UnderReview'; // Default to Under Review for reviewers
    } else {
      this.activeTab = 'public';
      this.statusFilter = 'all';
    }
  }

  private loadDashboardData(forceReload: boolean = false): void {
    const now = Date.now();
    
    // Prevent too frequent updates
    if (!forceReload && (now - this.lastUpdateTime) < this.MIN_UPDATE_INTERVAL) {
      return;
    }
    
    this.isLoading = true;
    this.lastUpdateTime = now;
    
    this.dashboardService.getDashboardData(this.userId, this.userRole, forceReload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.publicLibrary = data.templates || [];
          this.activeConflicts = data.conflicts || [];
          this.activeEditSessions = data.activeSessions || [];
          
          
          // Only load libraries on initial load or when forced
          if (forceReload || this.publicLibrary.length === 0) {
            this.loadLibraries();
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading dashboard data:', error);
          this.isLoading = false;
        }
      });
  }

  private loadLibraries(): void {
    // Load different libraries based on roles
    if (this.hasRole('Designer')) {
      this.loadLibrary('local');
      this.loadLibrary('my-submitted');
    }
    
    if (this.hasRole('Reviewer')) {
      this.loadLibrary('all-submissions');
      this.loadLibrary('assigned');
    }
    
    // Always load public library
    this.loadLibrary('public');
  }

  private loadLibrary(libraryType: 'public' | 'local' | 'my-submitted' | 'all-submissions' | 'assigned'): void {
    
    this.dashboardService.getTemplatesByLibrary(this.userId, libraryType)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (templates) => {
          switch (libraryType) {
            case 'public':
              this.publicLibrary = templates;
              break;
            case 'local':
              this.localLibrary = templates;
              break;
            case 'my-submitted':
              this.mySubmittedLibrary = templates;
              break;
            case 'all-submissions':
              this.allSubmissionsLibrary = templates;
              break;
            case 'assigned':
              this.assignedLibrary = templates;
              break;
          }
        },
        error: (error) => {
          console.error(`Error loading ${libraryType} library:`, error);
        }
      });
  }

  private startRealTimeUpdates(): void {
    this.updateInterval
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Only update conflicts, not full data reload
        this.updateConflicts();
      });
  }

  private updateConflicts(): void {
    // Lightweight update - only fetch conflicts (use cache if available)
    this.dashboardService.getDashboardData(this.userId, this.userRole, false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.activeConflicts = data.conflicts || [];
          this.activeEditSessions = data.activeSessions || [];
        },
        error: (error) => {
          console.error('Error updating conflicts:', error);
        }
      });
  }

  // ==========================================
  // Template Management
  // ==========================================

  onCreateTemplate(): void {
    this.router.navigate(['/designer'], { 
      queryParams: { mode: 'create' } 
    });
  }

  onEditTemplate(template: TemplateWithVersions, version?: number): void {
    // Navigate to designer page to edit the template
    this.router.navigate(['/designer'], { 
      queryParams: { 
        templateId: template.templateId,
        version: version || template.latestVersion,
        librarySource: this.activeTab, // Pass current library context
        mode: 'edit'
      } 
    });
  }

  onViewTemplate(template: TemplateWithVersions, version?: number): void {
    // Navigate to designer page to view/edit the template
    this.router.navigate(['/designer'], { 
      queryParams: { 
        templateId: template.templateId,
        librarySource: this.activeTab, // Pass current library context
        mode: 'view'
      } 
    });
  }

  onCollaborateTemplate(template: TemplateWithVersions, version?: number): void {
    // Navigate to designer page in collaboration mode
    this.router.navigate(['/designer'], { 
      queryParams: { 
        templateId: template.templateId,
        version: version || template.latestVersion,
        librarySource: 'public',
        mode: 'collaborate'
      } 
    });
  }

  onDeleteTemplate(template: TemplateWithVersions): void {
    this.selectedTemplateForAction = template;
    
    // For published templates in public library, show send for review dialog instead of delete dialog
    if (template.designState === 'Published' && this.activeTab === 'public') {
      this.selectedReviewerId = '';
      this.loadAvailableReviewers();
      this.showSendForReviewDialog = true;
    } else {
      // For draft templates, show regular delete dialog
      this.showDeleteDialog = true;
    }
  }

  onPublishTemplate(template: TemplateWithVersions): void {
    if (!template.designStateId) {
      console.error('No design state ID found for template:', template);
      return;
    }

    this.dashboardService.publishTemplate(template.designStateId, this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Update the template's design state locally
          template.designState = 'Published';
          this.showBanner(`Template "${template.name}" published successfully to public library!`, 'success', 4000);
          this.loadDashboardData(true); // Force reload to get updated data
        },
        error: (error) => {
          console.error('Error publishing template:', error);
          this.showBanner('Error publishing template: ' + (error.error?.message || error.message || 'Unknown error'), 'error');
        }
      });
  }

  onSubmitForReview(template: TemplateWithVersions): void {
    this.selectedTemplateForAction = template;
    this.selectedReviewerId = '';
    this.loadAvailableReviewers();
    this.showSendForReviewDialog = true;
  }

  onApproveTemplate(template: TemplateWithVersions): void {
    this.selectedTemplateForAction = template;
    this.acceptComments = '';
    this.showAcceptDialog = true;
  }

  onRejectTemplate(template: TemplateWithVersions): void {
    this.selectedTemplateForAction = template;
    this.rejectComments = '';
    this.showRejectDialog = true;
  }

  confirmAcceptTemplate(): void {
    if (!this.selectedTemplateForAction) return;

    this.isAccepting = true;
    
    const apiUrl = this.apiConfigService.getCurrentApiUrl();
    if (!apiUrl) {
      console.error('API URL not configured');
      this.isAccepting = false;
      return;
    }

    const acceptData = {
      stateChangedBy: this.dashboardService.getCurrentUserId(),
      comments: this.acceptComments.trim() || 'Template accepted for review',
      stateChangedAt: new Date().toISOString()
    };

    // First get the design state ID for this template
    this.getDesignStateIdForTemplate(this.selectedTemplateForAction.templateId).then(designStateId => {
      if (!designStateId) {
        this.isAccepting = false;
        console.error('Could not find design state for template');
        return;
      }

      // Check if this is a delete request BEFORE calling the backend API
      const isDeleteRequest = this.selectedTemplateForAction!.designState === 'DeleteAssigned' || 
                             this.selectedTemplateForAction!.designState === 'DeleteUnderReview';
      
      if (isDeleteRequest) {
        // For delete requests, call the backend approve API (which sets state to DeleteApproved)
        const acceptUrl = `${apiUrl}/designstate/${designStateId}/approve`;

        this.http.post(acceptUrl, acceptData).subscribe({
          next: (response) => {
            // After backend approval (state is now DeleteApproved), proceed with actual deletion
            this.labelTemplateService.deleteTemplate(this.selectedTemplateForAction!.templateId)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  this.showBanner(`Template "${this.selectedTemplateForAction!.name}" delete request approved and template deleted successfully!`, 'success', 4000);
                  this.cancelAcceptTemplate();
                  this.loadDashboardData(true);
                },
                error: (error) => {
                  console.error('Error deleting template after approval:', error);
                  this.showBanner('Error deleting template: ' + (error.error?.message || error.message || 'Unknown error'), 'error');
                  this.isAccepting = false;
                }
              });
          },
          error: (error) => {
            console.error('Error approving delete request:', error);
            this.showBanner('Error approving delete request: ' + (error.error?.message || error.message || 'Unknown error'), 'error');
            this.isAccepting = false;
          }
        });
      } else {
        // For regular template approval, call the backend approve API
        const acceptUrl = `${apiUrl}/designstate/${designStateId}/approve`;

        this.http.post(acceptUrl, acceptData).subscribe({
          next: (response) => {
            // For regular template approval
            this.selectedTemplateForAction!.designState = 'Approved';
            this.showBanner(`Template "${this.selectedTemplateForAction!.name}" accepted successfully! You can now publish it.`, 'success', 4000);
            this.cancelAcceptTemplate();
            this.loadDashboardData(true); // Force reload to get updated data
          },
          error: (error) => {
            console.error('Error accepting template:', error);
            this.showBanner('Error accepting template: ' + (error.error?.message || error.message || 'Unknown error'), 'error');
            this.isAccepting = false;
          }
        });
      }
    }).catch(error => {
      console.error('Error getting design state ID:', error);
      this.isAccepting = false;
    });
  }

  confirmRejectTemplate(): void {
    if (!this.selectedTemplateForAction || !this.rejectComments.trim()) {
      return;
    }

    this.isRejecting = true;
    
    const apiUrl = this.apiConfigService.getCurrentApiUrl();
    if (!apiUrl) {
      console.error('API URL not configured');
      this.isRejecting = false;
      return;
    }

    const rejectData = {
      stateChangedBy: this.dashboardService.getCurrentUserId(),
      comments: this.rejectComments.trim(),
      stateChangedAt: new Date().toISOString()
    };

    // First get the design state ID for this template
    this.getDesignStateIdForTemplate(this.selectedTemplateForAction.templateId).then(designStateId => {
      if (!designStateId) {
        this.isRejecting = false;
        console.error('Could not find design state for template');
        return;
      }

      const rejectUrl = `${apiUrl}/designstate/${designStateId}/reject`;
      this.http.post(rejectUrl, rejectData).subscribe({
        next: (response) => {
          // Check if this is a delete request
          const isDeleteRequest = this.selectedTemplateForAction!.designState === 'DeleteAssigned' || 
                                 this.selectedTemplateForAction!.designState === 'DeleteUnderReview';
          
          if (isDeleteRequest) {
            // For delete requests, rejection means returning to published state
            this.showBanner(`Delete request for template "${this.selectedTemplateForAction!.name}" rejected. Template remains in public library.`, 'success', 4000);
          } else {
            // For regular template rejection
            this.showBanner(`Template "${this.selectedTemplateForAction!.name}" rejected and returned to designer.`, 'success', 4000);
          }
          
          this.cancelRejectTemplate();
          this.loadDashboardData(true); // Force reload to get updated data
          
          // For delete request rejections, specifically reload public library to ensure template appears
          if (isDeleteRequest) {
            setTimeout(() => {
              this.loadLibrary('public');
            }, 500); // Small delay to ensure backend state is updated
          }
        },
        error: (error) => {
          console.error('Error rejecting template:', error);
          this.showBanner('Error rejecting template: ' + (error.error?.message || error.message || 'Unknown error'), 'error');
          this.isRejecting = false;
        }
      });
    }).catch(error => {
      console.error('Error getting design state ID:', error);
      this.isRejecting = false;
    });
  }

  cancelAcceptTemplate(): void {
    this.showAcceptDialog = false;
    this.acceptComments = '';
    this.selectedTemplateForAction = null;
    this.isAccepting = false;
  }

  cancelRejectTemplate(): void {
    this.showRejectDialog = false;
    this.rejectComments = '';
    this.selectedTemplateForAction = null;
    this.isRejecting = false;
  }

  confirmDeleteTemplate(): void {
    if (!this.selectedTemplateForAction) return;
    
    this.isDeleting = true;
    this.labelTemplateService.deleteTemplate(this.selectedTemplateForAction.templateId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isDeleting = false;
          this.showBanner(`Template "${this.selectedTemplateForAction!.name}" deleted successfully!`, 'success', 4000);
          this.cancelDeleteTemplate();
          this.loadDashboardData(true); // Force reload after delete
        },
        error: (error) => {
          this.isDeleting = false;
          console.error('Error deleting template:', error);
          this.showBanner('Error deleting template: ' + (error.error?.message || error.message || 'Unknown error'), 'error');
        }
      });
  }

  cancelDeleteTemplate(): void {
    this.showDeleteDialog = false;
    this.selectedTemplateForAction = null;
    this.isDeleting = false;
  }

  loadAvailableReviewers(): void {
    const apiUrl = this.apiConfigService.getCurrentApiUrl();
    if (!apiUrl) {
      console.error('API URL not configured');
      this.showBanner('API URL not configured', 'error');
      // Use fallback data for testing (excluding current user)
      this.availableReviewers = [
        { userId: 1, name: 'John Reviewer', email: 'john@example.com' },
        { userId: 2, name: 'Jane Reviewer', email: 'jane@example.com' },
        { userId: 3, name: 'Bob Reviewer', email: 'bob@example.com' }
      ].filter(reviewer => reviewer.userId !== this.userId);
      return;
    }

    // Construct the reviewers URL
    const reviewersUrl = `${apiUrl}/users/search?roles=Reviewer&take=50`;
    
    this.http.get(reviewersUrl)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response && response.items) {
            // Filter out the current user from the reviewer list
            this.availableReviewers = response.items
              .map((user: any) => ({
                userId: user.userId,
                name: user.name || user.email,
                email: user.email
              }))
              .filter((reviewer: any) => reviewer.userId !== this.userId);
          } else {
            // Fallback data if API response is unexpected (excluding current user)
            this.availableReviewers = [
              { userId: 1, name: 'John Reviewer', email: 'john@example.com' },
              { userId: 2, name: 'Jane Reviewer', email: 'jane@example.com' }
            ].filter(reviewer => reviewer.userId !== this.userId);
          }
        },
        error: (error) => {
          console.error('Error loading reviewers:', error);
          // Use fallback data on error (excluding current user)
          this.availableReviewers = [
            { userId: 1, name: 'John Reviewer', email: 'john@example.com' },
            { userId: 2, name: 'Jane Reviewer', email: 'jane@example.com' }
          ].filter(reviewer => reviewer.userId !== this.userId);
        }
      });
  }

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
    return reviewer ? `${reviewer.name} (${reviewer.email})` : 'Any Available Reviewer';
  }

  confirmSendForReview(): void {
    if (!this.selectedTemplateForAction) {
      this.showBanner('No template selected to send for review.', 'error');
      return;
    }

    if (this.isSendingForReview) return;

    // Check if user is trying to assign their own template to themselves
    if (this.selectedReviewerId && parseInt(this.selectedReviewerId) === this.userId && 
        Number(this.selectedTemplateForAction.designerId) === Number(this.userId)) {
      this.showBanner('You cannot assign your own template to yourself. Please select a different reviewer or choose "Any Available Reviewer".', 'error', 5000);
      return;
    }

    this.isSendingForReview = true;

    // Check if this is a delete request for a published template
    const isDeleteRequest = this.selectedTemplateForAction.designState === 'Published' && this.activeTab === 'public';

    const reviewData = {
      StateChangedBy: this.userId,
      ReviewerId: this.selectedReviewerId ? parseInt(this.selectedReviewerId) : null,
      Comments: null,
      StateChangedAt: new Date().toISOString(),
      IsDeleteRequest: isDeleteRequest // Add flag to indicate this is a delete request
    };

    const apiUrl = this.apiConfigService.getCurrentApiUrl();
    if (!apiUrl) {
      this.isSendingForReview = false;
      console.error('API URL not configured');
      this.showBanner('API URL not configured', 'error');
      return;
    }

    // First get the design state ID for this template, create one if it doesn't exist
    this.getDesignStateIdForTemplate(this.selectedTemplateForAction.templateId).then(designStateId => {
      if (!designStateId) {
        // Create a design state for this template if it doesn't exist
        this.createDesignStateForTemplate(this.selectedTemplateForAction!.templateId).then(newDesignStateId => {
          if (newDesignStateId) {
            this.submitTemplateForReview(newDesignStateId, reviewData);
          } else {
            this.isSendingForReview = false;
            this.showBanner('Could not create design state for template', 'error');
          }
        }).catch(error => {
          console.error('Error creating design state:', error);
          this.isSendingForReview = false;
          this.showBanner('Error creating template state', 'error');
        });
      } else {
        this.submitTemplateForReview(designStateId, reviewData);
      }
    }).catch(error => {
      console.error('Error getting design state ID:', error);
      this.isSendingForReview = false;
      this.showBanner('Error getting template state', 'error');
    });
  }

  cancelSendForReview(): void {
    this.showSendForReviewDialog = false;
    this.selectedReviewerId = '';
    this.selectedTemplateForAction = null;
    this.isSendingForReview = false;
    this.showReviewerDropdown = false;
  }

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

  private createDesignStateForTemplate(templateId: number): Promise<number | null> {
    const apiUrl = this.apiConfigService.getCurrentApiUrl();
    if (!apiUrl) {
      return Promise.reject('API URL not configured');
    }

    const createStateUrl = `${apiUrl}/designstate`;
    const createData = {
      TemplateId: templateId,
      DesignerId: this.userId,
      ReviewerId: null,
      State: 'Draft',
      VersionNumber: 1,
      Comments: null,
      StateChangedAt: new Date().toISOString(),
      StateChangedBy: this.userId,
      IsPublished: false,
      PublishedBy: null,
      PublishedAt: null
    };

    return this.http.post<any>(createStateUrl, createData).toPromise()
      .then((response: any) => {
        if (response && response.designStateId) {
          return response.designStateId;
        }
        return null;
      })
      .catch((error) => {
        console.error('Error creating design state:', error);
        throw error;
      });
  }

  private submitTemplateForReview(designStateId: number, reviewData: any): void {
    const apiUrl = this.apiConfigService.getCurrentApiUrl();
    if (!apiUrl) {
      this.isSendingForReview = false;
      this.showBanner('API URL not configured', 'error');
      return;
    }

    const submitUrl = `${apiUrl}/designstate/${designStateId}/submit-review`;

    this.http.post(submitUrl, reviewData).subscribe({
      next: (response: any) => {
        this.isSendingForReview = false;
        this.showSendForReviewDialog = false;
        
        // Capture the reviewer ID before resetting it
        const wasAssignedToSpecificReviewer = this.selectedReviewerId && this.selectedReviewerId !== '';
        this.selectedReviewerId = '';
        
        // Check if this is a delete request
        const isDeleteRequest = reviewData.IsDeleteRequest;
        
        let message: string;
        if (isDeleteRequest) {
          message = wasAssignedToSpecificReviewer 
            ? 'Delete request sent for review to assigned reviewer!' 
            : 'Delete request sent for review to all reviewers!';
        } else {
          message = wasAssignedToSpecificReviewer 
            ? 'Template sent for review to assigned reviewer!' 
            : 'Template sent for review to all reviewers!';
        }
        
        this.showBanner(message, 'success', 4000);
        this.cancelSendForReview();
        this.loadDashboardData(true); // Force reload after submit
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
  }

  onAssignToMe(template: TemplateWithVersions): void {
    // Check if user is trying to assign their own template to themselves
    if (Number(template.designerId) === Number(this.userId)) {
      this.showBanner('You cannot assign your own template to yourself. Please select a different reviewer.', 'error', 5000);
      return;
    }

    // Assign the template to the current reviewer
    this.dashboardService.assignTemplateToReviewer(template.templateId, this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedTemplate) => {
          this.showBanner(`Template "${template.name}" assigned to you successfully!`, 'success', 4000);
          // Reload both all-submissions and assigned libraries
          this.loadLibrary('all-submissions');
          this.loadLibrary('assigned');
          
          // Also reload dashboard data to ensure everything is in sync
          this.loadDashboardData(true);
        },
        error: (error) => {
          console.error('Error assigning template:', error);
          this.showBanner('Error assigning template: ' + (error.error?.message || error.message || 'Unknown error'), 'error');
        }
      });
  }

  onAssignDeleteRequestToMe(template: TemplateWithVersions): void {
    // Check if user is trying to assign their own template to themselves
    if (Number(template.designerId) === Number(this.userId)) {
      this.showBanner('You cannot assign your own delete request to yourself. Please select a different reviewer.', 'error', 5000);
      return;
    }

    // Assign the delete request to the current reviewer
    this.dashboardService.assignTemplateToReviewer(template.templateId, this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedTemplate) => {
          this.showBanner(`Delete request for template "${template.name}" assigned to you successfully!`, 'success', 4000);
          // Reload both all-submissions and assigned libraries
          this.loadLibrary('all-submissions');
          this.loadLibrary('assigned');
          
          // Also reload dashboard data to ensure everything is in sync
          this.loadDashboardData(true);
        },
        error: (error) => {
          console.error('Error assigning delete request:', error);
          this.showBanner('Error assigning delete request: ' + (error.error?.message || error.message || 'Unknown error'), 'error');
        }
      });
  }

  onRemoveFromAssigned(template: TemplateWithVersions): void {
    // Remove the template assignment (clear reviewer ID)
    this.dashboardService.removeTemplateAssignment(template.templateId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedTemplate) => {
          // Reload both all-submissions and assigned libraries
          this.loadLibrary('all-submissions');
          this.loadLibrary('assigned');
          
          // Also reload dashboard data to ensure everything is in sync
          this.loadDashboardData(true);
        },
        error: (error) => {
          console.error('Error removing template assignment:', error);
        }
      });
  }

  // ==========================================
  // Conflict Resolution
  // ==========================================

  private checkConcurrentEdit(templateId: number, version?: number): void {
    this.dashboardService.checkConcurrentEdit(templateId, this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (warning) => {
          this.concurrentEditWarning = warning;
          
          if (warning.concurrentCount > 0) {
            // Show warning but allow edit
            this.showConcurrentEditWarning();
          } else {
            // No conflicts, proceed with edit
            this.proceedWithEdit(templateId, version);
          }
        },
        error: (error) => {
          console.error('Error checking concurrent edit:', error);
          // Proceed with edit on error
          this.proceedWithEdit(templateId, version);
        }
      });
  }

  private showConcurrentEditWarning(): void {
    // Show warning modal or notification
    if (this.concurrentEditWarning) {
      alert(`Warning: ${this.concurrentEditWarning.warningMessage}\n\nYou can still edit, but conflicts may occur.`);
    }
  }

  private proceedWithEdit(templateId: number, version?: number): void {
    // Start edit session
    this.dashboardService.startEditSession(templateId, this.userId, version || 1)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          // Navigate to designer with edit session
          this.router.navigate(['/designer'], { 
            queryParams: { 
              mode: 'edit', 
              templateId: templateId,
              version: version,
              sessionId: session.sessionId
            } 
          });
        },
        error: (error) => {
          console.error('Error starting edit session:', error);
        }
      });
  }

  onResolveConflict(conflict: TemplateConflict): void {
    this.showConflictModal = true;
    // Implementation for conflict resolution UI
  }

  onResolveConflictSubmit(resolution: string): void {
    // Implementation for submitting conflict resolution
    this.showConflictModal = false;
  }

  // ==========================================
  // User Management (Admin only) - Now handled by UserManagementComponent
  // ==========================================

  onUsersCountChanged(count: number): void {
    this.usersCount = count;
  }

  onTenantsCountChanged(count: number): void {
    this.tenantsCount = count;
  }

  // ==========================================
  // Banner Methods
  // ==========================================

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
  // UI Helpers
  // ==========================================

  onTabChange(tab: 'public' | 'local' | 'my-submitted' | 'all-submissions' | 'assigned' | 'users' | 'tenants'): void {
    this.activeTab = tab;
    
    // Set default status filter based on tab
    switch (tab) {
      case 'all-submissions':
        this.statusFilter = 'UnderReview'; // Default to Under Review for reviewers
        break;
      case 'assigned':
        this.statusFilter = 'all'; // Show all assigned templates including approved ones
        break;
      case 'my-submitted':
        this.statusFilter = 'UnderReview'; // Default to Under Review for designer's submissions
        break;
      default:
        this.statusFilter = 'all'; // Default to all for other tabs
        break;
    }
  }

  isSubmissionTab(): boolean {
    return this.activeTab === 'my-submitted' || this.activeTab === 'all-submissions';
  }

  onRefreshDashboard(): void {
    this.loadDashboardData(true); // Force full reload
  }

  // Theme management methods
  toggleTheme(): void {
    // Use centralized theme service
    this.themeService.toggleTheme();
  }

  getCurrentLibrary(): TemplateWithVersions[] {
    switch (this.activeTab) {
      case 'public':
        return this.publicLibrary;
      case 'local':
        return this.localLibrary;
      case 'my-submitted':
        return this.mySubmittedLibrary;
      case 'all-submissions':
        return this.allSubmissionsLibrary;
      case 'assigned':
        return this.assignedLibrary;
      default:
        return [];
    }
  }

  getFilteredTemplates(): TemplateWithVersions[] {
    let templates = this.getCurrentLibrary();
    // Apply search filter
    if (this.searchQuery) {
      templates = templates.filter(template =>
        template.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        template.description?.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    }
    
    // Apply status filter
    if (this.statusFilter !== 'all') {
      templates = templates.filter(template => template.designState === this.statusFilter);
    }
    
    return templates;
  }


  canEdit(template: TemplateWithVersions): boolean {
    if (this.hasRole('Admin')) return true;
    if (this.hasRole('Designer') && Number(template.designerId) === Number(this.userId)) return true;
    return false;
  }

  canDelete(template: TemplateWithVersions): boolean {
    // Show delete button in draft mode (local library)
    if (template.designState === 'Draft' && this.activeTab === 'local') {
      return this.canEdit(template);
    }
    
    // Show delete button in public library only for designers and admins
    if (this.activeTab === 'public') {
      return this.hasAnyRole(['Designer', 'Admin']);
    }
    
    return false;
  }

  canReview(template: TemplateWithVersions): boolean {
    return this.hasAnyRole(['Reviewer', 'Admin']);
  }

  canAssignToMe(template: TemplateWithVersions): boolean {
    // Only show for reviewers in "All Submissions" tab
    // Template should be under review (not assigned yet)
    // Cannot assign own templates to yourself
    const hasReviewerRole = this.hasRole('Reviewer');
    const isAllSubmissionsTab = this.activeTab === 'all-submissions';
    const isUnderReview = template.designState === 'UnderReview';
    const isNotOwnTemplate = Number(template.designerId) !== Number(this.userId);
    
    const canAssign = hasReviewerRole && isAllSubmissionsTab && isUnderReview && isNotOwnTemplate;
    
    return canAssign;
  }

  canAssignDeleteRequestToMe(template: TemplateWithVersions): boolean {
    // Only show for reviewers in "All Submissions" tab
    // Template should be delete under review (not assigned yet)
    // Cannot assign own templates to yourself
    const hasReviewerRole = this.hasRole('Reviewer');
    const isAllSubmissionsTab = this.activeTab === 'all-submissions';
    const isDeleteUnderReview = template.designState === 'DeleteUnderReview';
    const isNotOwnTemplate = Number(template.designerId) !== Number(this.userId);
    
    const canAssign = hasReviewerRole && isAllSubmissionsTab && isDeleteUnderReview && isNotOwnTemplate;
    
    return canAssign;
  }

  canRemoveFromAssigned(template: TemplateWithVersions): boolean {
    // Only show for reviewers in "Assigned to me" tab
    // Template should be assigned to this reviewer
    const hasReviewerRole = this.hasRole('Reviewer');
    const isAssignedTab = this.activeTab === 'assigned';
    const isAssigned = template.designState === 'Assigned';
    const isAssignedToMe = Number(template.reviewerId) === Number(this.userId);
    
    // Debug logging
    console.log('[DASHBOARD] canRemoveFromAssigned check:', {
      templateId: template.templateId,
      templateName: template.name,
      designState: template.designState,
      reviewerId: template.reviewerId,
      userId: this.userId,
      hasReviewerRole,
      isAssignedTab,
      isAssigned,
      isAssignedToMe,
      activeTab: this.activeTab
    });
    
    const canRemove = hasReviewerRole && isAssignedTab && isAssigned && isAssignedToMe;
    return canRemove;
  }

  canPublish(template: TemplateWithVersions): boolean {
    return this.hasAnyRole(['Reviewer', 'Admin']);
  }

  // ==========================================
  // Role Management Methods
  // ==========================================

  hasRole(role: string): boolean {
    const hasRole = this.dashboardService.hasRole(role);
    return hasRole;
  }

  hasAnyRole(roles: string[]): boolean {
    return this.dashboardService.hasAnyRole(roles);
  }

  hasAllRoles(roles: string[]): boolean {
    return this.dashboardService.hasAllRoles(roles);
  }

  // ==========================================
  // Version Management
  // ==========================================

  onVersionChange(version: number): void {
    this.selectedVersion = version;
    // Load template data for selected version
  }

  onCompareVersions(template: TemplateWithVersions): void {
    if (!template) return;
    // Implementation for version comparison
  }

  onMergeVersions(template: TemplateWithVersions): void {
    if (!template) return;
    // Implementation for version merging
  }

  // ==========================================
  // Real-time Notifications
  // ==========================================

  onNotificationClick(notification: any): void {
    // Handle notification click
  }

  onMarkNotificationRead(notificationId: string): void {
    // Mark notification as read
  }

  onClearAllNotifications(): void {
    // Clear all notifications
  }

  // ==========================================
  // Modern Dropdown Methods
  // ==========================================

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // Close dropdowns when clicking outside
    const target = event.target as HTMLElement;
    
    // Check if click is outside status dropdown
    if (this.statusDropdown && !this.statusDropdown.nativeElement.contains(target)) {
      this.showStatusDropdown = false;
    }
    
    // Check if click is outside version dropdown
    if (this.versionDropdown && !this.versionDropdown.nativeElement.contains(target)) {
      this.showVersionDropdown = false;
    }
  }

  toggleStatusDropdown(): void {
    this.showStatusDropdown = !this.showStatusDropdown;
    this.showVersionDropdown = false; // Close other dropdown
  }

  toggleVersionDropdown(): void {
    this.showVersionDropdown = !this.showVersionDropdown;
    this.showStatusDropdown = false; // Close other dropdown
  }

  selectStatusFilter(value: string): void {
    this.statusFilter = value;
    this.showStatusDropdown = false;
  }

  selectVersionFilter(value: string): void {
    this.versionFilter = value;
    this.showVersionDropdown = false;
  }

  getStatusFilterDisplayName(): string {
    switch (this.statusFilter) {
      case 'all': return 'All Status';
      case 'Published': return 'Published';
      case 'Draft': return 'Draft';
      case 'UnderReview': return 'Under Review';
      case 'Assigned': return 'Assigned';
      case 'Rejected': return 'Rejected';
      case 'DeleteUnderReview': return 'Delete Under Review';
      case 'DeleteAssigned': return 'Delete Assigned';
      default: return 'All Status';
    }
  }

  getVersionFilterDisplayName(): string {
    switch (this.versionFilter) {
      case 'latest': return 'Latest Version';
      case 'all': return 'All Versions';
      default: return 'Latest Version';
    }
  }

  // ==========================================
  // Authentication Methods
  // ==========================================

  showLogoutDialog = false;

  onLogout(): void {
    this.showLogoutDialog = true;
  }

  cancelLogout(): void {
    this.showLogoutDialog = false;
  }

  confirmLogout(): void {
    this.showLogoutDialog = false;
    this.authService.logout();
  }

  // [CHANGE] Toggle between role selector mode and JWT mode
  toggleRoleSelectorMode(): void {
    this.isRoleSelectorMode = !this.isRoleSelectorMode;
    localStorage.setItem('useRoleSelector', this.isRoleSelectorMode.toString());
    
    if (this.isRoleSelectorMode) {
      // Switch to role selector mode - navigate to role selector
      console.log('[DASHBOARD] Switching to Role Selector mode');
      this.router.navigate(['/role-selector']);
    } else {
      // Switch to JWT mode - clear role selector data and reload
      console.log('[DASHBOARD] Switching to JWT mode');
      localStorage.removeItem('userRoles');
      localStorage.removeItem('userId');
      localStorage.removeItem('useRoleSelector');
      
      // Reload user data and dashboard
      this.initializeUser();
      this.loadDashboardData(true);
    }
  }

  private initializeTagitAdminFlag(): void {
    try {
      const raw = localStorage.getItem('tagit_user_info');
      if (!raw) {
        this.tagitAdmin = false;
        return;
      }
      const info = JSON.parse(raw);
      const tenantId = (info?.tenant_id || '').toString().trim().toLowerCase();
      const tenantDomain = (info?.tenant_domain || '').toString().trim().toLowerCase();

      const TAGIT_TENANT_ID = '084299bb-875a-4b67-858a-e62c23588242';
      const TAGIT_DOMAIN = 'tagit.net';

      this.tagitAdmin = tenantId === TAGIT_TENANT_ID || tenantDomain === TAGIT_DOMAIN;
    } catch {
      this.tagitAdmin = false;
    }
  }
}
