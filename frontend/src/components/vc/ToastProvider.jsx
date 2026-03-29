import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { VCToast } from './index'
import { X } from 'lucide-react'

const ToastContext = createContext(null)

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timersRef.current[id])
    delete timersRef.current[id]
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback(({ title, message, color = 'crimson', icon, duration = 4000 }) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, title, message, color, icon }])
    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  const toast = {
    show: (opts) => addToast(opts),
    success: (title, message) => addToast({ title, message, color: 'mint' }),
    error: (title, message) => addToast({ title, message, color: 'crimson' }),
    warning: (title, message) => addToast({ title, message, color: 'amber' }),
    info: (title, message) => addToast({ title, message, color: 'phosphor' }),
    dismiss
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div className="vc-toast-stack">
          {toasts.map(t => (
            <div key={t.id} className="vc-toast-item">
              <VCToast title={t.title} message={t.message} color={t.color} icon={t.icon} />
              <button className="vc-toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
