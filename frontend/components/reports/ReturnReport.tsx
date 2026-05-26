'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RotateCcw, DollarSign, CreditCard, Clock, Download } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/formatting';
import ExportDialog from './ExportDialog';
import { api } from '@/utils/api';
import type { ReportFilters } from '@/types';

interface ReturnReportProps {
  filters: ReportFilters;
}

interface ReturnData {
  return_number: string;
  return_date: string;
  order_number: string;
  customer_email: string;
  customer_name: string;
  return_reason: string;
  status: string;
  total_amount: number;
  credit_amount: number;
  refund_amount: number;
  items_count: number;
  processed_by: string;
  processing_time_days: number;
}

interface ReturnSummary {
  total_returns: number;
  total_return_value: number;
  total_credits_issued: number;
  total_refunds_issued: number;
  avg_return_value: number;
  status_distribution: Record<string, number>;
  top_return_reasons: Array<{ return_reason: string; count: number }>;
}

/**
 * Return report component with reason analysis and trends.
 * 
 * Implements Requirements 9.4: Return reports with reason analysis and trends.
 */
export default function ReturnReport({ filters }: ReturnReportProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReturnData[]>([]);
  const [summary, setSummary] = useState<ReturnSummary | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  useEffect(() => {
    fetchReturnReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchReturnReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params[key] = value.toString();
        }
      });

      const result = await api.get('/api/v1/reports/returns/', params);
      setData(result.data);
      setSummary(result.summary);
      setTotalRecords(result.total_records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getReturnStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PROCESSED':
        return 'default';
      case 'APPROVED':
        return 'secondary';
      case 'PENDING':
        return 'outline';
      case 'REJECTED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getProcessingTimeColor = (days: number) => {
    if (days <= 1) return 'text-green-600';
    if (days <= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading return report...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600 mb-4">Error loading return report: {error}</p>
        <Button onClick={fetchReturnReport}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Returns</p>
                  <p className="text-2xl font-bold">{summary.total_returns.toLocaleString()}</p>
                </div>
                <RotateCcw className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Return Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_return_value)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Credits Issued</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_credits_issued)}</p>
                </div>
                <CreditCard className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Refunds Issued</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_refunds_issued)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Return Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.avg_return_value)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Distribution and Return Reasons */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Return Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(summary.status_distribution).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Badge variant={getReturnStatusBadgeVariant(status)}>
                        {status}
                      </Badge>
                    </div>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Return Reasons</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary.top_return_reasons.slice(0, 5).map((reason, index) => (
                  <div key={reason.return_reason} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                        {index + 1}
                      </div>
                      <span className="font-medium">{reason.return_reason}</span>
                    </div>
                    <span className="font-medium">{reason.count}</span>
                  </div>
                ))}
                {summary.top_return_reasons.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No return reasons data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Return Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Return Details ({totalRecords} records)</CardTitle>
            <Button
              onClick={() => setShowExportDialog(true)}
              className="flex items-center space-x-2"
              variant="outline"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No return data found for the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Return #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Credit</TableHead>
                    <TableHead>Refund</TableHead>
                    <TableHead>Processing Time</TableHead>
                    <TableHead>Processed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((returnItem) => (
                    <TableRow key={returnItem.return_number}>
                      <TableCell className="font-medium">{returnItem.return_number}</TableCell>
                      <TableCell>{formatDate(returnItem.return_date)}</TableCell>
                      <TableCell className="font-mono text-sm">{returnItem.order_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{returnItem.customer_name}</p>
                          <p className="text-sm text-gray-500">{returnItem.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-32">
                          <p className="text-sm truncate" title={returnItem.return_reason}>
                            {returnItem.return_reason}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getReturnStatusBadgeVariant(returnItem.status)}>
                          {returnItem.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{returnItem.items_count}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(returnItem.total_amount)}
                      </TableCell>
                      <TableCell>
                        <span className="text-green-600 font-medium">
                          {formatCurrency(returnItem.credit_amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-blue-600 font-medium">
                          {formatCurrency(returnItem.refund_amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className={`text-sm font-medium ${getProcessingTimeColor(returnItem.processing_time_days)}`}>
                            {returnItem.processing_time_days} days
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{returnItem.processed_by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Return Trends Analysis */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Return Analysis Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Average Processing Time</h4>
                <p className="text-2xl font-bold text-blue-600">
                  {(data.reduce((sum, item) => sum + item.processing_time_days, 0) / data.length).toFixed(1)} days
                </p>
              </div>

              <div className="text-center p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">Credit vs Refund Ratio</h4>
                <p className="text-2xl font-bold text-green-600">
                  {summary ? (
                    summary.total_credits_issued > 0
                      ? `${((summary.total_credits_issued / (summary.total_credits_issued + summary.total_refunds_issued)) * 100).toFixed(0)}% Credits`
                      : '0% Credits'
                  ) : 'N/A'}
                </p>
              </div>

              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <h4 className="font-medium text-orange-900 mb-2">Return Rate Impact</h4>
                <p className="text-2xl font-bold text-orange-600">
                  {summary ? `${formatCurrency(summary.total_return_value)}` : 'N/A'}
                </p>
                <p className="text-sm text-orange-700">Total Value Returned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        reportType="returns"
        reportData={{
          total_records: totalRecords,
          filters_applied: filters
        }}
      />
    </div>
  );
}