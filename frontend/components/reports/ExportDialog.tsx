/**
 * Enhanced export dialog component for reports.
 * 
 * Implements Requirements 9.5: Multi-format report export interface.
 */

'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { reportApi } from '@/utils/api';
import {
  downloadFile,
  generateExportFilename,
  estimateFileSize,
  EXPORT_FORMATS,
  type ExportFormat
} from '@/utils/exportUtils';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: string;
  reportData?: {
    total_records: number;
    filters_applied?: Record<string, unknown>;
  };
}

interface ExportJob {
  id: string;
  format: ExportFormat;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  filename?: string;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

export default function ExportDialog({
  isOpen,
  onClose,
  reportType,
  reportData
}: ExportDialogProps) {
  const [selectedFormats, setSelectedFormats] = useState<ExportFormat[]>([]);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const handleFormatToggle = (format: ExportFormat) => {
    setSelectedFormats(prev =>
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  const handleExport = async () => {
    if (selectedFormats.length === 0) return;

    setIsExporting(true);

    // Create export jobs
    const jobs: ExportJob[] = selectedFormats.map(format => ({
      id: `${reportType}_${format}_${Date.now()}`,
      format,
      status: 'pending',
      progress: 0,
      startTime: new Date()
    }));

    setExportJobs(jobs);

    // Process exports sequentially
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      if (!job) continue; // Safety check

      try {
        // Update job status to processing
        setExportJobs(prev => prev.map(j =>
          j.id === job.id
            ? { ...j, status: 'processing', progress: 25 }
            : j
        ));

        // Prepare export parameters
        const params = {
          format: job.format,
          ...reportData?.filters_applied
        };

        // Call export API
        const response = await reportApi.export(reportType, params);

        // Update progress
        setExportJobs(prev => prev.map(j =>
          j.id === job.id
            ? { ...j, progress: 75 }
            : j
        ));

        // Generate filename and download
        const filename = generateExportFilename(reportType, job.format);
        downloadFile(response.data, filename);

        // Mark as completed
        setExportJobs(prev => prev.map(j =>
          j.id === job.id
            ? {
              ...j,
              status: 'completed',
              progress: 100,
              filename,
              endTime: new Date()
            }
            : j
        ));

      } catch (error) {
        console.error(`Export failed for ${job.format}:`, error);

        // Mark as failed
        setExportJobs(prev => prev.map(j =>
          j.id === job.id
            ? {
              ...j,
              status: 'failed',
              progress: 0,
              error: error instanceof Error ? error.message : 'Export failed',
              endTime: new Date()
            }
            : j
        ));
      }
    }

    setIsExporting(false);
  };

  const handleClose = () => {
    if (!isExporting) {
      setSelectedFormats([]);
      setExportJobs([]);
      onClose();
    }
  };

  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-600" />;
      case 'excel':
        return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
      case 'csv':
        return <FileText className="h-5 w-5 text-blue-600" />;
      case 'json':
        return <FileText className="h-5 w-5 text-purple-600" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getStatusIcon = (status: ExportJob['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-500" />;
      case 'processing':
        return <AlertCircle className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const completedJobs = exportJobs.filter(job => job.status === 'completed').length;
  const totalJobs = exportJobs.length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export {reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Report Info */}
          {reportData && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>Total Records: {reportData.total_records.toLocaleString()}</span>
                <span>Report Type: {reportType.toUpperCase()}</span>
              </div>
            </div>
          )}

          {/* Format Selection */}
          {exportJobs.length === 0 && (
            <div>
              <h3 className="text-lg font-medium mb-4">Select Export Formats</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {EXPORT_FORMATS.map((format) => (
                  <div
                    key={format.value}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${selectedFormats.includes(format.value)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                    onClick={() => handleFormatToggle(format.value)}
                  >
                    <div className="flex items-start space-x-3">
                      {getFormatIcon(format.value)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{format.label}</h4>
                          {selectedFormats.includes(format.value) && (
                            <Badge variant="secondary">Selected</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {format.description}
                        </p>
                        {reportData && (
                          <p className="text-xs text-gray-500 mt-2">
                            Estimated size: {estimateFileSize(reportData.total_records, format.value)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export Progress */}
          {exportJobs.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Export Progress</h3>
                <Badge variant={completedJobs === totalJobs ? "default" : "secondary"}>
                  {completedJobs}/{totalJobs} Complete
                </Badge>
              </div>

              <div className="space-y-3">
                {exportJobs.map((job) => (
                  <div key={job.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        {getFormatIcon(job.format)}
                        <span className="font-medium">
                          {EXPORT_FORMATS.find(f => f.value === job.format)?.label}
                        </span>
                        {getStatusIcon(job.status)}
                      </div>
                      <Badge
                        variant={
                          job.status === 'completed' ? 'default' :
                            job.status === 'failed' ? 'destructive' :
                              'secondary'
                        }
                      >
                        {job.status.toUpperCase()}
                      </Badge>
                    </div>

                    {job.status === 'processing' && (
                      <Progress value={job.progress} className="mb-2" />
                    )}

                    {job.error && (
                      <p className="text-sm text-red-600 mt-2">{job.error}</p>
                    )}

                    {job.filename && job.status === 'completed' && (
                      <p className="text-sm text-green-600 mt-2">
                        Downloaded: {job.filename}
                      </p>
                    )}

                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>Started: {job.startTime.toLocaleTimeString()}</span>
                      {job.endTime && (
                        <span>
                          Duration: {Math.round((job.endTime.getTime() - job.startTime.getTime()) / 1000)}s
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isExporting}
            >
              {exportJobs.length > 0 ? 'Close' : 'Cancel'}
            </Button>

            {exportJobs.length === 0 && (
              <Button
                onClick={handleExport}
                disabled={selectedFormats.length === 0 || isExporting}
                className="flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Export {selectedFormats.length} Format{selectedFormats.length !== 1 ? 's' : ''}</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}