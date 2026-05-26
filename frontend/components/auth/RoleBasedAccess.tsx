'use client'

import React from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { UserRole } from '../../types'

export interface RoleBasedAccessProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
  requiredPermissions?: string[]
  requireApproval?: boolean
  fallback?: React.ReactNode
  className?: string
}

export function RoleBasedAccess({
  children,
  allowedRoles,
  requiredPermissions,
  requireApproval = true,
  fallback = null,
  className,
}: RoleBasedAccessProps) {
  const { user, hasRole, hasPermission, isApproved } = useAuth()

  // If not authenticated, don't render anything
  if (!user) {
    return <>{fallback}</>
  }

  // Check approval status
  if (requireApproval && !isApproved) {
    return <>{fallback}</>
  }

  // Check role-based access
  if (allowedRoles && !hasRole(allowedRoles)) {
    return <>{fallback}</>
  }

  // Check permission-based access
  if (requiredPermissions) {
    const hasAnyPermission = requiredPermissions.some(permission =>
      hasPermission(permission)
    )

    if (!hasAnyPermission) {
      return <>{fallback}</>
    }
  }

  // All checks passed, render children
  return (
    <div className={className}>
      {children}
    </div>
  )
}

// Convenience components for specific roles
export function OwnerOnly({ children, fallback, className }: Omit<RoleBasedAccessProps, 'allowedRoles'>) {
  return (
    <RoleBasedAccess allowedRoles={['OWNER'] as UserRole[]} fallback={fallback} className={className}>
      {children}
    </RoleBasedAccess>
  )
}

export function OperationsOnly({ children, fallback, className }: Omit<RoleBasedAccessProps, 'allowedRoles'>) {
  return (
    <RoleBasedAccess allowedRoles={['OWNER', 'OPERATIONS'] as UserRole[]} fallback={fallback} className={className}>
      {children}
    </RoleBasedAccess>
  )
}

export function CashierOnly({ children, fallback, className }: Omit<RoleBasedAccessProps, 'allowedRoles'>) {
  return (
    <RoleBasedAccess allowedRoles={['OWNER', 'OPERATIONS', 'CASHIER'] as UserRole[]} fallback={fallback} className={className}>
      {children}
    </RoleBasedAccess>
  )
}

export function DeliveryOnly({ children, fallback, className }: Omit<RoleBasedAccessProps, 'allowedRoles'>) {
  return (
    <RoleBasedAccess allowedRoles={['OWNER', 'OPERATIONS', 'CASHIER', 'DELIVERY'] as UserRole[]} fallback={fallback} className={className}>
      {children}
    </RoleBasedAccess>
  )
}

export function CustomerOnly({ children, fallback, className }: Omit<RoleBasedAccessProps, 'allowedRoles'>) {
  return (
    <RoleBasedAccess allowedRoles={['CUSTOMER'] as UserRole[]} fallback={fallback} className={className}>
      {children}
    </RoleBasedAccess>
  )
}

// Permission-based components
export function AdminOnly({ children, fallback, className }: Omit<RoleBasedAccessProps, 'requiredPermissions'>) {
  return (
    <RoleBasedAccess requiredPermissions={['django_admin']} fallback={fallback} className={className}>
      {children}
    </RoleBasedAccess>
  )
}

export function InventoryAccess({ children, fallback, className }: Omit<RoleBasedAccessProps, 'requiredPermissions'>) {
  return (
    <RoleBasedAccess requiredPermissions={['manage_inventory']} fallback={fallback} className={className}>
      {children}
    </RoleBasedAccess>
  )
}

export function OrderAccess({ children, fallback, className }: Omit<RoleBasedAccessProps, 'requiredPermissions'>) {
  return (
    <RoleBasedAccess requiredPermissions={['process_orders']} fallback={fallback} className={className}>
      {children}
    </RoleBasedAccess>
  )
}

export function ReportAccess({ children, fallback, className }: Omit<RoleBasedAccessProps, 'requiredPermissions'>) {
  return (
    <RoleBasedAccess requiredPermissions={['view_reports']} fallback={fallback} className={className}>
      {children}
    </RoleBasedAccess>
  )
}

// Hook for conditional rendering based on access
export function useRoleBasedAccess() {
  const { user, hasRole, hasPermission, isApproved } = useAuth()

  const canAccess = (options: {
    allowedRoles?: UserRole[]
    requiredPermissions?: string[]
    requireApproval?: boolean
  }) => {
    if (!user) return false

    if (options.requireApproval !== false && !isApproved) return false

    if (options.allowedRoles && !hasRole(options.allowedRoles)) return false

    if (options.requiredPermissions) {
      const hasAllPermissions = options.requiredPermissions.every(permission =>
        hasPermission(permission)
      )
      if (!hasAllPermissions) return false
    }

    return true
  }

  return {
    canAccess,
    isOwner: hasRole(['OWNER'] as UserRole[]),
    isOperations: hasRole(['OWNER', 'OPERATIONS'] as UserRole[]),
    isCashier: hasRole(['OWNER', 'OPERATIONS', 'CASHIER'] as UserRole[]),
    isDelivery: hasRole(['OWNER', 'OPERATIONS', 'CASHIER', 'DELIVERY'] as UserRole[]),
    isCustomer: hasRole(['CUSTOMER'] as UserRole[]),
    canManageUsers: hasPermission('manage_users'),
    canManageInventory: hasPermission('manage_inventory'),
    canProcessOrders: hasPermission('process_orders'),
    canHandleReturns: hasPermission('handle_returns'),
    canViewReports: hasPermission('view_reports'),
    canAccessAdmin: hasPermission('django_admin'),
  }
}