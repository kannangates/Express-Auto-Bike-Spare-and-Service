'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { getAuthToken } from '@/utils/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Package, Users, RotateCcw, Download, Filter, Calendar, Loader2 } from 'lucide-react';
import ReportFilters from '@/components/reports/ReportFilters';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { MainLayout } from '@/components/layout/MainLayout';
import type { ReportFilters as ReportFiltersType } from '@/types';

const ReportLoading = () => (
  <div className="flex items-center justify-center p-12">
    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
  </div>
);

const SalesReport = dynamic(() => import('@/components/reports/SalesReport'), { loading: ReportLoading, ssr: false });
const InventoryReport = dynamic(() => import('@/components/reports/InventoryReport'), { loading: ReportLoading, ssr: false });
const CustomerReport = dynamic(() => import('@/components/reports/CustomerReport'), { loading: ReportLoading, ssr: false });
const ReturnReport = dynamic(() => import('@/components/reports/ReturnReport'), { loading: ReportLoading, ssr: false });

/**
 * Reports page component for generating detailed business reports.
 * 
 * Implements Requirements 9.1, 9.2, 9.3, 9.4: Report generation system.
 */
export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales');
  const [showFilters, setShowFilters] = useState(false);
  const [globalFilters, setGlobalFilters] = useState<ReportFiltersType>({
    start_date: '',
    end_date: '',
    search: '',
    limit: 100,
    offset: 0
  });

  const reportTabs = [
    {
      id: 'sales',
      label: 'Sales Reports',
      icon: BarChart3,
      description: 'Sales performance and customer analysis',
      component: SalesReport
    },
    {
      id: 'inventory',
      label: 'Inventory Reports',
      icon: Package,
      description: 'Stock levels and movement tracking',
      component: InventoryReport
    },
    {
      id: 'customers',
      label: 'Customer Reports',
      icon: Users,
      description: 'Customer history and credit balances',
      component: CustomerReport
    },
    {
      id: 'returns',
      label: 'Return Reports',
      icon: RotateCcw,
      description: 'Return analysis and trends',
      component: ReturnReport
    }
  ];

  const handleFilterChange = (filters: ReportFiltersType) => {
    setGlobalFilters(filters);
  };

  const handleExportReport = async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams({
        format,
        start_date: globalFilters.start_date,
        end_date: globalFilters.end_date,
        search: globalFilters.search,
        limit: String(globalFilters.limit),
        offset: String(globalFilters.offset),
      });
      const response = await fetch(`/api/v1/reports/export/${activeTab}/?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${getAuthToken() ?? ''}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeTab}_report_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Export failed:', response.statusText);
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  return (
    <ProtectedRoute requireApproval={true}>
      <MainLayout title="Business Reports" subtitle="Generate detailed reports for sales, inventory, customers, and returns">
        <div className="space-y-6">
          {/* Global Filters */}
          {showFilters && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Report Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReportFilters
                  filters={globalFilters}
                  onChange={handleFilterChange}
                  reportType={activeTab}
                />
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button
              onClick={() => handleExportReport('csv')}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={() => handleExportReport('json')}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </button>
          </div>

          {/* Report Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
              {reportTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {reportTabs.map((tab) => {
              const ReportComponent = tab.component;
              return (
                <TabsContent key={tab.id} value={tab.id} className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <tab.icon className="h-5 w-5" />
                        {tab.label}
                      </CardTitle>
                      <p className="text-gray-600">{tab.description}</p>
                    </CardHeader>
                    <CardContent>
                      <ReportComponent filters={globalFilters} />
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}