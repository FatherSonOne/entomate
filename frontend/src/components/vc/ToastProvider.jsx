import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { VCToast } from './index'
import { X } from 'lucide-react'
import { isReloadProtected } from '../../services/chunkReload'
import { ACTION_LABEL, classifyError, toastForError } from '../../services/errorKinds'
import { breadcrumb, reportError } from '../../services/monitoring'

const ToastContext = createContext(null)

let toastId = 0
/** Exit duration in ms; matches .vc-toast-item.is-leaving in vc-components.css. */
const TOAST_EXIT_MS = 200

const runErrorAction = (action) => {
  if (action === 'reload') window.location.reload()
  else if (action === 'sign-in') window.location.assign('/sign-in')
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  // Each timer remembers what is left so hover and a hidden tab can pause it.
  const remainingRef = useRef({})

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Leaving toasts play their exit (and close the gap) before they unmount.
  const dismiss = useCallback((id) => {
    clearTimeout(timersRef.current[id])
    delete timersRef.current[id]
    delete remainingRef.current[id]
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => remove(id), TOAST_EXIT_MS)
  }, [remove])

  const startTimer = useCallback((id, ms) => {
    clearTimeout(timersRef.current[id])
    remainingRef.current[id] = { ms, at: Date.now() }
    timersRef.current[id] = setTimeout(() => dismiss(id), ms)
  }, [dismiss])

  const pause = useCallback((id) => {
    const r = remainingRef.current[id]
    if (!r) return
    clearTimeout(timersRef.current[id])
    remainingRef.current[id] = { ms: Math.max(800, r.ms - (Date.now() - r.at)), at: 0 }
  }, [])

  const resume = useCallback((id) => {
    const r = remainingRef.current[id]
    if (r && r.at === 0) startTimer(id, r.ms)
  }, [startTimer])

  // action: optional { label, onClick } key in the toast (e.g. Undo); pressing it closes the toast.
  const addToast = useCallback(({ title, message, color = 'crimson', icon, duration = 4000, action }) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, title, message, color, icon, action }])
    if (duration > 0) startTimer(id, duration)
    return id
  }, [startTimer])

  // A toast nobody could see should not expire: pause while the tab is hidden.
  useEffect(() => {
    const onVis = () => {
      const ids = Object.keys(remainingRef.current).map(Number)
      ids.forEach(id => (document.hidden ? pause(id) : resume(id)))
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [pause, resume])

  const toast = {
    show: addToast,
    success: (title, message) => addToast({ title, message, color: 'mint' }),
    // error(title, messageOrError): known causes (signed out, offline, no access,
    // server down) get their own words and key; pass the Error itself for the best match.
    error: (title, message) => {
      const err = message instanceof Error ? message : title instanceof Error ? title : null
      const copy = toastForError(typeof title === 'string' ? title : undefined, err ?? message)
      breadcrumb('toast.error', `${copy.title}: ${copy.message}`)
      // Server and network failures are reported by the API client; unknown causes from here
      if (err && classifyError(err) === 'render') reportError(err, { source: 'toast', extra: { route: window.location.pathname } })
      const refreshDeferred = copy.action === 'reload' && isReloadProtected()
      const recordingNotice = 'Finish saving the recording before reloading Entomate.'
      const action = !refreshDeferred && copy.action && copy.action !== 'retry' && copy.action !== 'home'
        ? { label: ACTION_LABEL[copy.action], onClick: () => {
          if (copy.action === 'reload' && isReloadProtected()) {
            addToast({ title: copy.title, message: recordingNotice, color: 'amber' })
            return
          }
          runErrorAction(copy.action)
        } }
        : undefined
      return addToast({ title: copy.title, message: refreshDeferred ? recordingNotice : copy.message, color: 'crimson', action, duration: action ? 8000 : 5000 })
    },
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
            <div
              key={t.id}
              className={`vc-toast-slot${t.leaving ? ' is-leaving' : ''}`}
              onMouseEnter={() => pause(t.id)}
              onMouseLeave={() => resume(t.id)}
            >
              <div className="vc-toast-item">
                <VCToast title={t.title} message={t.message} color={t.color} icon={t.icon} />
                {t.action && (
                  <button
                    type="button"
                    className="vc-toast-action"
                    onClick={() => { dismiss(t.id); t.action.onClick() }}
                  >
                    {t.action.label}
                  </button>
                )}
                <button className="vc-toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                  <X size={14} />
                </button>
              </div>
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
