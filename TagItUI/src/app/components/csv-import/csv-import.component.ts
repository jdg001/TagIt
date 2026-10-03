import { Component, EventEmitter, Output, Input } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ExcelParserService, ExcelData } from '../../services/excel-parser.service';
import { PdfGenerationService } from '../../services/pdf-generation.service';

export interface CsvImportData {
  headers: string[];
  rows: { [key: string]: string }[];
  fileType: 'csv' | 'excel';
  sheetName?: string;
}

@Component({
    standalone: true,
    selector: 'app-csv-import',
    imports: [FormsModule],
    templateUrl: './csv-import.component.html',
    styleUrls: ['./csv-import.component.scss']
})
export class CsvImportComponent {
  @Input() set templateId(value: number | null) {
    this._templateId = value;
  }
  @Input() notify?: (
    text: string,
    kind?: 'info' | 'success' | 'warning' | 'error',
    ms?: number
  ) => void;

  get templateId(): number | null {
    return this._templateId;
  }
  private _templateId: number | null = null;

  @Output() csvDataImported = new EventEmitter<CsvImportData>();
  @Output() importCancelled = new EventEmitter<void>();
  @Output() bulkPdfGenerated = new EventEmitter<Blob>();

  csvFile: File | null = null;
  csvContent: string = '';
  parsedData: CsvImportData | null = null;
  isProcessing = false;
  errorMessage = '';
  successMessage = '';
  availableSheets: string[] = [];
  selectedSheet: string = '';
  fileType: 'csv' | 'excel' | null = null;

  // Pagination properties
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 0;

  // Row selection properties
  selectedRows: Set<number> = new Set<number>();
  selectAll: boolean = false;

  isDragOver = false;
  hasUploaded = false;

  constructor(
    private excelParserService: ExcelParserService,
    private pdfService: PdfGenerationService
  ) {}

  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      // Determine file type
      const isCsv = file.type === 'text/csv' || file.name.endsWith('.csv');
      this.hasUploaded = true;
      const isExcel =
        file.type ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls');

      if (!isCsv && !isExcel) {
        this.errorMessage =
          'Please select a valid CSV or Excel file (.csv, .xlsx, .xls).';
        return;
      }

      this.csvFile = file;
      this.fileType = isCsv ? 'csv' : 'excel';

