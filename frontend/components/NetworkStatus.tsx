'use client'

import { useEffect, useState, useCallback } from 'react'

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [showOnlineMessage, setShowOnlineMessage] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const handleOnline = useCallback(() => {
    setIsOnline(true)
    setDismissed(false)
    setShowOnlineMessage(true)
    setTimeout(() => setShowOnlineMessage(false), 4000)
  }, [])

  const handleOffline = useCallback(() => {
    setIsOnline(false)
    setDismissed(false)
    setShowOnlineMessage(false)
  }, [])

  useEffect(() => {
    setIsOnline(navigator.onLine)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  if (isOnline && !showOnlineMessage) return null

  return (
    <>
      {/* Offline banner — dismissible, no blocking overlay */}
      {!isOnline && !dismissed && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white px-4 py-2.5 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <svg className="w-5 h-5 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
              </svg>
              <div className="min-w-0">
                <p className="font-semibold text-sm">You are offline</p>
                <p className="text-xs text-amber-100">Showing cached data. Writes are disabled until reconnected.</p>
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-white hover:text-amber-100 transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Back online banner */}
      {showOnlineMessage && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-green-600 text-white px-4 py-2.5 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold text-sm">Back online</p>
                <p className="text-xs text-green-100">Connection restored — data will refresh automatically.</p>
              </div>
            </div>
            <button
              onClick={() => setShowOnlineMessage(false)}
              className="text-white hover:text-green-100 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
