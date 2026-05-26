'use client'

import { useEffect, useState } from 'react'
import { ProtectedRoute } from '../../components/auth/ProtectedRoute'
import { MainLayout } from '../../components/layout/MainLayout'
import { useAlert } from '../../components/ui/Alert'
import { UserRole } from '../../types'
import { authApi } from '../../utils/api'
import { Users, Clock, CheckCircle, Pencil, X, Check } from 'lucide-react'

// Backend returns snake_case
interface RawUser {
  id: number
  email: string
  role: string
  is_approved: boolean
  date_joined?: string
  created_at?: string
  last_login?: string
  profile?: { first_name?: string; last_name?: string; phone?: string; avatar_url?: string }
}

export default function UsersPage() {
  return (
    <ProtectedRoute requireApproval={true}>
      <MainLayout title="User Management" subtitle="Manage user accounts and permissions">
        <UsersContent />
      </MainLayout>
    </ProtectedRoute>
  )
}

const ROLES = Object.values(UserRole)

const roleBadgeColor: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800',
  OPERATIONS: 'bg-blue-100 text-blue-800',
  CASHIER: 'bg-green-100 text-green-800',
  DELIVERY: 'bg-yellow-100 text-yellow-800',
  CUSTOMER: 'bg-gray-100 text-gray-800',
}

function formatDate(val?: string) {
  if (!val) return 'N/A'
  const d = new Date(val)
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function EditModal({ user, onClose, onSave }: { user: RawUser; onClose: () => void; onSave: (role: string) => Promise<void> }) {
  const [role, setRole] = useState(user.role)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(role) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Read-only fields */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{user.email}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
              {user.profile?.first_name && user.profile?.last_name
                ? `${user.profile.first_name} ${user.profile.last_name}`
                : 'No name'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Joined</label>
            <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{formatDate(user.date_joined ?? user.created_at)}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <p className="text-sm bg-gray-50 px-3 py-2 rounded-md">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${user.is_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {user.is_approved ? 'Approved' : 'Pending'}
              </span>
            </p>
          </div>
          {/* Editable role */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Role *</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 justify-end px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving ? <div className="loading-spinner h-4 w-4" /> : <Check className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

function UsersContent() {
  const { alert, confirm, AlertComponent } = useAlert()
  const [users, setUsers] = useState<RawUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingUser, setEditingUser] = useState<RawUser | null>(null)

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await authApi.getUsers() as RawUser[]
      setUsers(data)
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (user: RawUser) => {
    try {
      await authApi.approveUser(user.id, user.role)
      // Optimistically update
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_approved: true } : u))
      alert('User approved successfully', undefined, 'success')
    } catch (err: unknown) {
      alert('Approval Failed', err instanceof Error ? err.message : 'Failed to approve user', 'error')
    }
  }

  const handleReject = async (userId: number) => {
    const ok = await confirm('Reject User', 'Are you sure? This will permanently remove the user.')
    if (!ok) return
    try {
      await authApi.rejectUser(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
      alert('User rejected and removed', undefined, 'success')
    } catch (err: unknown) {
      alert('Rejection Failed', err instanceof Error ? err.message : 'Failed to reject user', 'error')
    }
  }

  const handleSaveEdit = async (role: string) => {
    if (!editingUser) return
    try {
      await authApi.approveUser(editingUser.id, role)
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, role, is_approved: true } : u))
      setEditingUser(null)
      alert('User updated successfully', undefined, 'success')
    } catch (err: unknown) {
      alert('Update Failed', err instanceof Error ? err.message : 'Failed to update user', 'error')
    }
  }

  const filteredUsers = users.filter(user => {
    if (filter === 'pending' && user.is_approved) return false
    if (filter === 'approved' && !user.is_approved) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return user.email.toLowerCase().includes(q) ||
        user.profile?.first_name?.toLowerCase().includes(q) ||
        user.profile?.last_name?.toLowerCase().includes(q) ||
        user.role.toLowerCase().includes(q)
    }
    return true
  })

  const pendingCount = users.filter(u => !u.is_approved).length
  const approvedCount = users.filter(u => u.is_approved).length

  if (loading) return <div className="flex items-center justify-center h-64"><div className="loading-spinner h-8 w-8" /></div>
  if (error) return (
    <div className="text-center py-16">
      <p className="text-red-600 mb-4">{error}</p>
      <button onClick={loadUsers} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Retry</button>
    </div>
  )

  return (
    <div className="space-y-6">
      {AlertComponent}
      {editingUser && <EditModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleSaveEdit} />}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: users.length, icon: <Users className="w-5 h-5 text-white" />, color: 'bg-blue-500' },
          { label: 'Pending', value: pendingCount, icon: <Clock className="w-5 h-5 text-white" />, color: 'bg-yellow-500' },
          { label: 'Approved', value: approvedCount, icon: <CheckCircle className="w-5 h-5 text-white" />, color: 'bg-green-500' },
        ].map(s => (
          <div key={s.label} className="bg-white shadow rounded-lg p-4 flex items-center gap-4">
            <div className={`w-10 h-10 ${s.color} rounded-md flex items-center justify-center flex-shrink-0`}>{s.icon}</div>
            <div>
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="text-xl font-semibold text-gray-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'approved'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {f} ({f === 'all' ? users.length : f === 'pending' ? pendingCount : approvedCount})
            </button>
          ))}
        </div>
        <input type="text" placeholder="Search users..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs w-full" />
      </div>

      {/* Cards Grid */}
      {filteredUsers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No users found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUsers.map(user => (
            <div key={user.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user.profile?.first_name && user.profile?.last_name
                        ? `${user.profile.first_name} ${user.profile.last_name}`
                        : 'No name'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </div>
                <button onClick={() => setEditingUser(user)} title="Edit user"
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md flex-shrink-0">
                  <Pencil className="w-4 h-4" />
                </button>
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Role</span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${roleBadgeColor[user.role] ?? 'bg-gray-100 text-gray-800'}`}>{user.role}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Status</span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${user.is_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {user.is_approved ? 'Approved' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Joined</span>
                  <span>{formatDate(user.date_joined ?? user.created_at)}</span>
                </div>
              </div>

              {/* Actions */}
              {!user.is_approved && (
                <div className="flex gap-2 pt-1 border-t border-gray-100">
                  <button onClick={() => handleApprove(user)}
                    className="flex-1 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
                    Approve
                  </button>
                  <button onClick={() => handleReject(user.id)}
                    className="flex-1 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700">
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
