import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '../contexts/AuthContext'
import { NetworkStatus } from '../components/NetworkStatus'

export const metadata: Metadata = {
  title: 'Express Auto Bike Management System',
  description: 'Bike spare parts and service management system',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Express Auto',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Express Auto Bike Management',
    title: 'Express Auto Bike Management System',
    description: 'Bike spare parts and service management system',
  },
  twitter: {
    card: 'summary',
    title: 'Express Auto Bike Management System',
    description: 'Bike spare parts and service management system',
  },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Express Auto" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#2563eb" />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <NetworkStatus />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}