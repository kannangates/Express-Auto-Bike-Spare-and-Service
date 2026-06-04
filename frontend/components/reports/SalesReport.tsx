'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp, DollarSign, ShoppingCart, Users, Download } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/formatting';
import ExportDialog from './ExportDialog';
import { api } from '@/utils/api';
import type { ReportFilters } from '@/types';

interface SalesReportProps {
  filters: ReportFilters;
}

interface SalesData {
  order_number: string;
  order_date: string;
  customer_email: string;
  customer_name: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  items_count: number;
  created_by: string;
}

interface SalesSummary {
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  total_tax: number;
  total_discounts: number;
  status_distribution: Record<string, number>;
}

/**
 * Sales report component with detailed sales analysis.
 * 
 * Implements Requirements 9.1: Sales reports with date filtering and customer analysis.
 * Implements Requirements 9.5: Multi-format report export functionality.
 */
export default function SalesReport({ filters }: SalesReportProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SalesData[]>([]);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  useEffect(() => {
    fetchSalesReport();
  // Use entire filters object so any field added via the index signature also triggers refetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchSalesReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params[key] = value.toString();
        }
      });

      const result = await api.get('/api/v1/reports/sales/', params);
      setData(result.data);
      setSummary(result.summary);
      setTotalRecords(result.total_records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'default';
      case 'PROCESSING':
        return 'secondary';
      case 'PENDING':
        return 'outline';
      case 'CANCELLED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getPaymentStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'default';
      case 'PENDING':
        return 'secondary';
      case 'FAILED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading sales report...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600 mb-4">Error loading sales report: {error}</p>
        <Button onClick={fetchSalesReport}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold">{summary.total_orders.toLocaleString()}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_revenue)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.avg_order_value)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tax</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_tax)}</p>
                </div>
                <Users className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Distribution */}
      {summary && Object.keys(summary.status_distribution).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Order Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.status_distribution).map(([status, count]) => (
                <Badge key={status} variant="outline" className="px-3 py-1">
                  {status}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sales Details ({totalRecords} records)</CardTitle>
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
              <p className="text-gray-500">No sales data found for the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((order) => (
                    <TableRow key={order.order_number}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{formatDate(order.order_date)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.customer_name}</p>
                          <p className="text-sm text-gray-500">{order.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(order.status)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.items_count}</TableCell>
                      <TableCell>{formatCurrency(order.subtotal)}</TableCell>
                      <TableCell>{formatCurrency(order.tax_amount)}</TableCell>
                      <TableCell>{formatCurrency(order.discount_amount)}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(order.total_amount)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{order.payment_method || 'N/A'}</p>
                          <Badge
                            variant={getPaymentStatusBadgeVariant(order.payment_status)}
                            className="text-xs"
                          >
                            {order.payment_status || 'N/A'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{order.created_by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        reportType="sales"
        reportData={{
          total_records: totalRecords,
          filters_applied: filters
        }}
      />
    </div>
  );
}