      if (isCsv) {
        this.parseCsvFile(file);
      } else {
        this.parseExcelFile(file);
      }
    }
  }

  private parseCsvFile(file: File) {
    this.isProcessing = true;
    this.errorMessage = '';

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        this.csvContent = e.target?.result as string;
        this.parsedData = this.parseCsvContent(this.csvContent);
        this.selectAllRowsByDefault();
        this.updatePagination();
        this.isProcessing = false;
      } catch (error) {
        this.errorMessage =
          'Error parsing CSV file. Please check the file format.';
        this.isProcessing = false;
      }
    };

    reader.onerror = () => {
      this.errorMessage = 'Error reading file.';
      this.isProcessing = false;
    };

    reader.readAsText(file);
  }

  private parseExcelFile(file: File) {
    this.isProcessing = true;
    this.errorMessage = '';

    // First get available sheets
    this.excelParserService
      .getSheetNames(file)
      .then((sheetNames: string[]) => {
        this.availableSheets = sheetNames;

        if (sheetNames.length === 1) {
          // If only one sheet, parse it directly
          this.selectedSheet = sheetNames[0];
          this.parseSelectedSheet();
        } else {
          // Multiple sheets, let user choose
          this.isProcessing = false;
        }
      })
      .catch((error) => {
        this.errorMessage = error.message || 'Error reading Excel file.';
        this.isProcessing = false;
      });
  }

  onSheetSelectionChange() {
    if (this.csvFile && this.selectedSheet) {
      this.parseSelectedSheet();
    }
  }

  private parseSelectedSheet() {
    if (!this.csvFile || !this.selectedSheet) return;

    this.isProcessing = true;
    this.errorMessage = '';

    this.excelParserService
      .parseExcelSheet(this.csvFile, this.selectedSheet)
      .then((excelData: ExcelData) => {
        this.parsedData = {
          headers: excelData.headers,
          rows: excelData.rows,
          fileType: 'excel',
          sheetName: excelData.sheetName,
        };
        this.selectAllRowsByDefault();
        this.updatePagination();
        this.isProcessing = false;
      })
      .catch((error) => {
        this.errorMessage = error.message || 'Error parsing Excel sheet.';
        this.isProcessing = false;
      });
  }

  private parseCsvContent(content: string): CsvImportData {
    const lines = content.split('\n').filter((line) => line.trim() !== '');

    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse headers
    const headers = this.parseCsvLine(lines[0]);

    // Parse data rows
    const rows: { [key: string]: string }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      if (values.length === headers.length) {
        const row: { [key: string]: string } = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }
    }

    return {
      headers,
      rows,
      fileType: 'csv',
    };
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  onImportData() {
    if (this.parsedData) {
      this.csvDataImported.emit(this.parsedData);
    }
  }

  onGenerateBulkPDF() {
    if (!this.csvFile) {
      this.errorMessage = 'Please import a CSV or Excel file first.'; // keeps dialog hint
      this.notify?.('Please import a CSV or Excel file first.', 'warning');
      return;
    }

    if (!this.templateId) {
      this.errorMessage =
        'No template is loaded. Please save your template first before generating bulk PDFs.';
      this.notify?.(
        'No template is loaded. Please save your template first before generating bulk PDFs.',
        'warning',
        4500
      );
      return;
    }

    // Check if any rows are selected
    if (this.selectedRows.size === 0) {
      this.errorMessage = 'Please select at least one row to generate PDFs.';
      this.notify?.(
        'Please select at least one row to generate PDFs.',
        'warning'
      );
      return;
    }

    this.isProcessing = true;

    // Convert selected rows to array of indices
    const selectedRowIndices = Array.from(this.selectedRows).sort(
      (a, b) => a - b
    );

    // Use the new backend CSV API
    this.pdfService
      .generatePdfFromCsv(this.templateId, this.csvFile, selectedRowIndices)
      .subscribe({
        next: (pdfBlob) => {
          this.isProcessing = false;
          this.successMessage =
            this.selectedRows.size === 1
              ? 'PDF generated successfully!'
              : 'PDFs generated successfully!';
          this.errorMessage = '';
          this.bulkPdfGenerated.emit(pdfBlob);

          // Download the generated file
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename =
            this.selectedRows.size === 1
              ? `label-${timestamp}.pdf`
              : `bulk-labels-${timestamp}.zip`;
          this.downloadPdf(pdfBlob, filename);

          // Clear success message after 3 seconds
          setTimeout(() => {
            this.successMessage = '';
          }, 3000);
        },
        error: (error) => {
          this.isProcessing = false;
          alert(`PDF generation failed: ${error.message || 'Unknown error'}`);
        },
      });
  }

  private downloadPdf(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  onCancel() {
    this.importCancelled.emit();
  }

  onReset() {
    this.csvFile = null;
    this.csvContent = '';
    this.parsedData = null;
    this.errorMessage = '';
    this.successMessage = '';
    this.availableSheets = [];
    this.selectedSheet = '';
    this.fileType = null;

    // Reset pagination
    this.currentPage = 1;
    this.totalPages = 0;

    // Reset file input
    this.resetFileInput();

    // Reset row selection
    this.selectedRows.clear();
    this.selectAll = false;

    this.hasUploaded = false;
  }

  // Row selection methods
  toggleRowSelection(rowIndex: number) {
    if (this.selectedRows.has(rowIndex)) {
      this.selectedRows.delete(rowIndex);
    } else {
      this.selectedRows.add(rowIndex);
    }
    this.updateSelectAllState();
  }

  toggleSelectAll() {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      // Select all rows on current page
      this.selectedRows = new Set<number>(
      Array.from({ length: this.getTotalRows() }, (_, i) => i)
    );
    } else {
      // Deselect all rows on current page
      this.selectedRows.clear();
    }
  }

  updateSelectAllState() {
    if (!this.parsedData) {
      this.selectAll = false;
      return;
    }

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = Math.min(
      startIndex + this.itemsPerPage,
      this.getTotalRows()
    );
    let allSelected = true;

    for (let i = startIndex; i < endIndex; i++) {
      if (!this.selectedRows.has(i)) {
        allSelected = false;
        break;
      }
    }

    this.selectAll = allSelected;
  }

  isRowSelected(rowIndex: number): boolean {
    return this.selectedRows.has(rowIndex);
  }

  getSelectedRowsCount(): number {
    return this.selectedRows.size;
  }

  getSelectedRowsData(): { [key: string]: any }[] {
    if (!this.parsedData) return [];

    return Array.from(this.selectedRows)
      .sort((a, b) => a - b)
      .map((index) => {
        const data: { [key: string]: any } = {};
        this.parsedData!.headers.forEach((header) => {
          data[header] = this.parsedData!.rows[index][header] || '';
        });
        return data;
      });
  }

  private resetFileInput() {
    const fileInput = document.getElementById(
      'csv-file-input'
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  onFileUploadClick() {
    const fileInput = document.getElementById(
      'csv-file-input'
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  // Pagination methods
  getCurrentPageData(): { [key: string]: string }[] {
    if (!this.parsedData) return [];

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.parsedData.rows.slice(startIndex, endIndex);
  }

  getCurrentPageStartIndex(): number {
    return (this.currentPage - 1) * this.itemsPerPage;
  }

  getTotalRows(): number {
    return this.parsedData ? this.parsedData.rows.length : 0;
  }

  updatePagination() {
    if (this.parsedData) {
      this.totalPages = Math.ceil(
        this.parsedData.rows.length / this.itemsPerPage
      );
      this.currentPage = 1; // Reset to first page when data changes
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  goToFirstPage() {
    this.currentPage = 1;
  }

  goToLastPage() {
    this.currentPage = this.totalPages;
  }

  goToPreviousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  goToNextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    const startPage = Math.max(
      1,
      this.currentPage - Math.floor(maxVisiblePages / 2)
    );
    const endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  onItemsPerPageChange() {
    this.updatePagination();
  }

  // Helper method for template
  getMathMin(a: number, b: number): number {
    return Math.min(a, b);
  }

  // Select all rows by default when data is imported
  private selectAllRowsByDefault() {
    if (this.parsedData && this.parsedData.rows.length > 0) {
      this.selectedRows.clear();
      for (let i = 0; i < this.parsedData.rows.length; i++) {
        this.selectedRows.add(i);
      }
      this.selectAll = true;
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault(); // allow drop
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;

    if (event.dataTransfer?.files?.length) {
      const file = event.dataTransfer.files[0];
      this.onFileSelected({ target: { files: [file] } } as any);
      this.hasUploaded = true;
    }
  }
}
