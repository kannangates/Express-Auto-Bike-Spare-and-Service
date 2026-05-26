'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ProtectedRoute } from '../../components/auth/ProtectedRoute'
import { MainLayout } from '../../components/layout/MainLayout'
import { DateRangePicker } from '../../components/dashboard/DateRangePicker'
import { RecentActivity } from '../../components/dashboard/RecentActivity'
import { dashboardApi } from '../../utils/api'
import { Package, AlertTriangle, ClipboardList, DollarSign, Plus, ScanBarcode, BarChart3 } from 'lucide-react'

interface DashboardStats {
  period: { start_date: string; end_date: string; days: number }
  inventory: { total_items: number; total_stock_value: number; low_stock_items: number; out_of_stock_items: number; avg_stock_level: number; stock_health_percentage: number }
  sales: { total_sales: number; total_orders: number; avg_order_value: number; todays_sales: number; top_selling_items: Array<{ item__name: string; item__barcode: string; total_quantity: number; total_revenue: number }> }
  orders: { pending_orders: number; processing_orders: number; status_distribution: Record<string, number>; fulfillment_rate: number; total_orders_period: number }
  returns: { total_returns: number; total_return_value: number; pending_returns: number; return_rate: number }
  customers: { total_customers: number; active_customers: number; new_customers: number; avg_customer_lifetime_value: number }
  system: { total_users: number; pending_approvals: number; unread_notifications: number; recent_activity_24h: { orders: number; returns: number; stock_transactions: number } }
  last_updated: string
}

const fmt = (n?: number, decimals = 0) => n != null ? n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '0'
const fmtCurrency = (n?: number) => n != null ? `₹${fmt(n, 2)}` : '₹0'

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5 flex items-center">
        <div className={`w-10 h-10 ${color} rounded-md flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

function DashboardContent() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
    endDate: new Date().toISOString().substring(0, 10)
  })

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const data = await dashboardApi.getStats({ start_date: dateRange.startDate, end_date: dateRange.endDate })
      setStats(data)
    } catch {
      setError('Failed to load dashboard data. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => { loadDashboardData() }, [loadDashboardData])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="loading-spinner h-8 w-8 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={loadDashboardData} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Retry</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Date Range Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <DateRangePicker startDate={dateRange.startDate} endDate={dateRange.endDate} onDateRangeChange={(s, e) => setDateRange({ startDate: s, endDate: e })} />
        <span className="text-sm text-gray-500 whitespace-nowrap">
          {stats?.period.start_date} to {stats?.period.end_date} ({stats?.period.days ?? 0} days)
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Inventory Items" value={fmt(stats?.inventory.total_items)} icon={<Package className="w-5 h-5 text-white" />} color="bg-blue-500" />
        <StatCard label="Low Stock Items" value={fmt(stats?.inventory.low_stock_items)} icon={<AlertTriangle className="w-5 h-5 text-white" />} color="bg-yellow-500" />
        <StatCard label="Pending Orders" value={fmt(stats?.orders.pending_orders)} icon={<ClipboardList className="w-5 h-5 text-white" />} color="bg-green-500" />
        <StatCard label="Total Sales" value={fmtCurrency(stats?.sales.total_sales)} icon={<DollarSign className="w-5 h-5 text-white" />} color="bg-purple-500" />
      </div>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Sales */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Sales Performance</h3>
          <div className="space-y-3">
            {[
              ["Today's Sales", fmtCurrency(stats?.sales.todays_sales)],
              ["Avg Order Value", fmtCurrency(stats?.sales.avg_order_value)],
              ["Total Orders", fmt(stats?.sales.total_orders)],
              ["Fulfillment Rate", `${fmt(stats?.orders.fulfillment_rate, 1)}%`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Inventory Health</h3>
          <div className="space-y-3">
            {[
              ["Stock Health", `${fmt(stats?.inventory.stock_health_percentage, 1)}%`],
              ["Total Stock Value", fmtCurrency(stats?.inventory.total_stock_value)],
              ["Out of Stock", fmt(stats?.inventory.out_of_stock_items)],
              ["Avg Stock Level", fmt(stats?.inventory.avg_stock_level, 1)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Customers */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Metrics</h3>
          <div className="space-y-3">
            {[
              ["Total Customers", fmt(stats?.customers.total_customers)],
              ["Active Customers", fmt(stats?.customers.active_customers)],
              ["New Customers", fmt(stats?.customers.new_customers)],
              ["Avg Lifetime Value", fmtCurrency(stats?.customers.avg_customer_lifetime_value)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity />

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/inventory?action=new" className="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg flex items-center space-x-3 transition-colors">
              <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center"><Plus className="w-5 h-5 text-white" /></div>
              <span className="text-sm font-medium text-gray-900">Add Inventory</span>
            </Link>
            <Link href="/orders?action=new" className="bg-green-50 hover:bg-green-100 p-4 rounded-lg flex items-center space-x-3 transition-colors">
              <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center"><ClipboardList className="w-5 h-5 text-white" /></div>
              <span className="text-sm font-medium text-gray-900">New Order</span>
            </Link>
            <Link href="/orders?action=scan" className="bg-yellow-50 hover:bg-yellow-100 p-4 rounded-lg flex items-center space-x-3 transition-colors">
              <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center"><ScanBarcode className="w-5 h-5 text-white" /></div>
              <span className="text-sm font-medium text-gray-900">Scan Barcode</span>
            </Link>
            <Link href="/reports" className="bg-purple-50 hover:bg-purple-100 p-4 rounded-lg flex items-center space-x-3 transition-colors">
              <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center"><BarChart3 className="w-5 h-5 text-white" /></div>
              <span className="text-sm font-medium text-gray-900">View Reports</span>
            </Link>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div><div className="text-2xl font-bold text-blue-600">{fmt(stats?.system.total_users)}</div><div className="text-sm text-gray-600">Total Users</div></div>
          <div><div className="text-2xl font-bold text-yellow-600">{fmt(stats?.system.pending_approvals)}</div><div className="text-sm text-gray-600">Pending Approvals</div></div>
          <div><div className="text-2xl font-bold text-red-600">{fmt(stats?.system.unread_notifications)}</div><div className="text-sm text-gray-600">Unread Notifications</div></div>
          <div><div className="text-2xl font-bold text-green-600">{fmt(stats?.system.recent_activity_24h?.orders)}</div><div className="text-sm text-gray-600">Orders (24h)</div></div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <ProtectedRoute requireApproval={true}>
      <MainLayout title="Dashboard" subtitle="Overview of your Express Auto Bike Management System">
        <DashboardContent />
      </MainLayout>
    </ProtectedRoute>
  )
}
