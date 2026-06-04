'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../../contexts/AuthContext'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if we received tokens directly (from approved user).
        // Tokens may arrive in the URL fragment (#access&refresh) — preferred because
        // fragments are not sent to servers and don't appear in access logs or Referer
        // headers. Fall back to query params for backward compatibility.
        let accessToken: string | null = null
        let refreshToken: string | null = null

        const hash = window.location.hash.slice(1) // strip leading '#'
        if (hash) {
          // Backend sends #access_token=TOKEN&refresh_token=TOKEN — parse with URLSearchParams
          const hashParams = new URLSearchParams(hash)
          accessToken = hashParams.get('access_token')
          refreshToken = hashParams.get('refresh_token')
        }

        if (!accessToken || !refreshToken) {
          accessToken = searchParams.get('access_token')
          refreshToken = searchParams.get('refresh_token')
        }

        // Clear tokens from URL so they don't linger in browser history
        if (accessToken && refreshToken) {
          history.replaceState({}, '', window.location.pathname)
        }

        if (accessToken && refreshToken) {
          // Clear any existing tokens first
          document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
          document.cookie = 'refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'

          // Store new tokens using consistent cookie settings
          document.cookie = `auth-token=${accessToken}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`
          document.cookie = `refresh-token=${refreshToken}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`

          setStatus('success')
          setMessage('Authentication successful! Redirecting...')

          // Force a hard redirect to ensure cookies are picked up
          setTimeout(() => {
            window.location.href = '/dashboard'
          }, 1000)
          return
        }

        // Otherwise, handle authorization code flow
        const code = searchParams.get('code')
        const error = searchParams.get('error')
        const state = searchParams.get('state')

        if (error) {
          setStatus('error')
          setMessage(`Authentication failed: ${error}`)
          return
        }

        if (!code) {
          setStatus('error')
          setMessage('No authorization code received')
          return
        }

        // Use the login function from auth context
        const response = await login({
          code,
          state: state || undefined,
          redirectUri: window.location.origin + '/auth/callback'
        })

        setStatus('success')
        setMessage('Authentication successful! Redirecting...')

        // Check if user is approved
        if (!response.user.isApproved) {
          setTimeout(() => {
            window.location.href = '/approval-pending'
          }, 1000)
          return
        }

        // Redirect to appropriate dashboard based on role using hard redirect
        setTimeout(() => {
          switch (response.user.role) {
            case 'OWNER':
              window.location.href = '/dashboard'
              break
            case 'OPERATIONS':
              window.location.href = '/inventory'
              break
            case 'CASHIER':
              window.location.href = '/orders'
              break
            case 'DELIVERY':
              window.location.href = '/orders'
              break
            case 'CUSTOMER':
              window.location.href = '/orders'
              break
            default:
              window.location.href = '/dashboard'
          }
        }, 1000)

      } catch (error) {
        console.error('Auth callback error:', error)
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'An unexpected error occurred during authentication')
      }
    }

    handleCallback()
  }, [router, searchParams, login])

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <div className="loading-spinner h-12 w-12 mx-auto"></div>
      case 'success':
        return (
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'error':
        return (
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'text-blue-600'
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {getStatusIcon()}
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {status === 'loading' && 'Authenticating...'}
            {status === 'success' && 'Welcome!'}
            {status === 'error' && 'Authentication Failed'}
          </h2>
          <p className={`mt-2 text-sm ${getStatusColor()}`}>
            {message}
          </p>
        </div>

        {status === 'error' && (
          <div className="mt-8">
            <button
              onClick={() => router.push('/login')}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}