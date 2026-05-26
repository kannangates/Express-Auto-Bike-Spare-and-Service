'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OrderRoute } from '../../components/auth/ProtectedRoute';
import { MainLayout } from '../../components/layout/MainLayout';
import { inventoryApi, orderApi, userApi, dashboardApi } from '../../utils/api';
import { X, Plus, Minus, Trash2, Search, ScanBarcode, ShoppingCart, Check, User, Phone, Banknote, CreditCard, Smartphone, ClipboardList, Pencil, Printer } from 'lucide-react';

interface InventoryItemData { id: number; barcode: string; name: string; unit_price: number | string; stock_quantity: number; is_active: boolean }
interface CustomerData { id: number; email: string; role: string; profile?: { first_name?: string; last_name?: string; phone?: string } }
interface OrderLine { item: InventoryItemData; quantity: number }
interface OrderItem { id: number; barcode: string; item_name: string; quantity: number; unit_price: string | number; total_price: string | number }
interface OrderData {
  id: number; order_number: string; status: string; payment_method: string
  total_amount: string | number; subtotal?: string | number; tax_amount?: string | number
  payment_tx_id?: string
  created_at: string; customer?: { email: string; profile?: { first_name?: string; last_name?: string; phone?: string } }
  items?: OrderItem[]
}

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']

const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Cash', icon: <Banknote className="w-5 h-5" />, color: 'bg-green-50 border-green-300 text-green-700' },
  { id: 'CARD', label: 'Card', icon: <CreditCard className="w-5 h-5" />, color: 'bg-blue-50 border-blue-300 text-blue-700' },
  { id: 'UPI', label: 'UPI / Online', icon: <Smartphone className="w-5 h-5" />, color: 'bg-purple-50 border-purple-300 text-purple-700' },
]

