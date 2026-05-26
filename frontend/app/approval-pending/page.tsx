'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Phone, Clock } from 'lucide-react'

function ApprovalPendingContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [phone, setPhone] = useState('')
  const [phoneSaved, setPhoneSaved] = useState(false)
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) setEmail(emailParam)
    setIsLoading(false)
  }, [searchParams])

  const handleLogout = () => {
    document.cookie.split(';').forEach(c => {
      document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/')
    })
    window.location.href = '/login'
  }

  const handleSavePhone = async () => {
    if (!phone.trim()) { setPhoneError('Please enter your mobile number'); return }
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) { setPhoneError('Enter a valid 10-digit mobile number'); return }
    if (!email) { setPhoneError('Email not found — please try logging in again.'); return }
    setPhoneError('')
    setPhoneSaving(true)
    try {
      // Use the no-auth pending-phone endpoint — unapproved users have no JWT token yet
      const res = await fetch(`/api/v1/auth/pending/phone/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone: phone.trim() }),
      })
      if (res.ok) {
        setPhoneSaved(true)
      } else {
        setPhoneError('Failed to save. Please try again.')
      }
    } catch {
      setPhoneError('Network error. Please try again.')
    } finally {
      setPhoneSaving(false)
    }
  }

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="loading-spinner" />
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-14 w-14 flex items-center justify-center rounded-full bg-yellow-100">
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Approval Pending</h2>
          <p className="mt-1 text-sm text-gray-500">Your account is waiting for administrator approval</p>
        </div>

        {/* Status card */}
        <div className="bg-white shadow rounded-xl p-6 space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="text-gray-900 font-medium">{email || 'Not provided'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>
            </div>
          </div>

          {/* Phone number section */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="w-4 h-4 text-gray-500" />
              <h4 className="text-sm font-medium text-gray-900">Add your mobile number</h4>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Your mobile number helps us link your orders and send updates. You can add it now or later.
            </p>
            {phoneSaved ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <span className="text-green-700 text-sm">✓ Mobile number saved: {phone}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => { setPhone(e.target.value); setPhoneError('') }}
                      placeholder="+91 98765 43210"
                      className={`pl-9 pr-3 py-2 w-full border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${phoneError ? 'border-red-300' : 'border-gray-300'}`}
                    />
                  </div>
                  <button onClick={handleSavePhone} disabled={phoneSaving}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                    {phoneSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
                {phoneError && <p className="text-xs text-red-600">{phoneError}</p>}
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">What&apos;s next?</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Administrator will review your account</li>
              <li>• You&apos;ll receive an email notification when approved</li>
              <li>• Orders placed with your mobile number will be linked automatically</li>
            </ul>
          </div>
        </div>

        <button onClick={handleLogout}
          className="w-full flex justify-center items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700">
          Logout
        </button>

        <p className="text-center text-xs text-gray-400">Express Auto Bike Management System</p>
      </div>
    </div>
  )
}

export default function ApprovalPendingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner" /></div>}>
      <ApprovalPendingContent />
    </Suspense>
  )
}
