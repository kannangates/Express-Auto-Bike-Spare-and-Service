'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Package, ClipboardList, BarChart3, Zap, MessageCircle } from 'lucide-react'

interface Product {
  id: number
  name: string
  sku: string
  barcode?: string
  description?: string
  category?: string
  quantity: number
  price: number
  image?: string
}

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''

function WhatsAppButton() {
  if (!WHATSAPP_NUMBER) return null
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi! I need help with bike spare parts.')}`
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105"
      title="Chat on WhatsApp"
    >
      <MessageCircle className="w-6 h-6" />
      <span className="text-sm font-medium hidden sm:inline">WhatsApp Us</span>
    </a>
  )
}

function ProductCard({ product }: { product: Product }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Image box */}
      <div className="aspect-square bg-gray-100 flex items-center justify-center relative">
        {product.image ? (
          <Image src={product.image} alt={product.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
        ) : (
          <div className="flex flex-col items-center text-gray-400">
            <Package className="w-12 h-12 mb-2" />
            <span className="text-xs">No Image</span>
          </div>
        )}
      </div>
      {/* Details */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-gray-900 truncate">{product.name}</h3>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{product.sku}</p>
        {product.category && <p className="text-xs text-blue-600 mt-0.5">{product.category}</p>}
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-bold text-gray-900">₹{product.price.toLocaleString('en-IN')}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${product.quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {product.quantity > 0 ? `${product.quantity} in stock` : 'Out of stock'}
          </span>
        </div>
        {product.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(true)

  useEffect(() => {
    const token = document.cookie.split('; ').find(r => r.startsWith('auth-token='))?.split('=')[1]
    if (token) setIsAuthenticated(true)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`/api/v1/inventory/items/?page_size=24&is_active=true`)
        if (res.ok) {
          const data = await res.json()
          const items = Array.isArray(data) ? data : (data.results ?? [])
          setProducts(items.map((item: Record<string, unknown>) => ({
            id: item.id as number,
            name: item.name as string,
            sku: item.sku as string,
            barcode: item.barcode as string | undefined,
            description: item.description as string | undefined,
            category: (item.category as Record<string, unknown>)?.name as string | undefined ?? item.category as string | undefined,
            quantity: (item.stock_quantity ?? item.quantity ?? 0) as number,
            price: (item.unit_price ?? item.price ?? 0) as number,
            image: item.image as string | undefined,
          })))
        }
      } catch {
        // silently fail - products section just won't show
      } finally {
        setProductsLoading(false)
      }
    }
    fetchProducts()
  }, [])

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="loading-spinner mx-auto"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-600">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Express Auto Bike</h1>
              <p className="text-xs text-gray-500">Spare Parts & Service</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {WHATSAPP_NUMBER && (
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi! I need help with bike spare parts.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-green-600 hover:text-green-700 text-sm font-medium"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
            )}
            {isAuthenticated ? (
              <Link href="/dashboard" className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                Dashboard
              </Link>
            ) : (
              <Link href="/login" className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-blue-600 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold">Your Trusted Bike Spare Parts Store</h2>
          <p className="mt-3 text-blue-100 text-lg">Quality parts, fast service, competitive prices</p>
          {WHATSAPP_NUMBER && (
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi! I want to enquire about bike spare parts.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-semibold transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              Chat with us on WhatsApp
            </a>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Products Grid */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Our Products</h2>
          {products.length > 0 && (
            <span className="text-sm text-gray-500">{products.length} items available</span>
          )}
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-200" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No products yet</h3>
            <p className="text-gray-500 mt-1">Products added to inventory will appear here.</p>
            {isAuthenticated && (
              <Link href="/inventory?action=new" className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                Add First Product
              </Link>
            )}
          </div>
        )}

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { icon: <Package className="h-6 w-6 text-blue-600" />, bg: 'bg-blue-100', title: 'Inventory Management', desc: 'Comprehensive tracking with barcode scanning' },
            { icon: <ClipboardList className="h-6 w-6 text-green-600" />, bg: 'bg-green-100', title: 'Order Processing', desc: 'Streamlined orders from placement to delivery' },
            { icon: <BarChart3 className="h-6 w-6 text-purple-600" />, bg: 'bg-purple-100', title: 'Reports & Analytics', desc: 'Detailed insights for better decisions' },
          ].map(f => (
            <div key={f.title} className="bg-white rounded-lg shadow-sm p-6 flex gap-4">
              <div className={`h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-full ${f.bg}`}>{f.icon}</div>
              <div>
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 bg-blue-600 rounded-xl p-8 text-center text-white">
          <h3 className="text-2xl font-bold">Ready to get started?</h3>
          <p className="mt-2 text-blue-100">Sign in to access the full management system</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            {isAuthenticated ? (
              <Link href="/dashboard" className="inline-flex items-center justify-center px-6 py-3 rounded-md text-blue-600 bg-white hover:bg-blue-50 font-semibold">
                Go to Dashboard
              </Link>
            ) : (
              <Link href="/login" className="inline-flex items-center justify-center px-6 py-3 rounded-md text-blue-600 bg-white hover:bg-blue-50 font-semibold">
                Sign In with Google
              </Link>
            )}
            {WHATSAPP_NUMBER && (
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-green-500 hover:bg-green-600 text-white font-semibold"
              >
                <MessageCircle className="w-5 h-5" />
                Contact on WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white mt-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">© 2026 Express Auto Bike Management System. All rights reserved.</p>
          {WHATSAPP_NUMBER && (
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-green-600 hover:text-green-700 text-sm font-medium"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp: +{WHATSAPP_NUMBER}
            </a>
          )}
        </div>
      </footer>

      {/* Floating WhatsApp button */}
      <WhatsAppButton />
    </div>
  )
}
