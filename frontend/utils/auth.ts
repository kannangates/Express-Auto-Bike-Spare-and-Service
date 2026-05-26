import { User, UserRole } from '../types'

// Token management
export const getAuthToken = (): string | null => {
  if (typeof document === 'undefined') return null

  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('auth-token='))
    ?.split('=')[1]

  return token || null
}

export const setAuthToken = (token: string, maxAge: number = 7 * 24 * 60 * 60): void => {
  if (typeof document === 'undefined') return

  document.cookie = `auth-token=${token}; path=/; max-age=${maxAge}; samesite=lax`
}

export const removeAuthToken = (): void => {
  if (typeof document === 'undefined') return

  document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
}

export const getRefreshToken = (): string | null => {
  if (typeof document === 'undefined') return null

  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('refresh-token='))
    ?.split('=')[1]

  return token || null
}

// JWT token utilities
export const decodeJWT = (token: string): any => {
  try {
    const parts = token.split('.')
    if (parts.length !== 3 || !parts[1]) return null

    return JSON.parse(atob(parts[1]))
  } catch (error) {
    console.error('Failed to decode JWT:', error)
    return null
  }
}

export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = decodeJWT(token)
    if (!payload || !payload.exp) return true

    const currentTime = Math.floor(Date.now() / 1000)
    return payload.exp < currentTime
  } catch (error) {
    return true
  }
}

export const getUserFromToken = (token: string): Partial<User> | null => {
  try {
    const payload = decodeJWT(token)
    if (!payload) return null

    return {
      id: payload.user_id,
      email: payload.email,
      role: payload.role,
      isApproved: payload.is_approved,
      profile: {
        firstName: payload.first_name,
        lastName: payload.last_name,
        phone: payload.phone,
        avatarUrl: payload.avatar_url || '',
      }
    }
  } catch (error) {
    console.error('Failed to get user from token:', error)
    return null
  }
}

// Role-based access control
export const hasRole = (userRole: UserRole, requiredRoles: UserRole[]): boolean => {
  return requiredRoles.includes(userRole)
}

export const hasPermission = (userRole: UserRole, permission: string): boolean => {
  const rolePermissions: Record<UserRole, string[]> = {
    OWNER: [
      'manage_users',
      'manage_inventory',
      'process_orders',
      'handle_returns',
      'view_reports',
      'system_settings',
      'django_admin'
    ],
    OPERATIONS: [
      'manage_inventory',
      'process_orders',
      'handle_returns',
      'view_reports'
    ],
    CASHIER: [
      'process_orders',
      'handle_returns',
      'scan_barcode',
      'view_inventory'
    ],
    DELIVERY: [
      'view_orders',
      'update_order_status'
    ],
    CUSTOMER: [
      'view_own_orders',
      'place_orders'
    ]
  }

  return rolePermissions[userRole]?.includes(permission) || false
}

// Route access control
export const canAccessRoute = (userRole: UserRole, pathname: string): boolean => {
  const routePermissions: Record<string, UserRole[]> = {
    '/admin': [UserRole.OWNER],
    '/users': [UserRole.OWNER],
    '/settings': [UserRole.OWNER],
    '/inventory': [UserRole.OWNER, UserRole.OPERATIONS, UserRole.CASHIER],
    '/orders': [UserRole.OWNER, UserRole.OPERATIONS, UserRole.CASHIER, UserRole.DELIVERY, UserRole.CUSTOMER],
    '/returns': [UserRole.OWNER, UserRole.OPERATIONS, UserRole.CASHIER],
    '/reports': [UserRole.OWNER, UserRole.OPERATIONS],
    '/scan': [UserRole.OWNER, UserRole.OPERATIONS, UserRole.CASHIER],
    '/dashboard': [UserRole.OWNER, UserRole.OPERATIONS, UserRole.CASHIER, UserRole.DELIVERY, UserRole.CUSTOMER]
  }

  // Find matching route pattern
  const matchingRoute = Object.keys(routePermissions).find(route =>
    pathname.startsWith(route)
  )

  if (!matchingRoute) {
    // If no specific route restriction, allow access for authenticated users
    return true
  }

  const allowedRoles = routePermissions[matchingRoute]
  return allowedRoles ? allowedRoles.includes(userRole) : true
}

// Authentication status checks
export const isAuthenticated = (): boolean => {
  const token = getAuthToken()
  return token !== null && !isTokenExpired(token)
}

export const isUserApproved = (): boolean => {
  const token = getAuthToken()
  if (!token) return false

  const user = getUserFromToken(token)
  return user?.isApproved || false
}

// Google OAuth utilities
export const getGoogleAuthUrl = (redirectUri: string): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  return `${baseUrl}/api/v1/auth/google/login/?redirect_uri=${encodeURIComponent(redirectUri)}`
}

// Logout utility
export const logout = (): void => {
  removeAuthToken()

  // Redirect to login
  window.location.href = '/login'
}

// Auto-refresh token utility
export const refreshTokenIfNeeded = async (): Promise<boolean> => {
  const token = getAuthToken()
  if (!token) return false

  try {
    const payload = decodeJWT(token)
    if (!payload) return false

    // Check if token expires in the next 5 minutes
    const currentTime = Math.floor(Date.now() / 1000)
    const expiresIn = payload.exp - currentTime

    if (expiresIn < 300) { // 5 minutes
      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        logout()
        return false
      }

      const response = await fetch(`/api/v1/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.access_token) {
          setAuthToken(data.access_token)
          return true
        }
      }
      logout()
      return false
    }

    return true
  } catch (error) {
    console.error('Failed to refresh token:', error)
    logout()
    return false
  }
}

// Role display utilities
export const getRoleDisplayName = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    OWNER: 'Owner',
    OPERATIONS: 'Operations Manager',
    CASHIER: 'Cashier',
    DELIVERY: 'Delivery Personnel',
    CUSTOMER: 'Customer'
  }

  return roleNames[role] || role
}

export const getRoleColor = (role: UserRole): string => {
  const roleColors: Record<UserRole, string> = {
    OWNER: 'bg-purple-100 text-purple-800',
    OPERATIONS: 'bg-blue-100 text-blue-800',
    CASHIER: 'bg-green-100 text-green-800',
    DELIVERY: 'bg-yellow-100 text-yellow-800',
    CUSTOMER: 'bg-gray-100 text-gray-800'
  }

  return roleColors[role] || 'bg-gray-100 text-gray-800'
}