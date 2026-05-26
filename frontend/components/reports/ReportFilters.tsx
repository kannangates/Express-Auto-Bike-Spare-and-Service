'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Search, RefreshCw } from 'lucide-react';
import type { ReportFilters as ReportFiltersType } from '@/types';

interface ReportFiltersProps {
  filters: ReportFiltersType;
  onChange: (filters: ReportFiltersType) => void;
  reportType: string;
}

/**
 * Report filters component for filtering report data.
 * 
 * Implements Requirements 9.1, 9.2, 9.3, 9.4: Report filtering capabilities.
 */
export default function ReportFilters({ filters, onChange, reportType }: ReportFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFilterChange = (key: string, value: string | number) => {
    const updatedFilters = { ...localFilters, [key]: value };
    setLocalFilters(updatedFilters);
  };

  const applyFilters = () => {
    onChange(localFilters);
  };

  const resetFilters = () => {
    const defaultFilters = {
      start_date: '',
      end_date: '',
      search: '',
      limit: 100,
      offset: 0
    };
    setLocalFilters(defaultFilters);
    onChange(defaultFilters);
  };

  const getQuickDateRange = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    };
  };

  const setQuickDateRange = (days: number) => {
    const dateRange = getQuickDateRange(days);
    handleFilterChange('start_date', dateRange.start_date ?? '');
    handleFilterChange('end_date', dateRange.end_date ?? '');
  };

  return (
    <div className="space-y-6">
      {/* Date Range Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Start Date
          </Label>
          <Input
            id="start_date"
            type="date"
            value={localFilters.start_date}
            onChange={(e) => handleFilterChange('start_date', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_date">End Date</Label>
          <Input
            id="end_date"
            type="date"
            value={localFilters.end_date}
            onChange={(e) => handleFilterChange('end_date', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search
          </Label>
          <Input
            id="search"
            type="text"
            placeholder="Search..."
            value={localFilters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="limit">Records Limit</Label>
          <Select
            value={localFilters.limit?.toString()}
            onValueChange={(value) => handleFilterChange('limit', parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select limit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 records</SelectItem>
              <SelectItem value="100">100 records</SelectItem>
              <SelectItem value="250">250 records</SelectItem>
              <SelectItem value="500">500 records</SelectItem>
              <SelectItem value="1000">1000 records</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Date Range Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickDateRange(7)}
        >
          Last 7 days
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickDateRange(30)}
        >
          Last 30 days
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickDateRange(90)}
        >
          Last 90 days
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickDateRange(365)}
        >
          Last year
        </Button>
      </div>

      {/* Report-specific filters */}
      {reportType === 'sales' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status">Order Status</Label>
            <Select
              value={String(localFilters.status ?? '')}
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="SHIPPED">Shipped</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min_amount">Min Amount</Label>
            <Input
              id="min_amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={localFilters.min_amount || ''}
              onChange={(e) => handleFilterChange('min_amount', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_amount">Max Amount</Label>
            <Input
              id="max_amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={localFilters.max_amount || ''}
              onChange={(e) => handleFilterChange('max_amount', e.target.value)}
            />
          </div>
        </div>
      )}

      {reportType === 'returns' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="return_status">Return Status</Label>
            <Select
              value={String(localFilters.status ?? '')}
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="PROCESSED">Processed</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4 border-t">
        <Button onClick={applyFilters} className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          Apply Filters
        </Button>
        <Button
          variant="outline"
          onClick={resetFilters}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </div>
  );
}