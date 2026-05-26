'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Package, AlertTriangle, TrendingDown, DollarSign, Download } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/formatting';
import ExportDialog from './ExportDialog';
import { api } from '@/utils/api';
import type { ReportFilters } from '@/types';

interface InventoryReportProps {
  filters: ReportFilters;
}

interface InventoryData {
  barcode: string;
  name: string;
  category: string;
  unit_price: number;
  stock_quantity: number;
  min_stock_level: number;
  stock_value: number;
  stock_status: string;
  last_transaction_date: string;
  total_sold: number;
  total_returned: number;
  is_active: boolean;
}

interface InventorySummary {
  total_items: number;
  total_stock_value: number;
  avg_unit_price: number;
  total_stock_quantity: number;
  stock_status_distribution: {
    HEALTHY: number;
    LOW_STOCK: number;
    OUT_OF_STOCK: number;
  };
}

/**
 * Inventory report component with stock levels and movement tracking.
 * 
 * Implements Requirements 9.2: Inventory reports with stock levels and movement tracking.
 * Implements Requirements 9.5: Multi-format report export functionality.
 */
export default function InventoryReport({ filters }: InventoryReportProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InventoryData[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInventoryReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchInventoryReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params[key] = value.toString();
        }
      });

      const result = await api.get('/api/v1/reports/inventory/', params);
      setData(result.data);
      setSummary(result.summary);
      setTotalRecords(result.total_records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getStockStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'default';
      case 'LOW_STOCK':
        return 'secondary';
      case 'OUT_OF_STOCK':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStockStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <Package className="h-4 w-4 text-green-600" />;
      case 'LOW_STOCK':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'OUT_OF_STOCK':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Package className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading inventory report...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600 mb-4">Error loading inventory report: {error}</p>
        <Button onClick={fetchInventoryReport}>Retry</Button>
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
                  <p className="text-sm font-medium text-gray-600">Total Items</p>
                  <p className="text-2xl font-bold">{summary.total_items.toLocaleString()}</p>
                </div>
                <Package className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Stock Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_stock_value)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Quantity</p>
                  <p className="text-2xl font-bold">{summary.total_stock_quantity.toLocaleString()}</p>
                </div>
                <Package className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Unit Price</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.avg_unit_price)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stock Status Distribution */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Stock Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Healthy Stock</span>
                </div>
                <span className="text-2xl font-bold text-green-600">
                  {summary.stock_status_distribution.HEALTHY}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="font-medium">Low Stock</span>
                </div>
                <span className="text-2xl font-bold text-yellow-600">
                  {summary.stock_status_distribution.LOW_STOCK}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <span className="font-medium">Out of Stock</span>
                </div>
                <span className="text-2xl font-bold text-red-600">
                  {summary.stock_status_distribution.OUT_OF_STOCK}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Inventory Details ({totalRecords} records)</CardTitle>
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
              <p className="text-gray-500">No inventory data found for the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Stock Qty</TableHead>
                    <TableHead>Min Level</TableHead>
                    <TableHead>Stock Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Sold</TableHead>
                    <TableHead>Total Returned</TableHead>
                    <TableHead>Last Transaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.barcode}>
                      <TableCell className="font-mono text-sm">{item.barcode}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {!item.is_active && (
                            <Badge variant="outline" className="text-xs mt-1">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${item.stock_quantity === 0 ? 'text-red-600' :
                            item.stock_quantity <= item.min_stock_level ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                            {item.stock_quantity}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{item.min_stock_level}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(item.stock_value)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStockStatusIcon(item.stock_status)}
                          <Badge variant={getStockStatusBadgeVariant(item.stock_status)}>
                            {item.stock_status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{item.total_sold}</TableCell>
                      <TableCell>{item.total_returned}</TableCell>
                      <TableCell className="text-sm">
                        {formatDate(item.last_transaction_date)}
                      </TableCell>
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
        reportType="inventory"
        reportData={{
          total_records: totalRecords,
          filters_applied: filters
        }}
      />
    </div>
  );
}