import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { VCButton } from './index'
import { AlertTriangle } from 'lucide-react'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)

  const confirm = useCallback(({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger' }) => {
    return new Promise(resolve => {
      setState({ title, message, confirmLabel, cancelLabel, variant, resolve })
    })
  }, [])

  const handleConfirm = () => {
    state?.resolve(true)
    setState(null)
  }

  const handleCancel = () => {
    state?.resolve(false)
    setState(null)
  }

  // Close on Escape
  useEffect(() => {
    if (!state) return
    const onKey = (e) => { if (e.key === 'Escape') handleCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && createPortal(
        <div className="vc-confirm-overlay" onClick={handleCancel}>
          <div className="vc vc-confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="vc-confirm-icon">
              <AlertTriangle size={24} style={{ color: 'var(--a)' }} />
            </div>
            <h3 className="vc-confirm-title">{state.title}</h3>
            <p className="vc-confirm-message">{state.message}</p>
            <div className="vc-confirm-actions">
              <VCButton variant="ghost" onClick={handleCancel}>{state.cancelLabel}</VCButton>
              <VCButton variant={state.variant} onClick={handleConfirm}>{state.confirmLabel}</VCButton>
            </div>
          </div>
        </div>,
        document.body
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
