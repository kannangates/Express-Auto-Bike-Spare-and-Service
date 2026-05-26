'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, UserRole, AuthContextValue } from '../types'
import {
  getAuthToken,
  removeAuthToken,
  getUserFromToken,
  isTokenExpired,
  hasRole as checkRole,
  hasPermission as checkPermission,
  logout as performLogout
} from '../utils/auth'
import { authApi } from '../utils/api'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Initialize authentication state
  const initializeAuth = useCallback(async () => {
    try {
      const token = getAuthToken()

      console.log('AuthContext: Initializing auth', {
        hasToken: !!token,
        tokenLength: token?.length
      })

      if (!token || isTokenExpired(token)) {
        console.log('AuthContext: No valid token found')
        setUser(null)
        setLoading(false)
        return
      }

      // Get user data from token
      const userData = getUserFromToken(token)
      console.log('AuthContext: User data from token', {
        userData,
        isApproved: userData?.isApproved
      })

      if (!userData) {
        console.log('AuthContext: Failed to decode user data')
        removeAuthToken()
        setUser(null)
        setLoading(false)
        return
      }

      // Set user from token data immediately
      setUser(userData as User)
      setLoading(false)

      // Verify token with backend in background (optional)
      try {
        const response = await authApi.verify()
        if (response?.user) {
          console.log('AuthContext: Backend verification response', {
            user: response.user,
            isApproved: response.user.isApproved
          })
          setUser(response.user)
        }
      } catch (error) {
        // If verification fails, keep the user from token
        console.warn('Token verification failed, using token data:', error)
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      setUser(null)
      setLoading(false)
    }
  }, [])

  // Login function
  const login = useCallback(async (credentials: { code: string; state?: string; redirectUri: string }) => {
    setLoading(true)
    try {
      const response = await authApi.googleCallback({
        code: credentials.code,
        state: credentials.state,
        redirect_uri: credentials.redirectUri,
      })

      // Store token with lax samesite for cross-origin redirects
      document.cookie = `auth-token=${response.access_token}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`

      setUser(response.user)
      return response
    } catch (error) {
      console.error('Login error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Logout function
  const logout = useCallback(async () => {
    try {
      performLogout()
      setUser(null)
    } catch (error) {
      console.error('Logout error:', error)
      // Still clear local state even if API call fails
      removeAuthToken()
      setUser(null)
    }
  }, [])

  // Refresh token function - only called when we have a valid refresh token
  const refreshToken = useCallback(async () => {
    // We use JWT access tokens stored in cookies only - no refresh token stored
    // Just re-verify the current token silently
    try {
      const token = getAuthToken()
      if (!token || isTokenExpired(token)) {
        await logout()
        return
      }
      const verifyResponse = await authApi.verify()
      setUser(verifyResponse.user)
    } catch {
      // Token invalid - logout silently
      await logout()
    }
  }, [logout])

  // Permission checking functions
  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false
    return checkPermission(user.role, permission)
  }, [user])

  const hasRole = useCallback((roles: UserRole | UserRole[]): boolean => {
    if (!user) return false
    const roleArray = Array.isArray(roles) ? roles : [roles]
    return checkRole(user.role, roleArray)
  }, [user])

  // Check if user is approved
  const isApproved = user?.isApproved || false

  // Initialize auth on mount
  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  // Set up token expiry check interval
  useEffect(() => {
    if (!user) return

    const checkTokenExpiry = async () => {
      const token = getAuthToken()
      if (!token || isTokenExpired(token)) {
        // Token expired - logout
        await logout()
        return
      }
      // Token still valid - no action needed (JWT access tokens can't be refreshed without refresh token)
    }

    const interval = setInterval(checkTokenExpiry, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [user, logout])

  const contextValue: AuthContextValue = {
    user,
    loading,
    login,
    logout,
    refreshToken,
    hasPermission,
    hasRole,
    isApproved,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

function ApprovalRedirect({ email }: { email: string }) {
  useEffect(() => {
    window.location.href = `/approval-pending?email=${encodeURIComponent(email)}`
  }, [email])
  return null
}

// Higher-order component for authentication
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    requiredRoles?: UserRole[]
    requiredPermissions?: string[]
    requireApproval?: boolean
  }
) {
  return function AuthenticatedComponent(props: P) {
    const { user, loading, hasRole, hasPermission, isApproved } = useAuth()

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="loading-spinner"></div>
        </div>
      )
    }

    if (!user) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-4">Please log in to access this page.</p>
            <a
              href="/login"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Go to Login
            </a>
          </div>
        </div>
      )
    }

    if (options?.requireApproval !== false && !isApproved) {
      return <ApprovalRedirect email={user.email} />
    }

    if (options?.requiredRoles && !hasRole(options.requiredRoles)) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
            <a
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      )
    }

    if (options?.requiredPermissions) {
      const hasAnyPermission = options.requiredPermissions.some(permission =>
        hasPermission(permission)
      )

      if (!hasAnyPermission) {
        return (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Insufficient Permissions</h2>
              <p className="text-gray-600 mb-4">You don't have the required permissions to access this page.</p>
              <a
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        )
      }
    }

    return <Component {...props} />
  }
}