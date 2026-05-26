'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, DollarSign, ShoppingCart, RotateCcw, Download } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/formatting';
import ExportDialog from './ExportDialog';
import { api } from '@/utils/api';
import type { ReportFilters } from '@/types';

interface CustomerReportProps {
  filters: ReportFilters;
}

interface CustomerData {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  registration_date: string;
  total_orders: number;
  total_spent: number;
  total_returns: number;
  credit_balance: number;
  last_order_date: string | null;
  avg_order_value: number;
  customer_status: string;
}

interface CustomerSummary {
  total_customers: number;
  avg_customer_lifetime_value: number;
  avg_orders_per_customer: number;
  avg_returns_per_customer: number;
}

/**
 * Customer report component with purchase history and credit balances.
 * 
 * Implements Requirements 9.3: Customer reports with purchase history and credit balances.
 */
export default function CustomerReport({ filters }: CustomerReportProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CustomerData[]>([]);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  useEffect(() => {
    fetchCustomerReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchCustomerReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params[key] = value.toString();
        }
      });

      const result = await api.get('/api/v1/reports/customers/', params);
      setData(result.data);
      setSummary(result.summary);
      setTotalRecords(result.total_records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getCustomerStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'default';
      case 'NEW':
        return 'secondary';
      case 'INACTIVE':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getCustomerStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-600';
      case 'NEW':
        return 'text-blue-600';
      case 'INACTIVE':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading customer report...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600 mb-4">Error loading customer report: {error}</p>
        <Button onClick={fetchCustomerReport}>Retry</Button>
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
                  <p className="text-sm font-medium text-gray-600">Total Customers</p>
                  <p className="text-2xl font-bold">{summary.total_customers.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Lifetime Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.avg_customer_lifetime_value)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Orders/Customer</p>
                  <p className="text-2xl font-bold">{summary.avg_orders_per_customer.toFixed(1)}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Returns/Customer</p>
                  <p className="text-2xl font-bold">{summary.avg_returns_per_customer.toFixed(1)}</p>
                </div>
                <RotateCcw className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Customer Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Customer Details ({totalRecords} records)</CardTitle>
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
              <p className="text-gray-500">No customer data found for the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Avg Order</TableHead>
                    <TableHead>Returns</TableHead>
                    <TableHead>Credit Balance</TableHead>
                    <TableHead>Last Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((customer) => {
                    const fullName = `${customer.first_name} ${customer.last_name}`.trim();
                    const displayName = fullName || customer.email.split('@')[0];

                    return (
                      <TableRow key={customer.email}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{displayName}</p>
                            <p className="text-sm text-gray-500">{customer.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{customer.phone || 'N/A'}</p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(customer.registration_date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getCustomerStatusBadgeVariant(customer.customer_status)}>
                            <span className={getCustomerStatusColor(customer.customer_status)}>
                              {customer.customer_status}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <p className="font-medium">{customer.total_orders}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(customer.total_spent)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(customer.avg_order_value)}
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <p className={`font-medium ${customer.total_returns > 0 ? 'text-orange-600' : ''}`}>
                              {customer.total_returns}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`font-medium ${customer.credit_balance > 0 ? 'text-green-600' : 'text-gray-500'
                            }`}>
                            {formatCurrency(customer.credit_balance)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {customer.last_order_date ? formatDate(customer.last_order_date) : 'Never'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Insights */}
      {data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Customers by Spending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data
                  .sort((a, b) => b.total_spent - a.total_spent)
                  .slice(0, 5)
                  .map((customer, index) => {
                    const fullName = `${customer.first_name} ${customer.last_name}`.trim();
                    const displayName = fullName || customer.email.split('@')[0];

                    return (
                      <div key={customer.email} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{displayName}</p>
                            <p className="text-sm text-gray-500">{customer.total_orders} orders</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(customer.total_spent)}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customers with Credit Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data
                  .filter(customer => customer.credit_balance > 0)
                  .sort((a, b) => b.credit_balance - a.credit_balance)
                  .slice(0, 5)
                  .map((customer) => {
                    const fullName = `${customer.first_name} ${customer.last_name}`.trim();
                    const displayName = fullName || customer.email.split('@')[0];

                    return (
                      <div key={customer.email} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div>
                          <p className="font-medium">{displayName}</p>
                          <p className="text-sm text-gray-500">{customer.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-600">
                            {formatCurrency(customer.credit_balance)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                {data.filter(customer => customer.credit_balance > 0).length === 0 && (
                  <p className="text-gray-500 text-center py-4">No customers with credit balance</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        reportType="customer"
        reportData={{
          total_records: totalRecords,
          filters_applied: filters
        }}
      />
    </div>
  );
}