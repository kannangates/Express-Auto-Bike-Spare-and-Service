'use client'

import { useEffect, useState } from 'react'
import { getCacheEntry } from '../../utils/offline-db'

export default function OfflinePage() {
  const [cachedPages, setCachedPages] = useState<string[]>([])

  useEffect(() => {
    async function checkCache() {
      const checks = [
        { key: '/api/v1/inventory/items/', label: 'Inventory' },
        { key: '/api/v1/orders/orders/', label: 'Orders' },
        { key: '/api/v1/returns/returns/', label: 'Returns' },
      ]
      const available: string[] = []
      for (const { key, label } of checks) {
        const cached = await getCacheEntry(key)
        if (cached !== null) available.push(label)
      }
      setCachedPages(available)
    }
    checkCache()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-amber-100">
            <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            You&apos;re Offline
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            No internet connection detected
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              Cached data available
            </h3>
            {cachedPages.length > 0 ? (
              <ul className="text-sm text-gray-600 space-y-1">
                {cachedPages.map((page) => (
                  <li key={page} className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {page} — browse cached data
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">
                No cached data yet. Visit pages while online to make them available offline.
              </p>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Not available offline</h4>
            <ul className="text-sm text-gray-500 space-y-1">
              <li>• Creating or updating orders, returns, inventory</li>
              <li>• Processing payments</li>
              <li>• Real-time stock updates and notifications</li>
            </ul>
          </div>

          <div className="border-t pt-4">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
            >
              Try Again
            </button>
            {cachedPages.length > 0 && (
              <button
                onClick={() => window.history.back()}
                className="w-full mt-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors duration-200"
              >
                Go Back
              </button>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-gray-400">
          <p>Express Auto Bike Management System</p>
        </div>
      </div>
    </div>
  )
}
