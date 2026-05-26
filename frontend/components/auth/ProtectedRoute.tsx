'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { UserRole, RouteGuardProps } from '../../types'

export function ProtectedRoute({
  children,
  requiredRoles,
  requiredPermissions,
  requireApproval = true,
  fallback,
  redirectTo,
  className,
  ...props
}: RouteGuardProps) {
  const { user, loading, hasRole, hasPermission, isApproved } = useAuth()
  const router = useRouter()

  // Handle redirects in useEffect to avoid render-time state updates
  useEffect(() => {
    if (loading) return

    console.log('ProtectedRoute: Checking access', {
      hasUser: !!user,
      isApproved,
      requireApproval,
      userEmail: user?.email,
      userRole: user?.role
    })

    // Redirect if not authenticated
    if (!user && redirectTo) {
      console.log('ProtectedRoute: No user, redirecting to', redirectTo)
      router.push(redirectTo)
      return
    }

    // Redirect if not approved
    if (user && requireApproval && !isApproved) {
      console.log('ProtectedRoute: User not approved, redirecting to approval-pending', {
        user: user.email,
        isApproved,
        requireApproval
      })
      router.push(`/approval-pending?email=${encodeURIComponent(user.email)}`)
      return
    }

    // Redirect if role check fails
    if (user && requiredRoles && !hasRole(requiredRoles) && redirectTo) {
      console.log('ProtectedRoute: Role check failed, redirecting to unauthorized')
      router.push('/unauthorized')
      return
    }

    // Redirect if permission check fails
    if (user && requiredPermissions && redirectTo) {
      const hasAllPermissions = requiredPermissions.every(permission =>
        hasPermission(permission)
      )
      if (!hasAllPermissions) {
        console.log('ProtectedRoute: Permission check failed, redirecting to unauthorized')
        router.push('/unauthorized')
      }
    }
  }, [loading, user, isApproved, requireApproval, requiredRoles, requiredPermissions, redirectTo, router, hasRole, hasPermission])

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="loading-spinner h-8 w-8 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Check authentication
  if (!user) {
    if (redirectTo) {
      return null // Redirect handled in useEffect
    }

    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center">
          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
            <p className="text-gray-600 mb-4">Please log in to access this page.</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Check approval status - redirect handled in useEffect
  if (requireApproval && !isApproved) {
    return null
  }

  // Check role-based access
  if (requiredRoles && !hasRole(requiredRoles)) {
    if (redirectTo) {
      router.push('/unauthorized')
      return null
    }

    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center">
          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">
              You don&apos;t have the required role to access this page.
              {requiredRoles && (
                <span className="block mt-2 text-sm">
                  Required: {requiredRoles.join(', ')}
                </span>
              )}
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Check permission-based access
  if (requiredPermissions) {
    const hasAllPermissions = requiredPermissions.every(permission =>
      hasPermission(permission)
    )

    if (!hasAllPermissions) {
      if (redirectTo) {
        router.push('/unauthorized')
        return null
      }

      if (fallback) {
        return <>{fallback}</>
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full text-center">
            <div className="bg-white shadow-md rounded-lg p-6">
              <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Insufficient Permissions</h2>
              <p className="text-gray-600 mb-4">
                You don&apos;t have the required permissions to access this page.
                {requiredPermissions && (
                  <span className="block mt-2 text-sm">
                    Required: {requiredPermissions.join(', ')}
                  </span>
                )}
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }
  }

  // All checks passed, render children
  return (
    <div className={className} {...props}>
      {children}
    </div>
  )
}

// Role-specific route guards
export function OwnerRoute({ children, ...props }: Omit<RouteGuardProps, 'requiredRoles'>) {
  return (
    <ProtectedRoute requiredRoles={['OWNER'] as UserRole[]} {...props}>
      {children}
    </ProtectedRoute>
  )
}

export function OperationsRoute({ children, ...props }: Omit<RouteGuardProps, 'requiredRoles'>) {
  return (
    <ProtectedRoute requiredRoles={['OWNER', 'OPERATIONS'] as UserRole[]} {...props}>
      {children}
    </ProtectedRoute>
  )
}

export function CashierRoute({ children, ...props }: Omit<RouteGuardProps, 'requiredRoles'>) {
  return (
    <ProtectedRoute requiredRoles={['OWNER', 'OPERATIONS', 'CASHIER'] as UserRole[]} {...props}>
      {children}
    </ProtectedRoute>
  )
}

export function DeliveryRoute({ children, ...props }: Omit<RouteGuardProps, 'requiredRoles'>) {
  return (
    <ProtectedRoute requiredRoles={['OWNER', 'OPERATIONS', 'CASHIER', 'DELIVERY'] as UserRole[]} {...props}>
      {children}
    </ProtectedRoute>
  )
}

export function CustomerRoute({ children, ...props }: Omit<RouteGuardProps, 'requiredRoles'>) {
  return (
    <ProtectedRoute requiredRoles={['OWNER', 'OPERATIONS', 'CASHIER', 'DELIVERY', 'CUSTOMER'] as UserRole[]} {...props}>
      {children}
    </ProtectedRoute>
  )
}

// Permission-based route guards
export function AdminRoute({ children, ...props }: Omit<RouteGuardProps, 'requiredPermissions'>) {
  return (
    <ProtectedRoute requiredPermissions={['django_admin']} {...props}>
      {children}
    </ProtectedRoute>
  )
}

export function InventoryRoute({ children, ...props }: Omit<RouteGuardProps, 'requiredPermissions'>) {
  return (
    <ProtectedRoute requiredPermissions={['manage_inventory']} {...props}>
      {children}
    </ProtectedRoute>
  )
}

export function OrderRoute({ children, ...props }: Omit<RouteGuardProps, 'requiredPermissions'>) {
  return (
    <ProtectedRoute requiredPermissions={['process_orders']} {...props}>
      {children}
    </ProtectedRoute>
  )
}

export function ReportRoute({ children, ...props }: Omit<RouteGuardProps, 'requiredPermissions'>) {
  return (
    <ProtectedRoute requiredPermissions={['view_reports']} {...props}>
      {children}
    </ProtectedRoute>
  )
}