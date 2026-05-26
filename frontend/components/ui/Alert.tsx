'use client'

import { useEffect, useRef } from 'react'
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react'

export type AlertType = 'success' | 'error' | 'warning' | 'confirm'

interface AlertProps {
  type: AlertType
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  onCancel?: () => void
  onClose: () => void
}

const icons = {
  success: <CheckCircle className="w-6 h-6 text-green-500" />,
  error: <XCircle className="w-6 h-6 text-red-500" />,
  warning: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
  confirm: <AlertTriangle className="w-6 h-6 text-blue-500" />,
}

const headerColors = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-yellow-50 border-yellow-200',
  confirm: 'bg-blue-50 border-blue-200',
}

const confirmBtnColors = {
  success: 'bg-green-600 hover:bg-green-700',
  error: 'bg-red-600 hover:bg-red-700',
  warning: 'bg-yellow-600 hover:bg-yellow-700',
  confirm: 'bg-blue-600 hover:bg-blue-700',
}

export function Alert({ type, title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', onConfirm, onCancel, onClose }: AlertProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onCancel) onCancel()
        else onClose()
      }
      if (e.key === 'Enter') {
        if (onConfirm) onConfirm()
        else onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onConfirm, onCancel, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onCancel ? onCancel() : onClose()} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className={`flex items-start gap-3 p-5 border-b ${headerColors[type]}`}>
          {icons[type]}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">{title}</p>
            {message && <p className="text-sm text-gray-600 mt-0.5">{message}</p>}
          </div>
          <button onClick={() => onCancel ? onCancel() : onClose()} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Actions */}
        <div className="flex gap-2 p-4 justify-end">
          {type === 'confirm' && (
            <button
              onClick={() => { onCancel?.(); onClose() }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            onClick={() => { onConfirm?.(); onClose() }}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${confirmBtnColors[type]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook for easy usage
import { useState, useCallback } from 'react'

interface AlertState {
  open: boolean
  type: AlertType
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  onCancel?: () => void
}

export function useAlert() {
  const [state, setState] = useState<AlertState>({ open: false, type: 'success', title: '' })

  const show = useCallback((opts: Omit<AlertState, 'open'>) => {
    setState({ ...opts, open: true })
  }, [])

  const close = useCallback(() => setState(s => ({ ...s, open: false })), [])

  const alert = useCallback((title: string, message?: string, type: AlertType = 'success') => {
    show({ type, title, message })
  }, [show])

  const confirm = useCallback((title: string, message?: string): Promise<boolean> => {
    return new Promise(resolve => {
      show({
        type: 'confirm',
        title,
        message,
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      })
    })
  }, [show])

  const AlertComponent = state.open ? (
    <Alert
      type={state.type}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      onConfirm={state.onConfirm}
      onCancel={state.onCancel}
      onClose={close}
    />
  ) : null

  return { alert, confirm, AlertComponent }
}
