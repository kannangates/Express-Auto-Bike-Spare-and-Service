'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { UserProfilePopup } from '../auth/UserProfile'
import {
  LayoutDashboard, Package, ClipboardList, RotateCcw,
  ScanBarcode, BarChart3, Users, Settings, ExternalLink, Menu, Zap, Cog,
} from 'lucide-react'

export interface MainLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
}

interface NavigationItem {
  name: string
  href: string
  icon: React.ReactNode
  allowedRoles?: string[]
  requiredPermissions?: string[]
}

const navigationItems: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { name: 'Inventory', href: '/inventory', icon: <Package className="w-5 h-5" />, requiredPermissions: ['manage_inventory', 'view_inventory'] },
  { name: 'Orders', href: '/orders', icon: <ClipboardList className="w-5 h-5" />, requiredPermissions: ['process_orders', 'view_orders', 'view_own_orders'] },
  { name: 'Returns', href: '/returns', icon: <RotateCcw className="w-5 h-5" />, requiredPermissions: ['handle_returns'] },
  { name: 'Barcode Scanner', href: '/scan', icon: <ScanBarcode className="w-5 h-5" />, requiredPermissions: ['scan_barcode'] },
  { name: 'Reports', href: '/reports', icon: <BarChart3 className="w-5 h-5" />, requiredPermissions: ['view_reports'] },
  { name: 'Users', href: '/users', icon: <Users className="w-5 h-5" />, requiredPermissions: ['manage_users'] },
  { name: 'Settings', href: '/settings', icon: <Settings className="w-5 h-5" />, allowedRoles: ['OWNER'] },
]

export function MainLayout({ children, title, subtitle }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { user, hasPermission, hasRole } = useAuth()

  const isActiveRoute = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const canSeeItem = (item: NavigationItem): boolean => {
    if (!user) return false
    if (item.allowedRoles && !hasRole(item.allowedRoles as never)) return false
    if (item.requiredPermissions) return item.requiredPermissions.some(p => hasPermission(p))
    return true
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden bg-gray-600 opacity-75" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 bg-blue-600">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-white font-bold text-lg">Express Auto</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigationItems.filter(canSeeItem).map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActiveRoute(item.href)
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                onClick={() => setSidebarOpen(false)}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            ))}

            {/* Django Admin - Owner Only */}
            {user?.role === 'OWNER' && (
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL}/admin/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <Cog className="w-5 h-5" />
                <span>Django Admin</span>
                <ExternalLink className="w-4 h-4 ml-auto" />
              </a>
            )}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:ml-64 min-h-screen">
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-4">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100">
                <Menu className="w-6 h-6" />
              </button>
              <div>
                {title && <h1 className="text-xl font-semibold text-gray-900">{title}</h1>}
                {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
              </div>
            </div>
            <UserProfilePopup />
          </div>
        </header>

        <main className="flex-1">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
