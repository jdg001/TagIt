import { Component, OnInit, OnDestroy, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { UserManagementService, User, PagedResult, UserCreateRequest, UserUpdateRequest, AssignMultipleRolesRequest, UserSearchFilters, Role } from '../../services/user-management.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

type BannerKind = 'info' | 'success' | 'warning' | 'error';
interface BannerMsg { id: number; text: string; kind: BannerKind; dismissing?: boolean; }

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Input property to receive TagitAdmin flag from parent
  @Input() tagitAdmin: boolean = false;

  // Output event emitter to send users count to parent component
  @Output() usersCountChanged = new EventEmitter<number>();

  // Data
  users: User[] = [];
  allRoles: string[] = [];
  availableRoleIds: { id: number, name: string }[] = [];
  
  // Loading states
  loading = false;
  creating = false;
  updating = false;
  assigning = false;

  // Search and filters
  searchTerm = '';
  selectedRoleFilter = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';

  // Theme
  isDarkMode = true; // Default to dark mode

  // Pagination
  currentPage = 1;
  pageSize = 12;
  totalUsers = 0;

  // Modal states
  showCreateUserModal = false;
  showEditUserModal = false;
  showAssignRolesModal = false;
  showDeleteConfirmDialog = false;

  // Dropdown states
  showRoleDropdown = false;
  showStatusDropdown = false;

  // Form data
  newUser: UserCreateRequest = { tenantId: '', email: '', roleIds: [] };
  editingUser: User | null = null;
  selectedUserForRoles: User | null = null;
  userToDelete: User | null = null;
  
  // TagitAdmin specific: tenant ID input for creating users in other tenants
  tenantIdInput: string = '';

  // Banner messages
  banners: BannerMsg[] = [];
  private _bannerSeq = 0;

  constructor(
    private userManagementService: UserManagementService,
    private authService: AuthService,
    private themeService: ThemeService
  ) { }

  ngOnInit(): void {
    this.initializeTheme();
    this.loadAllRoles();
    this.loadUsers();
  }

  private initializeTheme(): void {
    // Initialize theme from centralized service
    this.isDarkMode = this.themeService.initializeComponentTheme();
    
    // Subscribe to theme changes
    this.themeService.isDarkMode$.subscribe(isDarkMode => {
      this.isDarkMode = isDarkMode;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Banner methods
  showBanner(text: string, kind: BannerKind = 'info', ms = 5000) {
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
  // Data Loading
  // ==========================================

  loadAllRoles(): void {
    this.userManagementService.getAllRoles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles: Role[]) => {
          this.allRoles = roles.map(role => role.roleName);
          this.availableRoleIds = roles.map(role => ({ id: role.roleId, name: role.roleName }));
        },
        error: (error: any) => console.error('Error loading roles:', error)
      });
  }

  loadUsers(): void {
    this.loading = true;
    
    // Get current user info to determine tenant filtering
    const currentUser = this.authService.getUserInfo();
    const isTagitAdmin = this.tagitAdmin;
    
    const filters: UserSearchFilters = {
      search: this.searchTerm,
      roles: this.selectedRoleFilter ? [this.selectedRoleFilter] : [],
      isActive: this.statusFilter === 'active' ? true : (this.statusFilter === 'inactive' ? false : undefined),
      skip: (this.currentPage - 1) * this.pageSize,
      take: this.pageSize
    };

    // Only add tenantId filter if user is NOT a TagIt admin
    // TagIt admins should see all users across all tenants
    if (!isTagitAdmin && currentUser?.tenant_id) {
      filters.tenantId = currentUser.tenant_id;
    }

    this.userManagementService.searchUsers(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (pagedResult: PagedResult<User>) => {
          this.users = pagedResult.items;
          this.totalUsers = pagedResult.total;
          this.loading = false;
          // Emit the users count to parent component
          this.usersCountChanged.emit(this.totalUsers);
        },
        error: (error: any) => {
          console.error('Error loading users:', error);
          this.loading = false;
        }
      });
  }

  // ==========================================
  // Pagination
  // ==========================================

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadUsers();
  }

  onPageClick(page: number | string): void {
    if (typeof page === 'number') {
      this.onPageChange(page);
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalUsers / this.pageSize);
  }

  getVisiblePages(): (number | string)[] {
    const pages: (number | string)[] = [];
    const total = this.totalPages;
    const current = this.currentPage;

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(total);
      } else if (current >= total - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = total - 4; i <= total; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = current - 1; i <= current + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(total);
      }
    }

    return pages;
  }

  getEndRange(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalUsers);
  }

  // ==========================================
  // User Actions
  // ==========================================

  trackByUserId(index: number, user: User): number {
    return user.userId;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  isCurrentUser(user: User): boolean {
    const currentUser = this.authService.getUserInfo();
    if (!currentUser) return false;
    
    // Compare by user ID if available, otherwise fall back to email
    if (currentUser.user_id && user.userId) {
      return currentUser.user_id === user.userId.toString();
    }
    
    // Fallback to email comparison
    return currentUser.email === user.email;
  }

  // ==========================================
  // Create User
  // ==========================================

  private isValidGuid(guid: string): boolean {
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return guidRegex.test(guid);
  }

  openCreateUserModal(): void {
    console.log('Opening create user modal');
    
    if (this.tagitAdmin) {
      // TagitAdmin can create users for any tenant
      this.tenantIdInput = '';
      this.newUser = { 
        tenantId: '', // Will be set from tenantIdInput when form is submitted
        email: '', 
        roleIds: [] 
      };
    } else {
      // Regular admin can only create users for their own tenant
      const userInfo = this.authService.getUserInfo();
      console.log('User info:', userInfo);
      
      // Validate tenant ID format
      const tenantId = userInfo?.tenant_id || '';
      if (!tenantId) {
        console.error('No tenant ID found in user info');
        this.showBanner('Error: No tenant information found. Please log in again.', 'error');
        return;
      }
      
      if (!this.isValidGuid(tenantId)) {
        console.error('Invalid tenant ID format:', tenantId);
        this.showBanner('Error: Invalid tenant information. Please log in again.', 'error');
        return;
      }
      
      // Use the actual tenant ID from the current user's JWT token
      this.newUser = { 
        tenantId: tenantId, // Use actual tenant ID from JWT
        email: '', 
        roleIds: [] 
      };
    }
    
    console.log('New user data:', this.newUser);
    this.showCreateUserModal = true;
  }

  closeCreateUserModal(): void {
    this.showCreateUserModal = false;
  }

  toggleNewUserRole(roleName: string): void {
    const roleId = this.availableRoleIds.find(r => r.name === roleName)?.id;
    if (roleId) {
      const index = this.newUser.roleIds.indexOf(roleId);
      if (index > -1) {
        this.newUser.roleIds.splice(index, 1);
      } else {
        this.newUser.roleIds.push(roleId);
      }
    }
  }

  isNewUserRoleSelected(roleName: string): boolean {
    const roleId = this.availableRoleIds.find(r => r.name === roleName)?.id;
    return roleId ? this.newUser.roleIds.includes(roleId) : false;
  }

  onCreateUserSubmit(): void {
    console.log('Creating user with data:', this.newUser);
    
    // Validate required fields
    if (!this.newUser.email || !this.newUser.email.trim()) {
      this.showBanner('Please enter a valid email address.', 'warning');
      return;
    }
    
    // For TagitAdmin, validate the tenant ID input
    if (this.tagitAdmin) {
      if (!this.tenantIdInput || !this.tenantIdInput.trim()) {
        this.showBanner('Please enter a valid tenant ID.', 'warning');
        return;
      }
      
      if (!this.isValidGuid(this.tenantIdInput)) {
        this.showBanner('Please enter a valid tenant ID format (GUID).', 'warning');
        return;
      }
      
      // Set the tenant ID from the input
      this.newUser.tenantId = this.tenantIdInput.trim();
    } else {
      // For regular admin, validate existing tenant ID
      if (!this.newUser.tenantId || !this.newUser.tenantId.trim()) {
        this.showBanner('Error: No tenant information found. Please log in again.', 'error');
        return;
      }
    }
    
    if (!this.isValidGuid(this.newUser.tenantId)) {
      this.showBanner('Error: Invalid tenant information. Please log in again.', 'error');
      return;
    }
    
    this.creating = true;
    this.userManagementService.createUser(this.newUser)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          console.log('User created successfully:', result);
          this.showBanner('User created successfully!', 'success');
          this.closeCreateUserModal();
          this.loadUsers();
          this.creating = false;
        },
        error: (error) => {
          console.error('Error creating user:', error);
          
          // Parse error message from backend
          let errorMessage = 'Unknown error occurred';
          if (error.error && error.error.message) {
            errorMessage = error.error.message;
          } else if (error.message) {
            errorMessage = error.message;
          } else if (error.status === 400) {
            errorMessage = 'Invalid data provided. Please check your input.';
          } else if (error.status === 403) {
            errorMessage = 'You do not have permission to create users.';
          } else if (error.status === 409) {
            errorMessage = 'A user with this email already exists.';
          }
          
          this.showBanner('Error creating user: ' + errorMessage, 'error');
          this.creating = false;
        }
      });
  }

  // ==========================================
  // Edit User
  // ==========================================

  openEditUserModal(user: User): void {
    this.editingUser = { ...user };
    this.showEditUserModal = true;
  }

  closeEditUserModal(): void {
    this.showEditUserModal = false;
    this.editingUser = null;
  }

  onEditUserSubmit(): void {
    if (!this.editingUser) return;

    this.updating = true;
    const userData: UserUpdateRequest = {
      email: this.editingUser.email,
      isActive: this.editingUser.isActive,
      roleIds: this.editingUser.roles.map(roleName => 
        this.availableRoleIds.find(r => r.name === roleName)?.id || 0
      ).filter(id => id > 0)
    };

    this.userManagementService.updateUser(this.editingUser.userId, userData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeEditUserModal();
          this.loadUsers();
          this.updating = false;
        },
        error: (error) => {
          console.error('Error updating user:', error);
          this.updating = false;
        }
      });
  }

  // ==========================================
  // Delete User
  // ==========================================

  onDeleteUser(user: User): void {
    this.userToDelete = user;
    this.showDeleteConfirmDialog = true;
  }

  confirmDeleteUser(): void {
    if (!this.userToDelete) return;

    this.userManagementService.deleteUser(this.userToDelete.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showBanner(`User "${this.userToDelete!.email}" deleted successfully!`, 'success');
          this.loadUsers();
          this.closeDeleteConfirmDialog();
        },
        error: (error) => {
          console.error('Error deleting user:', error);
          this.showBanner('Error deleting user: ' + (error.error?.message || error.message || 'Unknown error'), 'error');
          this.closeDeleteConfirmDialog();
        }
      });
  }

  closeDeleteConfirmDialog(): void {
    this.showDeleteConfirmDialog = false;
    this.userToDelete = null;
  }

  // ==========================================
  // Toggle User Status
  // ==========================================

  toggleUserStatus(user: User): void {
    if (user.isActive) {
      this.userManagementService.deactivateUser(user.userId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.showBanner(`User "${user.email}" deactivated successfully!`, 'success');
            this.loadUsers();
          },
          error: (error) => {
            console.error('Error deactivating user:', error);
            this.showBanner('Error deactivating user: ' + (error.error?.message || error.message || 'Unknown error'), 'error');
          }
        });
    } else {
      this.userManagementService.activateUser(user.userId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.showBanner(`User "${user.email}" activated successfully!`, 'success');
            this.loadUsers();
          },
          error: (error) => {
            console.error('Error activating user:', error);
            this.showBanner('Error activating user: ' + (error.error?.message || error.message || 'Unknown error'), 'error');
          }
        });
    }
  }

  // ==========================================
  // Assign Roles
  // ==========================================

  openAssignRolesModal(user: User): void {
    console.log('Opening assign roles modal for user:', user);
    console.log('Available roles:', this.allRoles);
    console.log('Available role IDs:', this.availableRoleIds);
    this.selectedUserForRoles = { ...user };
    this.showAssignRolesModal = true;
  }

  closeAssignRolesModal(): void {
    this.showAssignRolesModal = false;
    this.selectedUserForRoles = null;
  }

  isRoleAssigned(roleName: string): boolean {
    return this.selectedUserForRoles?.roles.includes(roleName) || false;
  }

  hasCurrentRoles(): boolean {
    return !!(this.selectedUserForRoles?.roles && this.selectedUserForRoles.roles.length > 0);
  }

  toggleRole(roleName: string): void {
    if (!this.selectedUserForRoles) return;

    console.log('Toggling role:', roleName);
    console.log('Current user roles:', this.selectedUserForRoles.roles);
    console.log('Is role assigned:', this.isRoleAssigned(roleName));

    if (this.isRoleAssigned(roleName)) {
      this.selectedUserForRoles.roles = this.selectedUserForRoles.roles.filter(r => r !== roleName);
      console.log('Removed role. New roles:', this.selectedUserForRoles.roles);
    } else {
      this.selectedUserForRoles.roles.push(roleName);
      console.log('Added role. New roles:', this.selectedUserForRoles.roles);
    }
  }

  saveRoleAssignments(): void {
    if (!this.selectedUserForRoles) return;

    console.log('Saving role assignments for user:', this.selectedUserForRoles.userId);
    console.log('Selected roles:', this.selectedUserForRoles.roles);

    this.assigning = true;
    const roleIds = this.selectedUserForRoles.roles.map(roleName => 
      this.availableRoleIds.find(r => r.name === roleName)?.id || 0
    ).filter(id => id > 0);

    console.log('Mapped role IDs:', roleIds);

    const request: AssignMultipleRolesRequest = {
      roleIds: roleIds
    };

    console.log('Sending request:', request);

    this.userManagementService.assignMultipleRoles(this.selectedUserForRoles.userId, request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log('Roles assigned successfully');
          this.showBanner('Role assignments updated successfully!', 'success');
          this.closeAssignRolesModal();
          this.loadUsers();
          this.assigning = false;
        },
        error: (error) => {
          console.error('Error assigning roles:', error);
          this.showBanner('Error updating role assignments: ' + (error.error?.message || error.message || 'Unknown error'), 'error');
          this.assigning = false;
        }
      });
  }

  // Dropdown methods
  toggleRoleDropdown(): void {
    this.showRoleDropdown = !this.showRoleDropdown;
    if (this.showRoleDropdown) {
      this.showStatusDropdown = false; // Close other dropdown
    }
  }

  toggleStatusDropdown(): void {
    this.showStatusDropdown = !this.showStatusDropdown;
    if (this.showStatusDropdown) {
      this.showRoleDropdown = false; // Close other dropdown
    }
  }

  selectRoleFilter(role: string): void {
    this.selectedRoleFilter = role;
    this.showRoleDropdown = false;
    this.loadUsers();
  }

  selectStatusFilter(status: 'all' | 'active' | 'inactive'): void {
    this.statusFilter = status;
    this.showStatusDropdown = false;
    this.loadUsers();
  }

  getRoleFilterDisplayName(): string {
    if (!this.selectedRoleFilter) {
      return 'All Roles';
    }
    return this.selectedRoleFilter;
  }

  getStatusFilterDisplayName(): string {
    switch (this.statusFilter) {
      case 'all':
        return 'All Statuses';
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      default:
        return 'All Statuses';
    }
  }

  // Close dropdowns when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const roleDropdown = target.closest('.modern-dropdown');
    
    if (!roleDropdown) {
      this.showRoleDropdown = false;
      this.showStatusDropdown = false;
    }
  }
}