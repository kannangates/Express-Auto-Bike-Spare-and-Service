'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { InventoryRoute } from '../../components/auth/ProtectedRoute';
import { MainLayout } from '../../components/layout/MainLayout';
import { inventoryApi, extractList } from '../../utils/api';
import { Package, Plus, Search, AlertTriangle, X, Check } from 'lucide-react';

interface Category { id: number; name: string }

interface InventoryItemData {
  id: number
  barcode: string
  name: string
  description?: string
  category?: number | { id: number; name: string }
  category_name?: string
  unit_price: number | string
  stock_quantity: number
  min_stock_level: number
  is_active: boolean
  created_at: string
}

interface ItemForm {
  barcode: string; name: string; description: string
  category: string; unit_price: string; stock_quantity: string
  min_stock_level: string; is_active: boolean
}

const emptyForm: ItemForm = { barcode: '', name: '', description: '', category: '', unit_price: '', stock_quantity: '', min_stock_level: '5', is_active: true }

function ItemModal({ item, categories, onClose, onSave }: {
  item?: InventoryItemData | null; categories: Category[]
  onClose: () => void; onSave: (data: ItemForm) => Promise<void>
}) {
  const isEdit = !!item
  const [form, setForm] = useState<ItemForm>(() => item ? {
    barcode: item.barcode, name: item.name, description: item.description ?? '',
    category: typeof item.category === 'object' ? String(item.category?.id ?? '') : String(item.category ?? ''),
    unit_price: String(item.unit_price), stock_quantity: String(item.stock_quantity),
    min_stock_level: String(item.min_stock_level ?? 5),
    is_active: item.is_active,
  } : emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof ItemForm, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const validate = () => {
    const e: Partial<Record<keyof ItemForm, string>> = {}
    if (!form.barcode.trim()) e.barcode = 'Required'
    if (!form.name.trim()) e.name = 'Required'
    if (!form.unit_price || isNaN(Number(form.unit_price)) || Number(form.unit_price) < 0) e.unit_price = 'Valid price required'
    if (!form.stock_quantity || isNaN(Number(form.stock_quantity)) || Number(form.stock_quantity) < 0) e.stock_quantity = 'Valid quantity required'
    setErrors(e); return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(form)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save item. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inp = (key: keyof ItemForm, label: string, type = 'text', extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={form[key] as string}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        disabled={isEdit && key === 'barcode'}
        className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[key] ? 'border-red-300' : 'border-gray-300'} ${isEdit && key === 'barcode' ? 'bg-gray-50 text-gray-500' : ''}`}
        {...extra} />
      {errors[key] && <p className="text-xs text-red-600 mt-1">{errors[key]}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{isEdit ? 'Edit Inventory Item' : 'Add New Inventory Item'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              {inp('barcode', 'Barcode *', 'text', { placeholder: 'e.g. 1234567890123' })}
              {inp('name', 'Item Name *', 'text', { placeholder: 'e.g. Brake Pad Set' })}
              {inp('unit_price', 'Price (₹) *', 'number', { min: '0', step: '0.01', placeholder: '0.00' })}
              {inp('stock_quantity', 'Stock Quantity *', 'number', { min: '0', placeholder: '0' })}
              {inp('min_stock_level', 'Min Stock Level', 'number', { min: '0', placeholder: '5' })}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional description..." />
            </div>
            {/* Active toggle */}
            <div className="flex items-center justify-between py-2 border-t border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-700">Active Status</p>
                <p className="text-xs text-gray-500">Inactive items cannot be ordered</p>
              </div>
              <button type="button" onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          <div className="px-6 pb-2">
            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
            )}
          </div>
          <div className="flex gap-3 justify-end px-6 py-4 border-t bg-gray-50">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? <div className="loading-spinner h-4 w-4" /> : <Check className="w-4 h-4" />}
              {isEdit ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const InventoryPage: React.FC = () => {
  const searchParams = useSearchParams()
  const [items, setItems] = useState<InventoryItemData[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItemData | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [categoryError, setCategoryError] = useState(false)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000)
  }

  const loadItems = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, unknown> = {}
      if (search) params.search = search
      if (categoryFilter) params.category = Number(categoryFilter)
      const data = await inventoryApi.list(params as Parameters<typeof inventoryApi.list>[0])
      setItems(extractList<InventoryItemData>(data))
    } catch { showToast('Failed to load inventory', 'error') }
    finally { setLoading(false) }
  }, [search, categoryFilter])

  useEffect(() => { loadItems() }, [loadItems])

  useEffect(() => {
    inventoryApi.categories().then((data: unknown) => {
      setCategories(extractList<Category>(data))
    }).catch(() => { showToast('Failed to load categories', 'error'); setCategoryError(true) })
  }, [])

  useEffect(() => {
    if (searchParams.get('action') === 'new') { setEditItem(null); setIsModalOpen(true) }
  }, [searchParams])

  const handleSave = async (form: ItemForm) => {
    const payload = {
      barcode: form.barcode.trim(), name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category ? Number(form.category) : undefined,
      unit_price: Number(form.unit_price),
      stock_quantity: Number(form.stock_quantity),
      min_stock_level: form.min_stock_level ? Number(form.min_stock_level) : 5,
      is_active: form.is_active,
    }
    if (editItem?.id) {
      await inventoryApi.update(editItem.id, payload)
      showToast(`"${form.name}" updated successfully!`)
    } else {
      await inventoryApi.create(payload)
      showToast(`"${form.name}" added successfully!`)
    }
    setIsModalOpen(false); setEditItem(null); await loadItems()
  }

  const catName = (item: InventoryItemData) => {
    if (item.category_name) return item.category_name
    if (typeof item.category === 'object' && item.category?.name) return item.category.name
    return null
  }

  return (
    <InventoryRoute>
      <MainLayout title="Inventory Management" subtitle="Manage your bike spare parts inventory">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm border shadow-lg ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {toast.msg}
          </div>
        )}

        {/* Modal */}
        {isModalOpen && (
          <ItemModal item={editItem} categories={categories} onClose={() => { setIsModalOpen(false); setEditItem(null) }} onSave={handleSave} />
        )}

        {/* Sticky toolbar */}
        <div className="sticky top-0 z-20 bg-gray-50 pb-4 pt-1 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search items by name or barcode..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 w-full border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
            <div className="flex flex-col">
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {categoryError && (
                <p className="text-xs text-red-500 mt-1">Failed to load categories. Refresh to retry.</p>
              )}
            </div>
            <button onClick={() => { setEditItem(null); setIsModalOpen(true) }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 whitespace-nowrap">
              <Plus className="w-4 h-4" /> Add New Item
            </button>
          </div>
          {/* Stats bar */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{items.length} items</span>
            <span>{items.filter(i => i.is_active).length} active</span>
            <span className="text-yellow-600">{items.filter(i => i.stock_quantity <= i.min_stock_level && i.stock_quantity > 0).length} low stock</span>
            <span className="text-red-600">{items.filter(i => i.stock_quantity === 0).length} out of stock</span>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-200" />
                <div className="p-3 space-y-2"><div className="h-3 bg-gray-200 rounded w-3/4" /><div className="h-3 bg-gray-200 rounded w-1/2" /></div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No items found</h3>
            <p className="text-gray-500 mt-1 text-sm">{search || categoryFilter ? 'Try different filters.' : 'Click "Add New Item" to get started.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map(item => (
              <div key={item.id} onClick={() => { setEditItem(item); setIsModalOpen(true) }}
                className={`bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${!item.is_active ? 'opacity-60 border-gray-200' : 'border-gray-200'}`}>
                <div className="aspect-square bg-gray-100 flex flex-col items-center justify-center text-gray-400 relative">
                  <Package className="w-10 h-10 mb-1" />
                  <span className="text-xs">No Image</span>
                  {!item.is_active && (
                    <span className="absolute top-1 right-1 bg-gray-500 text-white text-xs px-1.5 py-0.5 rounded">Inactive</span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono truncate">{item.barcode}</p>
                  {catName(item) && <p className="text-xs text-blue-600 mt-0.5">{catName(item)}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-gray-900">₹{Number(item.unit_price).toLocaleString('en-IN')}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.stock_quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {item.stock_quantity > 0 ? item.stock_quantity : 'Out'}
                    </span>
                  </div>
                  {item.stock_quantity > 0 && item.stock_quantity <= item.min_stock_level && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3 text-yellow-500" />
                      <span className="text-xs text-yellow-600">Low stock</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </MainLayout>
    </InventoryRoute>
  )
}

export default function InventoryPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <InventoryPage />
    </Suspense>
  )
}
