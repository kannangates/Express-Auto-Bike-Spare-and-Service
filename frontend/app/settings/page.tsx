'use client'

import { useState, useEffect, useCallback } from 'react'
import { OwnerRoute } from '../../components/auth/ProtectedRoute'
import { MainLayout } from '../../components/layout/MainLayout'
import { dashboardApi } from '../../utils/api'
import { useOnline } from '../../hooks/useOnline'
import { Check, Loader2 } from 'lucide-react'

interface Settings {
  businessName: string; address: string; city: string; state: string
  pincode: string; phone: string; email: string; gstin: string
  invoicePrefix: string; invoiceStartNumber: string; taxRate: string
  bankName: string; accountNumber: string; ifsc: string; upiId: string
}

const defaults: Settings = {
  businessName: 'Express Auto Spares & Service', address: '64th St, Thiruvalluvar Colony, Santhiniketan Colony, Sector 10, K. K. Nagar', city: 'Chennai', state: 'Tamil Nadu',
  pincode: '', phone: '9840014848', email: 'expressspares78@gmail.com', gstin: '',
  invoicePrefix: 'INV', invoiceStartNumber: '1001', taxRate: '18',
  bankName: '', accountNumber: '', ifsc: '', upiId: '',
}

function SettingsContent() {
  const [s, setS] = useState<Settings>(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const online = useOnline()

  const load = useCallback(async () => {
    try { setS({ ...defaults, ...await dashboardApi.getSettings() }) }
    catch { /* use defaults */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const set = (k: keyof Settings, v: string) => setS(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      await dashboardApi.saveSettings(s as unknown as Record<string, string>)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally { setSaving(false) }
  }

  const inp = (label: string, key: keyof Settings, placeholder = '', type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={s[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white shadow rounded-lg p-6 space-y-5">
        <div><h3 className="text-base font-semibold text-gray-900">Business Information</h3><p className="text-xs text-gray-500 mt-0.5">Appears on all invoices and receipts.</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {inp('Business Name *', 'businessName', 'Express Auto Bike')}
          {inp('Phone', 'phone', '+91 98765 43210', 'tel')}
          {inp('Email', 'email', 'info@expressauto.com', 'email')}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
          <textarea value={s.address} onChange={e => set('address', e.target.value)} rows={2} placeholder="Street address, landmark..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {inp('City *', 'city', 'Chennai')}
          {inp('State', 'state', 'Tamil Nadu')}
          {inp('Pincode', 'pincode', '600001')}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 space-y-5">
        <div><h3 className="text-base font-semibold text-gray-900">GST & Invoice Settings</h3><p className="text-xs text-gray-500 mt-0.5">Used for GST-compliant invoice generation and filings.</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
            <input type="text" value={s.gstin} onChange={e => set('gstin', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">15-character GST Identification Number</p>
          </div>
          {inp('GST Rate (%)', 'taxRate', '18', 'number')}
          {inp('Invoice Prefix', 'invoicePrefix', 'INV')}
          {inp('Starting Invoice Number', 'invoiceStartNumber', '1001', 'number')}
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-medium text-blue-900">Invoice Number Preview</p>
          <p className="text-sm text-blue-700 font-mono mt-1">{s.invoicePrefix}-{new Date().getFullYear()}-{s.invoiceStartNumber}</p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 space-y-5">
        <div><h3 className="text-base font-semibold text-gray-900">Bank & Payment Details</h3><p className="text-xs text-gray-500 mt-0.5">Shown on invoices for customer payments.</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {inp('Bank Name', 'bankName', 'State Bank of India')}
          {inp('Account Number', 'accountNumber', '1234567890')}
          {inp('IFSC Code', 'ifsc', 'SBIN0001234')}
          {inp('UPI ID', 'upiId', 'expressauto@upi')}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {!online && <span className="text-sm text-amber-600">Offline — saving disabled</span>}
        {saveError && <span className="text-sm text-red-600">{saveError}</span>}
        {saved && <span className="text-sm text-green-600 flex items-center gap-1"><Check className="w-4 h-4" /> Saved!</span>}
        <button onClick={handleSave} disabled={saving || !online}
          title={!online ? 'You are offline — changes cannot be saved' : ''}
          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 flex items-center gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <OwnerRoute>
      <MainLayout title="Settings" subtitle="Business settings, GST details and invoice configuration">
        <SettingsContent />
      </MainLayout>
    </OwnerRoute>
  )
}
