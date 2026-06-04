'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Wifi } from 'lucide-react'
import { api } from '../../utils/api'

export function TunnelBanner() {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.get('/api/v1/dashboard/tunnel-url/')
      .then((data: { url: string }) => {
        if (data.url) setUrl(data.url)
      })
      .catch(() => {})
  }, [])

  if (!url) return null

  const copy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-blue-600 text-white text-sm px-4 py-1.5 flex items-center justify-center gap-3">
      <Wifi className="w-4 h-4 shrink-0" />
      <span className="hidden sm:inline font-medium">Shop access URL:</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 font-mono truncate max-w-xs"
      >
        {url}
      </a>
      <button
        onClick={copy}
        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded px-2 py-0.5 transition-colors shrink-0"
        title="Copy URL"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? 'Copied!' : 'Copy'}</span>
      </button>
    </div>
  )
}
