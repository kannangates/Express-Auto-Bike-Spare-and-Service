'use client'

import { useState } from 'react'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onDateRangeChange: (startDate: string, endDate: string) => void
  className?: string
}

export function DateRangePicker({
  startDate,
  endDate,
  onDateRangeChange,
  className = ''
}: DateRangePickerProps) {
  const [isCustomRange, setIsCustomRange] = useState(false)

  const handlePresetChange = (preset: string) => {
    const now = new Date()

    if (preset === 'custom') {
      setIsCustomRange(true)
      return
    }

    // Initialize with default value
    let start: Date = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    switch (preset) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'quarter':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'year':
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
    }

    setIsCustomRange(false)
    const startDateString = start.toISOString().substring(0, 10)
    const endDateString = now.toISOString().substring(0, 10)
    onDateRangeChange(startDateString, endDateString)
  }

  const handleCustomDateChange = (field: 'start' | 'end', value: string) => {
    if (field === 'start') {
      onDateRangeChange(value, endDate)
    } else {
      onDateRangeChange(startDate, value)
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Date Range:
          </label>
          <select
            className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => handlePresetChange(e.target.value)}
            value={isCustomRange ? 'custom' : ''}
          >
            <option value="">Select Range</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
            <option value="year">Last Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {isCustomRange && (
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleCustomDateChange('start', e.target.value)}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleCustomDateChange('end', e.target.value)}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}