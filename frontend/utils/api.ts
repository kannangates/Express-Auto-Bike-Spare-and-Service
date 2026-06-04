import { getAuthToken, refreshTokenIfNeeded, logout } from './auth'
import { setCacheEntry, getCacheEntry } from './offline-db'

// API base URL strategy:
//  - Browser  → '' (empty) so every /api/... call goes through the Next.js rewrite
//              proxy defined in next.config.js, keeping the Django port off the network.
//  - SSR / Node.js (middleware, server components) → absolute URL because Node's fetch
//              does not accept bare-path URLs.
const API_BASE_URL =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    : ''

// Custom error class for API errors
export class ApiException extends Error {
  public status: number
  public data: any

  constructor(message: string, status: number, data?: any) {
    super(message)
    this.name = 'ApiException'
    this.status = status
    this.data = data
  }
}

// Detect a network-failure error thrown by api.ts. Status 0 = offline / unreachable.
export function isOfflineError(err: unknown): boolean {
  return err instanceof ApiException && err.status === 0
}

// Request interceptor to add auth token and handle token refresh
const createAuthHeaders = async (): Promise<HeadersInit> => {
  await refreshTokenIfNeeded()
  const token = getAuthToken()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}

// Generic API request function
async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const isRead = method === 'GET'
  const cacheKey = endpoint

  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`

    const headers = await createAuthHeaders()

    const config: RequestInit = {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    }

    const response = await fetch(url, config)

    // Handle different response types
    let data: any
    const contentType = response.headers.get('content-type')

    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    // Handle error responses
    if (!response.ok) {
      if (response.status === 401) {
        logout()
        throw new ApiException('Authentication required', 401, data)
      }

      if (response.status === 403) {
        throw new ApiException('Access denied', 403, data)
      }

      const errorMessage = data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`
      throw new ApiException(errorMessage, response.status, data)
    }

    // Cache successful GET responses for offline use
    if (isRead) {
      setCacheEntry(cacheKey, data)
    }

    return data
  } catch (error) {
    if (error instanceof ApiException) {
      throw error
    }

    // Network failure — serve cached data for reads
    if (isRead) {
      const cached = await getCacheEntry<T>(cacheKey)
      if (cached !== null) {
        console.warn(`Offline: serving cached data for ${endpoint}`)
        return cached
      }
    }

    console.error('API request failed:', error)
    throw new ApiException(
      isRead
        ? 'You are offline and no cached data is available for this page'
        : 'You are offline. Please reconnect to perform this action',
      0,
      error
    )
  }
}

