'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { OrderRoute } from '../../components/auth/ProtectedRoute';
import { MainLayout } from '../../components/layout/MainLayout';
import { orderApi, returnApi, extractList } from '../../utils/api';
import { useAlert } from '../../components/ui/Alert';
import { Search, RotateCcw, Pencil, Check, X, Plus } from 'lucide-react';

interface OrderItem { id: number; barcode: string; item_name: string; quantity: number; unit_price: string | number; total_price: string | number }
interface OrderDetail { id: number; order_number: string; status: string; total_amount: string | number; payment_method?: string; items: OrderItem[]; customer?: { email: string } }

const RETURN_REASONS = ['Defective Product', 'Wrong Item Received', 'Damaged During Shipping', 'Not as Described', 'Changed Mind', 'Quality Issues', 'Other']
const CONDITIONS = ['NEW', 'USED', 'DAMAGED', 'DEFECTIVE', 'UNKNOWN']
const RESOLUTION = [{ id: 'CREDIT', label: 'Store Credit' }, { id: 'REFUND', label: 'Refund' }, { id: 'EXCHANGE', label: 'Exchange' }]

interface ReturnLine { orderItemId: number; itemName: string; barcode: string; maxQty: number; quantity: number; condition: string; selected: boolean }

function ReturnModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { alert, AlertComponent } = useAlert()
  const [orderInput, setOrderInput] = useState('')
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [looking, setLooking] = useState(false)
  const [lines, setLines] = useState<ReturnLine[]>([])
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [resolution, setResolution] = useState('CREDIT')
  const [submitting, setSubmitting] = useState(false)

  const lookupOrder = useCallback(async () => {
    if (!orderInput.trim()) return
    setLooking(true)
    try {
      const data = await orderApi.list({ search: orderInput.trim() })
      // Require an exact order_number match to avoid loading the wrong order
      const found = extractList<OrderDetail>(data).find((o: OrderDetail) =>
        o.order_number.toLowerCase() === orderInput.trim().toLowerCase()
      )
      if (!found) {
        alert('Order Not Found', `No order found with number "${orderInput.trim()}". Please enter the exact order number (e.g. ORD-2026-0001).`, 'error')
        return
      }
      const full = await orderApi.get(found.id) as OrderDetail
      setOrder(full)
      setLines((full.items ?? []).map(i => ({
        orderItemId: i.id, itemName: i.item_name, barcode: i.barcode,
        maxQty: i.quantity, quantity: i.quantity, condition: 'UNKNOWN', selected: true
      })))
      // Default resolution: store credit for cash payments (no card to refund), refund otherwise
      setResolution(full.payment_method === 'CASH' ? 'CREDIT' : 'REFUND')
    } catch (err) {
      alert('Lookup Failed', `Failed to fetch order: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    } finally { setLooking(false) }
  }, [orderInput, alert])

  const handleSubmit = async () => {
    if (!order) return
    if (!reason) { alert('Missing Reason', 'Please select a return reason.', 'warning'); return }
    const selected = lines.filter(l => l.selected && l.quantity > 0)
    if (selected.length === 0) { alert('No Items', 'Please select at least one item to return.', 'warning'); return }
    const overQty = selected.find(l => l.quantity > l.maxQty)
    if (overQty) { alert('Invalid Quantity', `Return quantity for "${overQty.itemName}" exceeds the original order quantity of ${overQty.maxQty}.`, 'warning'); return }

    setSubmitting(true)
    try {
      await returnApi.create({
        order_id: order.id,
        return_reason: reason,
        return_reason_details: details,
        resolution_method: resolution,
        items: selected.map(l => ({ order_item_id: l.orderItemId, quantity: l.quantity, condition: l.condition }))
      })
      alert('Success', 'Return processed successfully!', 'success')
      onCreated(); onClose()
    } catch (err: unknown) {
      alert('Failed', err instanceof Error ? err.message : 'Failed to create return', 'error')
    } finally { setSubmitting(false) }
  }

  return (
    <>
      {AlertComponent}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-900">Process Return</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Order lookup */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Number *</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={orderInput} onChange={e => setOrderInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') lookupOrder() }}
                    placeholder="e.g. ORD-20260411-0001"
                    className="pl-9 pr-3 py-2 w-full border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={lookupOrder} disabled={looking || !orderInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50">
                  {looking ? 'Looking...' : 'Lookup'}
                </button>
              </div>
            </div>

            {order && (
              <>
                {/* Order info */}
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
                  <span className="font-medium text-green-900">Order found: </span>
                  <span className="text-green-800">{order.order_number} · {order.status} · ₹{Number(order.total_amount).toLocaleString('en-IN')}</span>
                  {order.customer?.email && <span className="text-green-700"> · {order.customer.email}</span>}
                </div>

                {/* Items */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Select Items to Return</p>
                  <div className="space-y-2">
                    {lines.map((line, idx) => (
                      <div key={line.orderItemId} className={`border rounded-lg p-3 ${line.selected ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={line.selected}
                            onChange={e => setLines(p => p.map((l, i) => i === idx ? { ...l, selected: e.target.checked } : l))}
                            className="h-4 w-4 text-blue-600 rounded" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{line.itemName}</p>
                            <p className="text-xs text-gray-500">{line.barcode} · Max: {line.maxQty}</p>
                          </div>
                          {line.selected && (
                            editingIdx === idx ? (
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setLines(p => p.map((l, i) => i === idx ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l))}
                                    className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xs">−</button>
                                  <span className="w-8 text-center text-sm font-medium">{line.quantity}</span>
                                  <button onClick={() => setLines(p => p.map((l, i) => i === idx ? { ...l, quantity: Math.min(l.maxQty, l.quantity + 1) } : l))}
                                    className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xs">+</button>
                                </div>
                                <select value={line.condition} onChange={e => setLines(p => p.map((l, i) => i === idx ? { ...l, condition: e.target.value } : l))}
                                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500">
                                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button onClick={() => setEditingIdx(null)} className="text-green-600 hover:text-green-800"><Check className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <span>Qty: {line.quantity}</span>
                                <span className="px-1.5 py-0.5 bg-gray-200 rounded">{line.condition}</span>
                                <button onClick={() => setEditingIdx(idx)} className="text-blue-500 hover:text-blue-700"><Pencil className="w-3.5 h-3.5" /></button>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Return reason */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Return Reason *</label>
                    <select value={reason} onChange={e => setReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select reason...</option>
                      {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Additional Details</label>
                    <input type="text" value={details} onChange={e => setDetails(e.target.value)}
                      placeholder="Optional details..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                {/* Resolution */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Resolution Method</label>
                  <div className="flex gap-3">
                    {RESOLUTION.map(r => (
                      <button key={r.id} onClick={() => setResolution(r.id)}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-all ${resolution === r.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <div className="flex-1" />
            {order && (
              <button onClick={handleSubmit} disabled={submitting || !reason}
                className="px-6 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {submitting ? <div className="loading-spinner h-4 w-4" /> : <RotateCcw className="w-4 h-4" />}
                Process Return
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

interface ReturnListItem {
  id: number
  return_number: string
  order_number: string
  status: string
  return_reason: string
  total_amount: string | number
  created_at: string
  customer_email?: string
  customer_name?: string
}

const returnStatusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PROCESSED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

const ReturnsPage: React.FC = () => {
  const [showModal, setShowModal] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [returns, setReturns] = useState<ReturnListItem[]>([])
  const [loading, setLoading] = useState(true)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000)
  }

  const loadReturns = useCallback(async () => {
    try {
      setLoading(true)
      const data = await returnApi.list()
      setReturns(extractList<ReturnListItem>(data))
    } catch {
      // silently fail — empty list shown
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadReturns() }, [loadReturns])

  const handleCreated = () => {
    showToast('Return processed successfully!')
    loadReturns()
  }

  return (
    <OrderRoute>
      <MainLayout title="Returns Processing" subtitle="Process customer returns">
        {showModal && <ReturnModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}

        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm border shadow-lg ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {toast.msg}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700">
              <Plus className="w-4 h-4" /> Process New Return
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="loading-spinner h-8 w-8" /></div>
          ) : returns.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <RotateCcw className="mx-auto h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Returns Yet</h3>
              <p className="mt-2 text-gray-500 text-sm">Click &quot;Process New Return&quot;, enter the order number to auto-populate items.</p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Return #', 'Order #', 'Customer', 'Reason', 'Status', 'Amount', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {returns.map(ret => (
                    <tr key={ret.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{ret.return_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ret.order_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ret.customer_name || ret.customer_email || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[160px] truncate">{ret.return_reason}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${returnStatusColors[ret.status] ?? 'bg-gray-100 text-gray-800'}`}>
                          {ret.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">₹{Number(ret.total_amount).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(ret.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
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

export default ReturnsPage
