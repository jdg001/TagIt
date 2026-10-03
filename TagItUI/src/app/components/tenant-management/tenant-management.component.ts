import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TenantManagementService, Tenant, PagedResult, TenantCreateRequest, TenantUpdateRequest, TenantSearchFilters } from '../../services/tenant-management.service';
import { ThemeService } from '../../services/theme.service';

type BannerKind = 'info' | 'success' | 'warning' | 'error';
interface BannerMsg { id: number; text: string; kind: BannerKind; dismissing?: boolean; }

@Component({
  selector: 'app-tenant-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tenant-management.component.html',
  styleUrls: ['./tenant-management.component.scss']
})
export class TenantManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Output event emitter to send tenants count to parent component
  @Output() tenantsCountChanged = new EventEmitter<number>();

  // Data
  tenants: Tenant[] = [];
  
  // Loading states
  loading = false;
  creating = false;
  updating = false;

  // Search
  searchTerm = '';

  // Theme
  isDarkMode = true; // Default to dark mode

  // Pagination
  currentPage = 1;
  pageSize = 12;
  totalTenants = 0;

  // Modal states
  showCreateTenantModal = false;
  showEditTenantModal = false;
  showDeleteConfirmDialog = false;

  // Form data
  newTenant: TenantCreateRequest = { name: '', domain: '', isActive: true };
  editingTenant: Tenant | null = null;
  tenantToDelete: Tenant | null = null;

  // Banner messages
  banners: BannerMsg[] = [];
  private _bannerSeq = 0;

  constructor(
    private tenantManagementService: TenantManagementService,
    private themeService: ThemeService
  ) { }

  ngOnInit(): void {
    this.initializeTheme();
    this.loadTenants();
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

  loadTenants(): void {
    this.loading = true;
    const filters: TenantSearchFilters = {
      search: this.searchTerm,
      skip: (this.currentPage - 1) * this.pageSize,
      take: this.pageSize
    };

    this.tenantManagementService.searchTenants(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (pagedResult: PagedResult<Tenant>) => {
          this.tenants = pagedResult.items;
          this.totalTenants = pagedResult.total;
          this.loading = false;
          this.tenantsCountChanged.emit(this.totalTenants);
        },
        error: (error: any) => {
          console.error('Error loading tenants:', error);
          this.loading = false;
        }
      });
  }

  // ==========================================
  // Pagination
  // ==========================================

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadTenants();
  }

  onPageClick(page: number | string): void {
    if (typeof page === 'number') {
      this.onPageChange(page);
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalTenants / this.pageSize);
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
    return Math.min(this.currentPage * this.pageSize, this.totalTenants);
  }

  // ==========================================
  // Tenant Actions
  // ==========================================

  trackByTenantId(index: number, tenant: Tenant): string {
    return tenant.tenantId;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  // ==========================================
  // Create Tenant
  // ==========================================

  openCreateTenantModal(): void {
    console.log('Opening create tenant modal');
    this.newTenant = { name: '', domain: '', isActive: true };
    this.showCreateTenantModal = true;
  }

  closeCreateTenantModal(): void {
    this.showCreateTenantModal = false;
  }

  onCreateTenantSubmit(): void {
    console.log('Creating tenant with data:', this.newTenant);
    
    // Validate required fields
    if (!this.newTenant.name || !this.newTenant.name.trim()) {
      this.showBanner('Please enter a valid tenant name.', 'warning');
      return;
    }
    
    if (!this.newTenant.domain || !this.newTenant.domain.trim()) {
      this.showBanner('Please enter a valid domain.', 'warning');
      return;
    }
    
    this.creating = true;
    this.tenantManagementService.createTenant(this.newTenant)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          console.log('Tenant created successfully:', result);
          this.showBanner('Tenant created successfully!', 'success');
          this.closeCreateTenantModal();
          this.loadTenants();
          this.creating = false;
        },
        error: (error) => {
          console.error('Error creating tenant:', error);
          
          // Parse error message from backend
          let errorMessage = 'Unknown error occurred';
          if (error.error && error.error.message) {
            errorMessage = error.error.message;
          } else if (error.message) {
            errorMessage = error.message;
          } else if (error.status === 400) {
            errorMessage = 'Invalid data provided. Please check your input.';
          } else if (error.status === 403) {
            errorMessage = 'You do not have permission to create tenants.';
          } else if (error.status === 409) {
            errorMessage = 'A tenant with this domain already exists.';
          }
          
          this.showBanner('Error creating tenant: ' + errorMessage, 'error');
          this.creating = false;
        }
      });
  }

  // ==========================================
  // Edit Tenant
  // ==========================================

  openEditTenantModal(tenant: Tenant): void {
    // Prevent editing the TagIt tenant
    if (tenant.name === 'TagIt') {
      this.showBanner('Cannot edit the TagIt tenant.', 'warning');
      return;
    }
    this.editingTenant = { ...tenant };
    this.showEditTenantModal = true;
  }

  closeEditTenantModal(): void {
    this.showEditTenantModal = false;
    this.editingTenant = null;
  }

  onEditTenantSubmit(): void {
    if (!this.editingTenant) return;

    this.updating = true;
    const tenantData: TenantUpdateRequest = {
      name: this.editingTenant.name,
      domain: this.editingTenant.domain,
      isActive: this.editingTenant.isActive
    };

    this.tenantManagementService.updateTenant(this.editingTenant.tenantId, tenantData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeEditTenantModal();
          this.loadTenants();
          this.updating = false;
        },
        error: (error) => {
          console.error('Error updating tenant:', error);
          this.showBanner('Error updating tenant: ' + (error.error?.message || error.message || 'Unknown error'), 'error');
          this.updating = false;
        }
      });
  }

  // ==========================================
  // Delete Tenant
  // ==========================================

  onDeleteTenant(tenant: Tenant): void {
    // Prevent deleting the TagIt tenant
    if (tenant.name === 'TagIt') {
      this.showBanner('Cannot delete the TagIt tenant.', 'warning');
      return;
    }
    this.tenantToDelete = tenant;
    this.showDeleteConfirmDialog = true;
  }

  confirmDeleteTenant(): void {
    if (!this.tenantToDelete) return;

    this.tenantManagementService.deleteTenant(this.tenantToDelete.tenantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showBanner(`Tenant "${this.tenantToDelete!.name}" deleted successfully!`, 'success');
          this.loadTenants();
          this.closeDeleteConfirmDialog();
        },
        error: (error) => {
          console.error('Error deleting tenant:', error);
          this.showBanner('Error deleting tenant: ' + (error.error?.message || error.message || 'Unknown error'), 'error');
          this.closeDeleteConfirmDialog();
        }
      });
  }

  closeDeleteConfirmDialog(): void {
    this.showDeleteConfirmDialog = false;
    this.tenantToDelete = null;
  }

  // ==========================================
  // Remove toggleTenantStatus and status dropdown handlers
}