// HTTP method helpers
export const api = {
  get: <T = any>(endpoint: string, params?: Record<string, any>): Promise<T> => {
    // Avoid new URL() — it requires an absolute href in Node.js and would throw
    // when API_BASE_URL is '' (browser/proxy mode). URLSearchParams + string concat
    // works identically in both environments.
    const base = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`

    if (params) {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          qs.append(key, String(value))
        }
      })
      const queryString = qs.toString()
      return apiRequest<T>(queryString ? `${base}?${queryString}` : base, { method: 'GET' })
    }

    return apiRequest<T>(base, { method: 'GET' })
  },

  post: <T = any>(endpoint: string, data?: any): Promise<T> => {
    return apiRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  put: <T = any>(endpoint: string, data?: any): Promise<T> => {
    return apiRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  patch: <T = any>(endpoint: string, data?: any): Promise<T> => {
    return apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  delete: <T = any>(endpoint: string): Promise<T> => {
    return apiRequest<T>(endpoint, { method: 'DELETE' })
  },

  upload: <T = any>(endpoint: string, formData: FormData): Promise<T> => {
    return apiRequest<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData, let browser set it with boundary
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    })
  },
}

// Specific API endpoints
export const authApi = {
  verify: () => api.get<{ user: any }>('/api/v1/auth/token/verify/'),
  refresh: () => api.post<{ access_token: string }>('/api/v1/auth/token/refresh/'),
  googleCallback: (data: { code: string; state?: string; redirect_uri: string }) =>
    api.post<{ access_token: string; user: any }>('/api/v1/auth/google/callback/', data),
  getUsers: () => api.get<any[]>('/api/v1/auth/users/'),
  getUser: (id: number) => api.get<any>(`/api/v1/auth/users/${id}/`),
  approveUser: (id: number, role?: string) => api.post(`/api/v1/auth/users/${id}/approve/`, role ? { role } : undefined),
  rejectUser: (id: number) => api.post(`/api/v1/auth/users/${id}/reject/`),
  updateUser: (id: number, data: any) => api.patch(`/api/v1/auth/users/${id}/`, data),
}

export const inventoryApi = {
  list: (params?: { search?: string; category?: number; page?: number; page_size?: number }) =>
    api.get('/api/v1/inventory/items/', params),
  get: (id: number) => api.get(`/api/v1/inventory/items/${id}/`),
  create: (data: unknown) => api.post('/api/v1/inventory/items/', data),
  update: (id: number, data: unknown) => api.patch(`/api/v1/inventory/items/${id}/`, data),
  delete: (id: number) => api.delete(`/api/v1/inventory/items/${id}/`),
  lowStock: () => api.get('/api/v1/inventory/items/low_stock/'),
  categories: () => api.get('/api/v1/inventory/categories/'),
  bulkUpdate: (data: unknown[]) => api.post('/api/v1/inventory/bulk-operations/', { items: data }),
}

export const orderApi = {
  list: (params?: { status?: string; customer?: number; search?: string; page?: number; page_size?: number }) =>
    api.get('/api/v1/orders/orders/', params),
  get: (id: number) => api.get(`/api/v1/orders/orders/${id}/`),
  create: (data: unknown) => api.post('/api/v1/orders/orders/', data),
  update: (id: number, data: unknown) => api.patch(`/api/v1/orders/orders/${id}/`, data),
  cancel: (id: number) => api.post(`/api/v1/orders/orders/${id}/cancel/`),
  complete: (id: number) => api.post(`/api/v1/orders/orders/${id}/complete/`),
}

export const returnApi = {
  list: (params?: { status?: string; customer?: number; search?: string; page?: number; page_size?: number }) =>
    api.get('/api/v1/returns/returns/', params),
  get: (id: number) => api.get(`/api/v1/returns/returns/${id}/`),
  create: (data: unknown) => api.post('/api/v1/returns/returns/', data),
  approve: (id: number) => api.post(`/api/v1/returns/returns/${id}/approve/`),
  reject: (id: number, reason?: string) => api.post(`/api/v1/returns/returns/${id}/reject/`, { reason }),
  process: (id: number) => api.post(`/api/v1/returns/returns/${id}/process/`),
}

export const creditApi = {
  getBalance: (customerId: number) => api.get(`/api/v1/credit/${customerId}/balance/`),
  getTransactions: (customerId: number, params?: { page?: number; page_size?: number }) =>
    api.get(`/api/v1/credit/${customerId}/transactions/`, params),
  addCredit: (customerId: number, amount: number, description?: string) =>
    api.post(`/api/v1/credit/${customerId}/add/`, { amount, description }),
}

export const dashboardApi = {
  getStats: (params?: { start_date?: string; end_date?: string; days?: number }) =>
    api.get('/api/v1/dashboard/stats/', params),
  getRecentActivity: (params?: { limit?: number; hours?: number }) =>
    api.get('/api/v1/dashboard/activity/', params),
  getSettings: () => api.get<Record<string, string>>('/api/v1/dashboard/settings/'),
  saveSettings: (data: Record<string, string>) => api.post<Record<string, string>>('/api/v1/dashboard/settings/', data),
}

export const reportApi = {
  sales: (params: { start_date: string; end_date: string; format?: 'json' | 'pdf' | 'excel' | 'csv' }) =>
    api.get('/api/v1/reports/sales/', params),
  inventory: (params: { format?: 'json' | 'pdf' | 'excel' | 'csv' }) =>
    api.get('/api/v1/reports/inventory/', params),
  customers: (params: { format?: 'json' | 'pdf' | 'excel' | 'csv' }) =>
    api.get('/api/v1/reports/customers/', params),
  returns: (params: { start_date: string; end_date: string; format?: 'json' | 'pdf' | 'excel' | 'csv' }) =>
    api.get('/api/v1/reports/returns/', params),
  export: (reportType: string, params: { format: 'pdf' | 'excel' | 'csv' | 'json';[key: string]: any }) =>
    api.get(`/api/v1/reports/export/${reportType}/`, params),
  bulkExport: (reports: Array<{ type: string; format: string; filters?: any }>) =>
    api.post('/api/v1/reports/export/bulk/', { reports }),
  exportProgress: (exportId: string) =>
    api.get(`/api/v1/reports/export/progress/${exportId}/`),
}

export const userApi = {
  list: (params?: { role?: string; is_approved?: boolean; page?: number; page_size?: number }) =>
    api.get('/api/v1/auth/users/', params),
  get: (id: number) => api.get(`/api/v1/auth/users/${id}/`),
  approve: (id: number) => api.post(`/api/v1/auth/users/${id}/approve/`),
  reject: (id: number, reason?: string) => api.post(`/api/v1/auth/users/${id}/reject/`, { reason }),
  updateRole: (id: number, role: string) => api.patch(`/api/v1/auth/users/${id}/`, { role }),
}

export const notificationApi = {
  list: (params?: { is_read?: boolean; type?: string; page?: number; page_size?: number }) =>
    api.get('/api/v1/notifications/', params),
  markAsRead: (id: number) => api.patch(`/api/v1/notifications/${id}/`, { is_read: true }),
  markAllAsRead: () => api.post('/api/v1/notifications/mark-all-read/'),
}

// Utility functions for handling API responses
export const handleApiError = (error: any): string => {
  if (error instanceof ApiException) {
    if (error.data?.errors) {
      // Handle validation errors
      const errors = error.data.errors
      return Object.values(errors).flat().join(', ')
    }
    return error.message
  }

  return 'An unexpected error occurred'
}

export const isNetworkError = (error: any): boolean => {
  return error instanceof ApiException && error.status === 0
}

// NOTE: API response caching removed — all data is fetched fresh from PostgreSQL.
// The previous localStorage-based cache functions (cacheApiResponse, getCachedApiResponse,
// clearApiCache) have been deleted. If offline support is needed in future, use a
// service-worker cache or IndexedDB, not localStorage.

/**
 * Normalise a paginated or direct-array API response to a plain array.
 * Use instead of the inline Array.isArray(data) ? data : data.results ?? [] pattern.
 */
export function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && 'results' in data) {
    return ((data as { results?: T[] }).results) ?? []
  }
  return []
}