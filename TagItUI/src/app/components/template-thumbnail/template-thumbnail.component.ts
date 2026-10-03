import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, finalize } from 'rxjs';
import { TemplateThumbnailService } from '../../services/template-thumbnail.service';

@Component({
  selector: 'app-template-thumbnail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './template-thumbnail.component.html',
  styleUrls: ['./template-thumbnail.component.scss']
})
export class TemplateThumbnailComponent implements OnInit, OnDestroy {
  @Input() templateId!: number;
  @Input() templateName: string = '';
  @Input() width: number = 200;
  @Input() height: number = 200;
  @Input() showLoading: boolean = true;
  @Input() lazyLoad: boolean = true;

  thumbnailUrl: string | null = null;
  isLoading: boolean = false;
  hasError: boolean = false;
  errorMessage: string = '';

  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);

  constructor(private thumbnailService: TemplateThumbnailService) {}

  ngOnInit(): void {
    if (this.templateId) {
      this.loadThumbnail();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadThumbnail(): void {
    // Check if thumbnail is already cached
    const cachedUrl = this.thumbnailService.getCachedThumbnailUrl(this.templateId);
    if (cachedUrl) {
      this.thumbnailUrl = cachedUrl;
      this.cdr.detectChanges();
      return;
    }

    // If lazy loading is enabled, don't load immediately
    if (this.lazyLoad) {
      return;
    }

    this.fetchThumbnail();
  }

  onImageLoad(): void {
    this.isLoading = false;
    this.hasError = false;
    this.cdr.detectChanges();
    console.log('Image loaded successfully for template:', this.templateId);
  }

  onImageError(): void {
    this.isLoading = false;
    this.hasError = true;
    this.thumbnailUrl = null;
    this.cdr.detectChanges();
    console.log('Image failed to load for template:', this.templateId);
  }

  onThumbnailClick(): void {
    // Emit event or handle click if needed
    console.log(`Thumbnail clicked for template ${this.templateId}`);
  }

  retryLoad(): void {
    this.hasError = false;
    this.errorMessage = '';
    this.fetchThumbnail();
  }

  private fetchThumbnail(): void {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    this.thumbnailService.getThumbnailUrl(this.templateId)
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (thumbnailData) => {
          this.thumbnailUrl = thumbnailData;
          this.hasError = false;
          this.isLoading = false;
          this.cdr.detectChanges();
          console.log('Thumbnail data received:', thumbnailData?.substring(0, 50) + '...');
          console.log('Full thumbnail URL length:', thumbnailData?.length);
          console.log('Thumbnail URL set to:', this.thumbnailUrl?.substring(0, 100) + '...');
          console.log('Component state - isLoading:', this.isLoading, 'hasError:', this.hasError, 'thumbnailUrl exists:', !!this.thumbnailUrl);
        },
        error: (error) => {
          this.hasError = true;
          this.errorMessage = error.message || 'Failed to load thumbnail';
          this.thumbnailUrl = null;
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  // Method to trigger loading (useful for lazy loading)
  load(): void {
    if (!this.thumbnailUrl && !this.isLoading && !this.hasError) {
      this.fetchThumbnail();
    }
  }

  // Method to refresh thumbnail
  refresh(): void {
    this.thumbnailUrl = null;
    this.hasError = false;
    this.errorMessage = '';
    this.fetchThumbnail();
  }
}
