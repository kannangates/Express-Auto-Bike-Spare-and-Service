'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { useAuth } from '../../contexts/AuthContext'
import { getRoleDisplayName, getRoleColor } from '../../utils/auth'

export interface UserProfileProps {
  className?: string
  showLogout?: boolean
  compact?: boolean
}

export function UserProfile({ className = '', showLogout = true, compact = false }: UserProfileProps) {
  const { user, logout, loading } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  if (loading || !user) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-300 rounded w-24"></div>
            <div className="h-3 bg-gray-300 rounded w-16"></div>
          </div>
        </div>
      </div>
    )
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  const displayName = user.profile?.firstName && user.profile?.lastName
    ? `${user.profile.firstName} ${user.profile.lastName}`
    : user.email

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
          <p className={`text-xs px-2 py-1 rounded-full ${getRoleColor(user.role)}`}>
            {getRoleDisplayName(user.role)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="flex items-start space-x-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {user.profile?.avatarUrl ? (
            <Image
              className="rounded-full object-cover"
              src={user.profile.avatarUrl}
              alt={displayName}
              width={64}
              height={64}
            />
          ) : (
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl font-medium">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {displayName}
            </h3>
            {!user.isApproved && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Pending Approval
              </span>
            )}
          </div>

          <div className="mt-1 space-y-2">
            {/* Role */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Role:</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                {getRoleDisplayName(user.role)}
              </span>
            </div>

            {/* Email */}
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-sm text-gray-500 flex-shrink-0">Email:</span>
              <span className="text-sm text-gray-900 truncate">{user.email}</span>
            </div>

            {/* Phone */}
            {user.profile?.phone && (
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-sm text-gray-500 flex-shrink-0">Phone:</span>
                <span className="text-sm text-gray-900 truncate">{user.profile.phone}</span>
              </div>
            )}

            {/* Google ID */}
            {user.googleId && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Google ID:</span>
                <span className="text-sm text-gray-900 font-mono text-xs">
                  {user.googleId.substring(0, 12)}...
                </span>
              </div>
            )}

            {/* Last Login */}
            {user.lastLogin && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Last Login:</span>
                <span className="text-sm text-gray-900">
                  {new Date(user.lastLogin).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          {showLogout && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingOut ? (
                  <>
                    <div className="loading-spinner h-4 w-4 mr-2"></div>
                    Signing out...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Inline header version - shows email, role badge, and logout icon (no dropdown, no avatar)
export function UserProfilePopup({ className = '' }: { className?: string }) {
  const { user, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  if (!user) return null

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try { await logout() } catch { /* ignore */ } finally { setIsLoggingOut(false) }
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Email + Role */}
      <div className="hidden sm:block min-w-0 text-right">
        <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{user.email}</p>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
          {getRoleDisplayName(user.role)}
        </span>
      </div>
      {/* Logout icon - always red */}
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        title="Sign out"
        className="p-1.5 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {isLoggingOut ? (
          <div className="loading-spinner h-5 w-5" />
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        )}
      </button>
    </div>
  )
}