import { Component, EventEmitter, Output, ElementRef, ViewChild } from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { ApiConfigService } from '../../services/api-config.service';
import { from, Observable } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

@Component({
    standalone: true,
    selector: 'app-image-import',
    templateUrl: './image-import.component.html',
    styleUrls: ['./image-import.component.scss']
})
export class ImageImportComponent {
  @Output() imageImported = new EventEmitter<{
    src: string;
    name: string;
    width: number;
    height: number;
  }>();
  @Output() closeDialog = new EventEmitter<void>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  isUploading = false;
  uploadProgress = 0;
  errorMessage = '';
  selectedFile: File | null = null;
  previewUrl: string | null = null;

  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      this.errorMessage = '';
      
      // Validate file type
      if (!this.isValidImageFile(this.selectedFile)) {
        this.errorMessage = 'Please select a valid image file (PNG, JPG, JPEG, GIF, WebP)';
        this.selectedFile = null;
        return;
      }

      // Validate file size (max 10MB)
      if (this.selectedFile.size > 10 * 1024 * 1024) {
        this.errorMessage = 'File size must be less than 10MB';
        this.selectedFile = null;
        return;
      }

      // Create preview
      this.createPreview();
    }
  }

  private isValidImageFile(file: File): boolean {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type.toLowerCase());
  }

  private createPreview(): void {
    if (this.selectedFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFile = files[0];
      this.errorMessage = '';
      
      if (!this.isValidImageFile(this.selectedFile)) {
        this.errorMessage = 'Please select a valid image file (PNG, JPG, JPEG, GIF, WebP)';
        this.selectedFile = null;
        return;
      }

      if (this.selectedFile.size > 10 * 1024 * 1024) {
        this.errorMessage = 'File size must be less than 10MB';
        this.selectedFile = null;
        return;
      }

      this.createPreview();
    }
  }

  async uploadImage(): Promise<void> {
    if (!this.selectedFile) {
      this.errorMessage = 'Please select an image file';
      return;
    }

    this.isUploading = true;
    this.uploadProgress = 0;
    this.errorMessage = '';

    try {
      // Convert image to base64 for now (since backend expects base64)
      const base64String = await this.fileToBase64(this.selectedFile);
      
      // Get image dimensions
      const dimensions = await this.getImageDimensions(this.selectedFile);
      
      // Emit the imported image data
      this.imageImported.emit({
        src: base64String,
        name: this.selectedFile.name,
        width: dimensions.width,
        height: dimensions.height
      });

      this.closeDialog.emit();
    } catch (error) {
      console.error('Error uploading image:', error);
      this.errorMessage = 'Failed to process image. Please try again.';
    } finally {
      this.isUploading = false;
      this.uploadProgress = 0;
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  onCancel(): void {
    this.closeDialog.emit();
  }

  onBrowseFiles(): void {
    this.fileInput.nativeElement.click();
  }

  removeSelectedFile(): void {
    this.selectedFile = null;
    this.previewUrl = null;
    this.errorMessage = '';
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }
}