// ─── Barcode Scanner ─────────────────────────────────────────────────────────
function BarcodeScanner({ onScan, onClose }: { onScan: (b: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<'requesting' | 'scanning' | 'error'>('requesting')
  const [errorMsg, setErrorMsg] = useState('')
  const [manual, setManual] = useState('')

  const startCamera = useCallback(async () => {
    setStatus('requesting'); setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      setStatus('scanning')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera error'
      setErrorMsg(msg.toLowerCase().includes('denied') ? 'Camera permission denied. Please allow camera access in your browser settings.' : `Camera error: ${msg}`)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    startCamera()
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()) }
  }, [startCamera])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-900">Scan Barcode</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          {status === 'requesting' && <div className="text-center py-8"><div className="loading-spinner h-8 w-8 mx-auto mb-3" /><p className="text-sm text-gray-600">Requesting camera access...</p></div>}
          {status === 'scanning' && <div><video ref={videoRef} className="w-full rounded-lg bg-black" playsInline muted /><p className="text-xs text-gray-500 text-center mt-2">Point camera at barcode</p></div>}
          {status === 'error' && <div className="text-center py-4"><ScanBarcode className="w-10 h-10 text-gray-400 mx-auto mb-2" /><p className="text-sm text-red-600 mb-3">{errorMsg}</p><button onClick={startCamera} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 w-full">Try Again</button></div>}
          <div className="border-t pt-3">
            <p className="text-xs text-gray-500 mb-2">Or enter barcode manually:</p>
            <div className="flex gap-2">
              <input type="text" value={manual} onChange={e => setManual(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && manual.trim()) { onScan(manual.trim()); setManual('') } }}
                placeholder="Type barcode..." autoFocus
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={() => { if (manual.trim()) { onScan(manual.trim()); setManual('') } }} className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Add</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Customer Section ─────────────────────────────────────────────────────────
function CustomerSection({ onSelect }: { onSelect: (c: CustomerData | null, phone: string) => void }) {
  const [phone, setPhone] = useState('')
  const [results, setResults] = useState<CustomerData[]>([])
  const [selected, setSelected] = useState<CustomerData | null>(null)
  const [searching, setSearching] = useState(false)
  const [isWalkIn, setIsWalkIn] = useState(false)

  const searchByPhone = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const data = await userApi.list({ role: 'CUSTOMER' }) as CustomerData[]
      setResults(data.filter(u => u.profile?.phone?.replace(/\D/g, '').includes(q.replace(/\D/g, '')) || u.email.toLowerCase().includes(q.toLowerCase())))
    } catch { setResults([]) }
    finally { setSearching(false) }
  }, [])

  useEffect(() => { const t = setTimeout(() => searchByPhone(phone), 400); return () => clearTimeout(t) }, [phone, searchByPhone])

  const select = (c: CustomerData) => { setSelected(c); setPhone(c.profile?.phone ?? c.email); setResults([]); onSelect(c, c.profile?.phone ?? '') }
  const walkIn = () => { setIsWalkIn(true); setSelected(null); onSelect(null, phone) }
  const clear = () => { setSelected(null); setPhone(''); setIsWalkIn(false); setResults([]); onSelect(null, '') }

  return (
    <div className="border-b pb-3 mb-1">
      <div className="flex items-center gap-2 mb-2">
        <User className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Customer</span>
        {(selected || isWalkIn) && <button onClick={clear} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Clear</button>}
      </div>
      {selected ? (
        <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-2.5">
          <div className="w-7 h-7 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-semibold text-xs">{selected.email.charAt(0).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">{selected.profile?.first_name ? `${selected.profile.first_name} ${selected.profile.last_name ?? ''}` : selected.email}</p>
            {selected.profile?.phone && <p className="text-xs text-gray-500">{selected.profile.phone}</p>}
          </div>
          <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
        </div>
      ) : isWalkIn ? (
        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-2.5">
          <User className="w-4 h-4 text-gray-400" />
          <div><p className="text-sm font-medium text-gray-700">Walk-in</p>{phone && <p className="text-xs text-gray-500">{phone}</p>}</div>
          <Check className="w-4 h-4 text-gray-500 ml-auto flex-shrink-0" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Search by phone or email..."
              className="pl-9 pr-3 py-2 w-full border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {searching && <p className="text-xs text-gray-500 px-1">Searching...</p>}
          {results.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-28 overflow-y-auto">
              {results.map(c => (
                <button key={c.id} onClick={() => select(c)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left border-b last:border-0">
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-medium flex-shrink-0">{c.email.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0"><p className="text-sm text-gray-900 truncate">{c.profile?.first_name ? `${c.profile.first_name} ${c.profile.last_name ?? ''}` : c.email}</p>{c.profile?.phone && <p className="text-xs text-gray-500">{c.profile.phone}</p>}</div>
                </button>
              ))}
            </div>
          )}
          <button onClick={walkIn} className="w-full py-1.5 text-xs text-gray-600 border border-dashed border-gray-300 rounded-md hover:bg-gray-50 flex items-center justify-center gap-2">
            <User className="w-3.5 h-3.5" />{phone ? `Walk-in (${phone})` : 'Continue as walk-in'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Order Modal ──────────────────────────────────────────────────────────────
function OrderModal({ onClose, onOrderPlaced }: { onClose: () => void; onOrderPlaced: () => void }) {
  const [tab, setTab] = useState<'search' | 'barcode'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<InventoryItemData[]>([])
  const [searching, setSearching] = useState(false)
  const [lines, setLines] = useState<OrderLine[]>([])
  const [showScanner, setShowScanner] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeMsg, setBarcodeMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paymentTxId, setPaymentTxId] = useState('')
  const [customer, setCustomer] = useState<{ data: CustomerData | null; phone: string } | null>(null)

  const searchItems = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      const data = await inventoryApi.list({ search: q })
      const list = Array.isArray(data) ? data : (data as { results?: InventoryItemData[] }).results ?? []
      setSearchResults(list.filter((i: InventoryItemData) => i.is_active && i.stock_quantity > 0))
    } catch { setSearchResults([]) }
    finally { setSearching(false) }
  }, [])

  useEffect(() => { const t = setTimeout(() => searchItems(searchQuery), 300); return () => clearTimeout(t) }, [searchQuery, searchItems])

  const addItem = (item: InventoryItemData) => {
    setLines(prev => {
      const ex = prev.find(l => l.item.id === item.id)
      if (ex) return prev.map(l => l.item.id === item.id ? { ...l, quantity: Math.min(l.item.stock_quantity, l.quantity + 1) } : l)
      return [...prev, { item, quantity: 1 }]
    })
  }

  const lookupBarcode = async (barcode: string) => {
    setBarcodeMsg({ text: 'Looking up...', type: 'info' })
    try {
      const data = await inventoryApi.list({ search: barcode })
      const list = Array.isArray(data) ? data : (data as { results?: InventoryItemData[] }).results ?? []
      const item = list.find((i: InventoryItemData) => i.barcode === barcode)
      if (!item) { setBarcodeMsg({ text: `No item found for: ${barcode}`, type: 'error' }); return }
      if (!item.is_active) { setBarcodeMsg({ text: `"${item.name}" is inactive`, type: 'error' }); return }
      if (item.stock_quantity <= 0) { setBarcodeMsg({ text: `"${item.name}" is out of stock`, type: 'error' }); return }
      addItem(item); setBarcodeMsg({ text: `✓ Added: ${item.name}`, type: 'success' }); setBarcodeInput('')
      setTimeout(() => setBarcodeMsg(null), 2000)
    } catch { setBarcodeMsg({ text: 'Failed to look up barcode', type: 'error' }) }
  }

  const total = lines.reduce((s, l) => s + Number(l.item.unit_price) * l.quantity, 0)

  const handlePlaceOrder = async () => {
    if (lines.length === 0) return
    setSubmitting(true)
    setOrderError(null)
    try {
      await orderApi.create({
        customer_id: customer?.data?.id,
        payment_method: paymentMethod,
        payment_tx_id: paymentTxId,
        items: lines.map(l => ({ barcode: l.item.barcode, quantity: l.quantity }))
      })
      onOrderPlaced()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create order. Please try again.'
      setOrderError(msg)
      setSubmitting(false)
    }
  }

  return (
    <>
      {showScanner && <BarcodeScanner onScan={bc => { setShowScanner(false); lookupBarcode(bc) }} onClose={() => setShowScanner(false)} />}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-900">Create New Order</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left: Item selection */}
            <div className="flex-1 flex flex-col border-r overflow-hidden">
              <div className="p-4 flex-shrink-0">
                <CustomerSection onSelect={(data, phone) => setCustomer(data || phone ? { data, phone } : null)} />
              </div>
              <div className="flex border-b flex-shrink-0">
                {(['search', 'barcode'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                    {t === 'search' ? <><Search className="w-4 h-4" />Search</> : <><ScanBarcode className="w-4 h-4" />Barcode</>}
                  </button>
                ))}
              </div>
              {tab === 'search' && (
                <div className="flex flex-col flex-1 overflow-hidden p-4">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Search items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus
                      className="pl-9 pr-3 py-2 w-full border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1">
                    {searching && <p className="text-sm text-gray-500 text-center py-4">Searching...</p>}
                    {!searching && searchQuery && searchResults.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No active items found</p>}
                    {!searching && !searchQuery && <p className="text-sm text-gray-400 text-center py-8">Type to search inventory items</p>}
                    {searchResults.map(item => (
                      <button key={item.id} onClick={() => addItem(item)}
                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 text-left transition-colors">
                        <div className="min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{item.name}</p><p className="text-xs text-gray-500">{item.barcode} · {item.stock_quantity} in stock</p></div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2"><span className="text-sm font-semibold text-gray-900">₹{Number(item.unit_price).toLocaleString('en-IN')}</span><Plus className="w-4 h-4 text-blue-600" /></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {tab === 'barcode' && (
                <div className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input type="text" value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && barcodeInput.trim()) lookupBarcode(barcodeInput.trim()) }}
                        placeholder="Enter or scan barcode..." autoFocus
                        className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <button onClick={() => setShowScanner(true)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"><ScanBarcode className="w-5 h-5" /></button>
                    </div>
                    <button onClick={() => { if (barcodeInput.trim()) lookupBarcode(barcodeInput.trim()) }} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Add</button>
                  </div>
                  {barcodeMsg && (
                    <div className={`px-3 py-2 rounded-md text-sm ${barcodeMsg.type === 'success' ? 'bg-green-50 text-green-800' : barcodeMsg.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>{barcodeMsg.text}</div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Summary and Payment */}
            <div className="w-80 flex flex-col flex-shrink-0 overflow-hidden">
              <div className="px-4 py-3 border-b flex-shrink-0"><h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Items ({lines.length})</h4></div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {lines.length === 0 ? <p className="text-xs text-gray-400 text-center py-8">No items added yet</p>
                  : lines.map(line => (
                    <div key={line.item.id} className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs font-medium text-gray-900 truncate">{line.item.name}</p>
                      <p className="text-xs text-gray-500">₹{Number(line.item.unit_price).toLocaleString('en-IN')}</p>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setLines(p => p.map(l => l.item.id === line.item.id ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l))} className="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                          <span className="text-xs font-medium w-6 text-center">{line.quantity}</span>
                          <button onClick={() => setLines(p => p.map(l => l.item.id === line.item.id ? { ...l, quantity: Math.min(l.item.stock_quantity, l.quantity + 1) } : l))} className="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold">₹{(Number(line.item.unit_price) * line.quantity).toLocaleString('en-IN')}</span>
                          <button onClick={() => setLines(p => p.filter(l => l.item.id !== line.item.id))} className="text-red-400 hover:text-red-600 ml-1"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Order Summary, Payment Method, and TX ID */}
              {lines.length > 0 && (
                <div className="p-3 border-t flex-shrink-0 space-y-3 overflow-y-auto">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Order Summary</p>
                    <p className="text-xl font-bold text-gray-900">₹{total.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-gray-500 mt-1">{lines.length} item(s) · {lines.reduce((s, l) => s + l.quantity, 0)} units</p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-2">How is the customer paying?</p>
                    <div className="grid grid-cols-3 gap-2">
                      {PAYMENT_METHODS.map(pm => (
                        <button key={pm.id} onClick={() => setPaymentMethod(pm.id)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all text-xs ${paymentMethod === pm.id ? pm.color + ' border-current' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}>
                          {pm.icon}
                          <span className="font-medium">{pm.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Payment TX ID</label>
                    <input type="text" value={paymentTxId} onChange={e => setPaymentTxId(e.target.value)}
                      placeholder={paymentMethod === 'CASH' ? 'Receipt #' : paymentMethod === 'CARD' ? 'TXN123456' : 'UPI ref'}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <p className="text-xs text-gray-500 mt-0.5">Optional</p>
                  </div>

                  {orderError && (
                    <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">{orderError}</div>
                  )}

                  <button onClick={handlePlaceOrder} disabled={submitting}
                    className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
                    {submitting ? <div className="loading-spinner h-4 w-4" /> : <Check className="w-4 h-4" />}
                    Confirm Order
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Invoice Print ────────────────────────────────────────────────────────────
async function printInvoice(order: OrderData) {
  // Fetch settings from backend
  let bizSettings: Record<string, string> = {}
  try { bizSettings = await dashboardApi.getSettings() } catch { /* use defaults */ }

  // If order has no items, fetch detail first
  let fullOrder = order
  if (!order.items || order.items.length === 0) {
    try { fullOrder = await orderApi.get(order.id) as OrderData } catch { /* use what we have */ }
  }

  const bizName = bizSettings.businessName || 'Express Auto Bike'
  const address = [bizSettings.address, bizSettings.city, bizSettings.state, bizSettings.pincode].filter(Boolean).join(', ')
  const gstin = bizSettings.gstin || ''
  const taxRate = Number(bizSettings.taxRate || 18)
  const prefix = bizSettings.invoicePrefix || 'INV'
  const invoiceNo = `${prefix}-${new Date(fullOrder.created_at).getFullYear()}-${fullOrder.id.toString().padStart(4, '0')}`
  const total = Number(fullOrder.total_amount)
  const tax = Number(fullOrder.tax_amount ?? (total * taxRate / (100 + taxRate)).toFixed(2))
  const subtotalBeforeTax = total - tax
  const customerName = fullOrder.customer?.profile?.first_name
    ? `${fullOrder.customer.profile.first_name} ${fullOrder.customer.profile.last_name ?? ''}`
    : fullOrder.customer?.email ?? 'Walk-in Customer'

  const itemRows = (fullOrder.items ?? []).map(i =>
    `<tr><td>${i.item_name}</td><td>${i.barcode}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">₹${Number(i.unit_price).toLocaleString('en-IN')}</td><td style="text-align:right">₹${Number(i.total_price).toLocaleString('en-IN')}</td></tr>`
  ).join('') || '<tr><td colspan="5" style="text-align:center;color:#999">No item details available</td></tr>'

  const html = `<!DOCTYPE html><html><head><title>Invoice ${invoiceNo}</title>
  <style>body{font-family:Arial,sans-serif;font-size:13px;color:#111;margin:0;padding:20px}
  .header{display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:16px}
  .biz{font-size:18px;font-weight:bold}.inv-title{font-size:22px;font-weight:bold;color:#1d4ed8}
  table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#f3f4f6;padding:8px;text-align:left;border:1px solid #ddd;font-size:12px}
  td{padding:8px;border:1px solid #ddd;font-size:12px}.totals{margin-left:auto;width:260px}.totals td{border:none;padding:4px 8px}
  .total-row{font-weight:bold;font-size:14px;border-top:2px solid #333}.footer{margin-top:24px;font-size:11px;color:#666;border-top:1px solid #ddd;padding-top:12px}
  @media print{button{display:none}}</style></head>
  <body>
  <div class="header">
    <div><div class="biz">${bizName}</div><div>${address}</div>${gstin ? `<div style="font-size:11px;color:#555">GSTIN: ${gstin}</div>` : ''}<div>${bizSettings.phone || ''}</div></div>
    <div style="text-align:right"><div class="inv-title">TAX INVOICE</div><div><b>Invoice #:</b> ${invoiceNo}</div><div><b>Date:</b> ${new Date(fullOrder.created_at).toLocaleDateString('en-IN')}</div><div><b>Order #:</b> ${fullOrder.order_number}</div></div>
  </div>
  <div style="margin-bottom:16px"><b>Bill To:</b> ${customerName}${fullOrder.customer?.profile?.phone ? ` · ${fullOrder.customer.profile.phone}` : ''}</div>
  <table><thead><tr><th>Item</th><th>Barcode</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>${itemRows}</tbody></table>
  <table class="totals">
    <tr><td>Subtotal (excl. GST)</td><td style="text-align:right">₹${subtotalBeforeTax.toLocaleString('en-IN')}</td></tr>
    <tr><td>GST (${taxRate}%)</td><td style="text-align:right">₹${tax.toLocaleString('en-IN')}</td></tr>
    <tr class="total-row"><td>Total</td><td style="text-align:right">₹${total.toLocaleString('en-IN')}</td></tr>
    <tr><td>Payment</td><td style="text-align:right">${fullOrder.payment_method || '—'}</td></tr>
  </table>
  ${bizSettings.bankName ? `<div class="footer"><b>Bank:</b> ${bizSettings.bankName} | <b>A/C:</b> ${bizSettings.accountNumber} | <b>IFSC:</b> ${bizSettings.ifsc}${bizSettings.upiId ? ` | <b>UPI:</b> ${bizSettings.upiId}` : ''}</div>` : ''}
  <div class="footer">Thank you for your business!</div>
  <script>window.onload=()=>window.print()</script></body></html>`

  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

// ─── Order Edit Modal ─────────────────────────────────────────────────────────
function OrderEditModal({ order, onClose, onSaved }: { order: OrderData; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(order.status)
  const [paymentMethod, setPaymentMethod] = useState(order.payment_method || 'CASH')
  const [paymentTxId, setPaymentTxId] = useState(order.payment_tx_id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      await orderApi.update(order.id, {
        status,
        payment_method: paymentMethod,
        payment_tx_id: paymentTxId
      })
      onSaved(); onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update order')
    }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Order {order.order_number}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* Order items */}
          {order.items && order.items.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Items</p>
              <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
                {order.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2">
                    <div><p className="text-sm text-gray-900">{item.item_name}</p><p className="text-xs text-gray-500">{item.barcode}</p></div>
                    <div className="text-right"><p className="text-sm font-medium">×{item.quantity}</p><p className="text-xs text-gray-500">₹{Number(item.total_price).toLocaleString('en-IN')}</p></div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm font-semibold mt-2 px-1">
                <span>Total</span><span>₹{Number(order.total_amount).toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Order Status</label>
            <div className="grid grid-cols-3 gap-2">
              {ORDER_STATUSES.map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border-2 transition-all ${status === s ? `${statusColors[s]} border-current` : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Payment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(pm => (
                <button key={pm.id} onClick={() => setPaymentMethod(pm.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg border-2 transition-all ${paymentMethod === pm.id ? pm.color + ' border-current' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {pm.icon}<span>{pm.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Payment TX ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Transaction ID</label>
            <input type="text" value={paymentTxId} onChange={e => setPaymentTxId(e.target.value)}
              placeholder="e.g., TXN123456 or UPI ref or Cash receipt #"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-500 mt-1">Card, UPI, or Cash reference number</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
          <button onClick={() => printInvoice(order)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <Printer className="w-4 h-4" /> Print Invoice
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving ? <div className="loading-spinner h-4 w-4" /> : <Check className="w-4 h-4" />} Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', CONFIRMED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-indigo-100 text-indigo-800', SHIPPED: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-800',
}

const OrdersPage: React.FC = () => {
  const searchParams = useSearchParams()
  const [showModal, setShowModal] = useState(false)
  const [orders, setOrders] = useState<OrderData[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [editOrder, setEditOrder] = useState<OrderData | null>(null)

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      const data = await orderApi.list()
      const list = Array.isArray(data) ? data : (data as { results?: OrderData[] }).results ?? []
      setOrders(list)
    } catch (err) {
      console.error('Failed to load orders:', err)
      setOrders([])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'new' || action === 'scan') setShowModal(true)
  }, [searchParams])

  const handleOrderPlaced = () => {
    setToast('Order placed successfully!')
    setTimeout(() => setToast(''), 4000)
    loadOrders()
  }

  const openEdit = async (order: OrderData) => {
    try {
      const detail = await orderApi.get(order.id) as OrderData
      setEditOrder(detail)
    } catch { setEditOrder(order) }
  }

  return (
    <OrderRoute>
      <MainLayout title="Order Processing" subtitle="Process customer orders">
        {showModal && <OrderModal onClose={() => setShowModal(false)} onOrderPlaced={handleOrderPlaced} />}
        {editOrder && <OrderEditModal order={editOrder} onClose={() => setEditOrder(null)} onSaved={() => { loadOrders(); setToast('Order updated!'); setTimeout(() => setToast(''), 3000) }} />}

        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm shadow-lg">
            ✓ {toast}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Create New Order
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="loading-spinner h-8 w-8" /></div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <ShoppingCart className="mx-auto h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Orders Yet</h3>
              <p className="mt-2 text-gray-500 text-sm">Click &quot;Create New Order&quot; to get started.</p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Order #', 'Customer', 'Status', 'Payment', 'Total', 'Date', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{order.order_number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{order.customer?.email ?? 'Walk-in'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] ?? 'bg-gray-100 text-gray-800'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{order.payment_method || '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">₹{Number(order.total_amount).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(order)} title="Edit order"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => printInvoice(order)} title="Print invoice"
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md">
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </MainLayout>
    </OrderRoute>
  )
}

export default function OrdersPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <OrdersPage />
    </Suspense>
  )
}
