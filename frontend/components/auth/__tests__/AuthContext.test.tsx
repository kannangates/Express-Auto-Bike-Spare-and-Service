import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../../contexts/AuthContext'

// Mock the API utilities
jest.mock('../../../utils/api', () => ({
  authApi: {
    verify: jest.fn(),
    googleCallback: jest.fn(),
    refresh: jest.fn(),
  },
}))

// Mock the auth utilities
jest.mock('../../../utils/auth', () => ({
  getAuthToken: jest.fn(),
  removeAuthToken: jest.fn(),
  getUserFromToken: jest.fn(),
  isTokenExpired: jest.fn(),
  hasRole: jest.fn(),
  hasPermission: jest.fn(),
  logout: jest.fn(),
}))

// Test component that uses the auth context
function TestComponent() {
  const { user, loading, hasRole, hasPermission } = useAuth()

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <div data-testid="user-email">{user?.email || 'No user'}</div>
      <div data-testid="has-owner-role">{hasRole(['OWNER']) ? 'true' : 'false'}</div>
      <div data-testid="has-admin-permission">{hasPermission('django_admin') ? 'true' : 'false'}</div>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should provide authentication context', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuthToken, getUserFromToken, isTokenExpired } = require('../../../utils/auth')

    getAuthToken.mockReturnValue('mock-token')
    isTokenExpired.mockReturnValue(false)
    getUserFromToken.mockReturnValue({
      id: 1,
      email: 'test@example.com',
      role: 'OWNER',
      isApproved: true,
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Should show loading initially
    expect(screen.getByText('Loading...')).toBeInTheDocument()

    // Wait for auth initialization
    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com')
    })
  })

  it('should handle no authentication token', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuthToken } = require('../../../utils/auth')

    getAuthToken.mockReturnValue(null)

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('No user')
    })
  })

  it('should handle role and permission checks', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuthToken, getUserFromToken, isTokenExpired, hasRole, hasPermission } = require('../../../utils/auth')

    getAuthToken.mockReturnValue('mock-token')
    isTokenExpired.mockReturnValue(false)
    getUserFromToken.mockReturnValue({
      id: 1,
      email: 'test@example.com',
      role: 'OWNER',
      isApproved: true,
    })
    hasRole.mockReturnValue(true)
    hasPermission.mockReturnValue(true)

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('has-owner-role')).toHaveTextContent('true')
      expect(screen.getByTestId('has-admin-permission')).toHaveTextContent('true')
    })
  })
})