/**
 * Export utilities for handling file downloads and export operations.
 * 
 * Implements Requirements 9.5: Multi-format report export utilities.
 */

export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv' | 'json';
  filename?: string;
  reportType: string;
  filters?: Record<string, unknown>;
}

export interface BulkExportRequest {
  type: string;
  format: string;
  filters?: Record<string, unknown>;
}

export interface ExportProgress {
  export_id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  message?: string;
  started_at?: string;
  completed_at?: string;
}

/**
 * Download a file from a blob response
 */
export const downloadFile = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Get the appropriate file extension for export format
 */
export const getFileExtension = (format: string): string => {
  const extensions: Record<string, string> = {
    pdf: 'pdf',
    excel: 'xlsx',
    csv: 'csv',
    json: 'json'
  };
  return extensions[format] || 'txt';
};

/**
 * Generate a filename for export
 */
export const generateExportFilename = (reportType: string, format: string): string => {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  const extension = getFileExtension(format);
  return `${reportType}_report_${timestamp}.${extension}`;
};

/**
 * Get content type for export format
 */
export const getContentType = (format: string): string => {
  const contentTypes: Record<string, string> = {
    pdf: 'application/pdf',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    json: 'application/json'
  };
  return contentTypes[format] || 'application/octet-stream';
};

/**
 * Format export parameters for API request
 */
export const formatExportParams = (options: ExportOptions): Record<string, unknown> => {
  const params: Record<string, unknown> = {
    format: options.format
  };

  if (options.filters) {
    Object.assign(params, options.filters);
  }

  return params;
};

/**
 * Validate export format
 */
export const isValidExportFormat = (format: string): boolean => {
  const validFormats = ['pdf', 'excel', 'csv', 'json'];
  return validFormats.includes(format.toLowerCase());
};

/**
 * Validate report type
 */
export const isValidReportType = (reportType: string): boolean => {
  const validTypes = ['sales', 'inventory', 'customer', 'returns'];
  return validTypes.includes(reportType.toLowerCase());
};

/**
 * Get human-readable format name
 */
export const getFormatDisplayName = (format: string): string => {
  const displayNames: Record<string, string> = {
    pdf: 'PDF Document',
    excel: 'Excel Spreadsheet',
    csv: 'CSV File',
    json: 'JSON Data'
  };
  return displayNames[format] || format.toUpperCase();
};

/**
 * Get format icon class (for UI display)
 */
export const getFormatIcon = (format: string): string => {
  const icons: Record<string, string> = {
    pdf: 'file-pdf',
    excel: 'file-excel',
    csv: 'file-csv',
    json: 'file-code'
  };
  return icons[format] || 'file';
};

/**
 * Estimate file size based on data and format
 */
export const estimateFileSize = (recordCount: number, format: string): string => {
  // Rough estimates in KB
  const baseSizes: Record<string, number> = {
    csv: recordCount * 0.5,
    json: recordCount * 1.2,
    excel: recordCount * 2.0,
    pdf: recordCount * 3.0
  };

  const sizeKB = baseSizes[format] || recordCount;

  if (sizeKB < 1024) {
    return `${Math.round(sizeKB)} KB`;
  } else {
    return `${Math.round(sizeKB / 1024 * 10) / 10} MB`;
  }
};

/**
 * Create export progress tracker
 */
export class ExportProgressTracker {
  private intervalId: NodeJS.Timeout | null = null;
  private onProgress: (progress: ExportProgress) => void;
  private onComplete: (result: any) => void;
  private onError: (error: string) => void;

  constructor(
    onProgress: (progress: ExportProgress) => void,
    onComplete: (result: unknown) => void,
    onError: (error: string) => void
  ) {
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;
  }

  start(exportId: string, checkInterval: number = 1000): void {
    this.intervalId = setInterval(async () => {
      try {
        // In a real implementation, this would call the progress API
        // For now, simulate progress
        const mockProgress: ExportProgress = {
          export_id: exportId,
          status: 'COMPLETED',
          progress: 100,
          message: 'Export completed successfully'
        };

        this.onProgress(mockProgress);

        if (mockProgress.status === 'COMPLETED' || mockProgress.status === 'FAILED') {
          this.stop();
          if (mockProgress.status === 'COMPLETED') {
            this.onComplete(mockProgress);
          } else {
            this.onError(mockProgress.message || 'Export failed');
          }
        }
      } catch (error) {
        this.stop();
        this.onError(error instanceof Error ? error.message : 'Unknown error');
      }
    }, checkInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

/**
 * Export format configurations
 */
export const EXPORT_FORMATS = [
  {
    value: 'pdf',
    label: 'PDF Document',
    description: 'Professional formatted document with charts and summaries',
    icon: 'file-pdf',
    color: 'text-red-600'
  },
  {
    value: 'excel',
    label: 'Excel Spreadsheet',
    description: 'Formatted spreadsheet with multiple sheets and charts',
    icon: 'file-excel',
    color: 'text-green-600'
  },
  {
    value: 'csv',
    label: 'CSV File',
    description: 'Comma-separated values for data analysis',
    icon: 'file-csv',
    color: 'text-blue-600'
  },
  {
    value: 'json',
    label: 'JSON Data',
    description: 'Structured data format for API integration',
    icon: 'file-code',
    color: 'text-purple-600'
  }
] as const;

export type ExportFormat = typeof EXPORT_FORMATS[number]['value'];