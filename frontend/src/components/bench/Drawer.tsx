import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Key } from './Key'
import { PHONE_QUERY, useMediaQuery } from './useMediaQuery'

/** Closing ("snap") duration in ms; matches the CSS. */
const SNAP_MS = 180
/** Drag the sheet down further than this to dismiss it. */
const DISMISS_PX = 90

const FOCUSABLE = 'a[href], button:not([disabled]):not(.bs-drawer-grip), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  /** Mono caps label in the head ("Action item", "Ask Entomate"). */
  label: string
  children: React.ReactNode
  /** Keys pinned under the body. */
  footer?: React.ReactNode
  /** Hide the Esc hint on the close key (e.g. on phone-only sheets). */
  hideEscHint?: boolean
  /**
   * false: a side panel that leaves the page usable (no scrim, no scroll lock,
   * no focus trap, focus stays where it was). Esc still closes it. Desktop
   * only: on phone the sheet stays modal.
   */
  modal?: boolean
  /** Extra class on the panel (width variants). */
  className?: string
}

/**
 * Desktop: a 440px panel from the right over a scrim. Phone: the same
 * content as a bottom sheet with a grip. Springs open (460ms) and snaps
 * shut (180ms). Esc, scrim click and the Close key dismiss it; focus moves
 * in and returns on close. On phone, drag the grip down past 90px to close.
 */
export function Drawer({ open, onClose, label, children, footer, hideEscHint = false, modal: modalProp = true, className }: DrawerProps): React.ReactPortal | null {
  const isPhone = useMediaQuery(PHONE_QUERY)
  const modal = modalProp || isPhone
  const [mounted, setMounted] = useState<boolean>(open)
  const [shown, setShown] = useState<boolean>(false)
  const [dragging, setDragging] = useState<boolean>(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const dragStartRef = useRef<number | null>(null)
  const labelId = useId()

  // Mount, then flip to "shown" on the next frames so the spring runs.
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setMounted(true)
      let raf2 = 0
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShown(true))
      })
      return () => {
        cancelAnimationFrame(raf1)
        cancelAnimationFrame(raf2)
      }
    }
    setShown(false)
    const t = window.setTimeout(() => setMounted(false), SNAP_MS + 20)
    return () => window.clearTimeout(t)
  }, [open])

  // Focus in on open, back to the opener on close. Lock page scroll.
  useEffect(() => {
    if (!mounted || !modal) return
    const root = document.documentElement
    root.classList.add('bs-scroll-lock')
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus({ preventScroll: true })
    return () => {
      root.classList.remove('bs-scroll-lock')
      returnFocusRef.current?.focus({ preventScroll: true })
    }
  }, [mounted, modal])

  // Side panel: Esc closes it from anywhere on the page.
  useEffect(() => {
    if (!open || modal) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, modal, onClose])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !modal || !panelRef.current) return
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (items.length === 0) return
    const firstEl = items[0]
    const lastEl = items[items.length - 1]
    if (!firstEl || !lastEl) return
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault()
      lastEl.focus()
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault()
      firstEl.focus()
    }
  }, [onClose, modal])

  // Phone: drag the grip or head down to dismiss.
  const setDrag = (px: number): void => {
    panelRef.current?.style.setProperty('--bs-drag', `${px}px`)
  }
  const onPointerDown = (e: React.PointerEvent<HTMLElement>): void => {
    if (!isPhone) return
    if ((e.target as HTMLElement).closest('button:not(.bs-drawer-grip)')) return
    dragStartRef.current = e.clientY
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLElement>): void => {
    if (dragStartRef.current == null) return
    setDrag(Math.max(0, e.clientY - dragStartRef.current))
  }
  const onPointerUp = (e: React.PointerEvent<HTMLElement>): void => {
    if (dragStartRef.current == null) return
    const dy = e.clientY - dragStartRef.current
    dragStartRef.current = null
    setDragging(false)
    if (dy > DISMISS_PX) onClose()
    // Let the spring carry it home (or the snap carry it away).
    requestAnimationFrame(() => setDrag(0))
  }

  if (!mounted || typeof document === 'undefined') return null

  const dragHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  }

  return createPortal(
    <>
      {modal && <div className="bs-scrim" data-open={shown} onClick={onClose} aria-hidden="true" />}
      <div
        ref={panelRef}
        className={className ? `bs-drawer ${className}` : 'bs-drawer'}
        role={modal ? 'dialog' : 'complementary'}
        aria-modal={modal ? 'true' : undefined}
        data-modal={modal}
        aria-labelledby={labelId}
        tabIndex={-1}
        data-open={shown}
        data-dragging={dragging || undefined}
        onKeyDown={onKeyDown}
      >
        <button type="button" className="bs-drawer-grip" aria-label="Drag down to close" tabIndex={-1} {...dragHandlers} />
        <div className="bs-drawer-head" {...dragHandlers}>
          <span className="bs-lbl" id={labelId}>{label}</span>
          <Key size="sm" onClick={onClose} kbd={hideEscHint || isPhone ? undefined : 'Esc'}>Close</Key>
        </div>
        <div className="bs-drawer-body">{children}</div>
        {footer && <div className="bs-drawer-foot">{footer}</div>}
      </div>
    </>,
    document.body
  )
}
