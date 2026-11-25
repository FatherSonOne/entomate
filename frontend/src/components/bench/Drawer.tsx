import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Key } from './Key'
import { PHONE_QUERY, useMediaQuery } from './useMediaQuery'

/** Closing ("snap") duration in ms; matches the CSS. */
const SNAP_MS = 180
/** Drag the sheet down further than this to dismiss it. */
const DISMISS_PX = 90
/** Or flick it: px per ms. A quick flick closes it whatever the distance. */
const FLICK_VELOCITY = 0.11
/** Dragging up past the top meets friction instead of a wall. */
const OVERDRAG_DAMPING = 0.2

const FOCUSABLE = 'a[href], button:not(:disabled):not(.bs-drawer-grip), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

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
  /** Keep the drawer open while its task cannot safely be interrupted. */
  dismissible?: boolean
  /**
   * false: a side panel that leaves the page usable (no scrim, no scroll lock,
   * no focus trap, focus stays where it was). Esc still closes it. Desktop
   * only: on phone the sheet stays modal.
   */
  modal?: boolean
  /** Extra class on the panel (width variants). */
  className?: string
  /** Underlay puts Settings section sheets below their detail drawers. Top clears legacy modals. */
  layer?: 'underlay' | 'base' | 'top'
}

/** Open modal drawers; the page stays locked until the last one closes. */
let scrollLocks = 0

/**
 * Desktop: a 440px panel from the right over a scrim. Phone: the same
 * content as a bottom sheet with a grip. Springs open (460ms) and snaps
 * shut (180ms). Esc, scrim click and the Close key dismiss it; focus moves
 * in and returns on close. On phone, drag the grip down past 90px (or flick
 * it) to close; dragging up meets friction.
 */
export function Drawer({ open, onClose, label, children, footer, hideEscHint = false, dismissible = true, modal: modalProp = true, className, layer = 'base' }: DrawerProps): React.ReactPortal | null {
  const isPhone = useMediaQuery(PHONE_QUERY)
  const modal = modalProp || isPhone
  const [mounted, setMounted] = useState<boolean>(open)
  const [shown, setShown] = useState<boolean>(false)
  const [dragging, setDragging] = useState<boolean>(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const dragStartRef = useRef<number | null>(null)
  const dragStartTimeRef = useRef<number>(0)
  const labelId = useId()
  const dismiss = useCallback(() => {
    if (dismissible) onClose()
  }, [dismissible, onClose])

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

  useLayoutEffect(() => {
    panelRef.current?.toggleAttribute('inert', !open)
  }, [open, mounted])

  // Focus in on open, back to the opener on close. Lock page scroll.
  useEffect(() => {
    if (!mounted || !modal) return
    const root = document.documentElement
    scrollLocks += 1
    root.classList.add('bs-scroll-lock')
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus({ preventScroll: true })
    return () => {
      scrollLocks = Math.max(0, scrollLocks - 1)
      if (scrollLocks === 0) root.classList.remove('bs-scroll-lock')
      returnFocusRef.current?.focus({ preventScroll: true })
    }
  }, [mounted, modal])

  // Side panel: Esc closes it from anywhere on the page.
  useEffect(() => {
    if (!open || modal) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') dismiss() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, modal, dismiss])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!panelRef.current?.contains(e.target as Node)) return
    if (e.key === 'Escape') {
      e.stopPropagation()
      dismiss()
      return
    }
    if (e.key !== 'Tab' || !modal || !panelRef.current) return
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    const firstEl = items[0]
    const lastEl = items[items.length - 1]
    if (!firstEl || !lastEl) {
      e.preventDefault()
      return
    }
    const active = document.activeElement
    // A status heading can receive focus programmatically before the first key.
    if (e.shiftKey && (active === firstEl || (active && active.compareDocumentPosition(firstEl) & Node.DOCUMENT_POSITION_FOLLOWING))) {
      e.preventDefault()
      lastEl.focus()
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault()
      firstEl.focus()
    }
  }, [dismiss, modal])

  // Phone: drag the grip or head down to dismiss.
  const setDrag = (px: number): void => {
    panelRef.current?.style.setProperty('--bs-drag', `${px}px`)
  }
  const onPointerDown = (e: React.PointerEvent<HTMLElement>): void => {
    if (!isPhone || !dismissible) return
    if ((e.target as HTMLElement).closest('button:not(.bs-drawer-grip)')) return
    dragStartRef.current = e.clientY
    dragStartTimeRef.current = performance.now()
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLElement>): void => {
    if (dragStartRef.current == null) return
    const dy = e.clientY - dragStartRef.current
    setDrag(dy >= 0 ? dy : dy * OVERDRAG_DAMPING)
  }
  const onPointerUp = (e: React.PointerEvent<HTMLElement>): void => {
    if (dragStartRef.current == null) return
    const dy = e.clientY - dragStartRef.current
    dragStartRef.current = null
    setDragging(false)
    const velocity = dy / Math.max(1, performance.now() - dragStartTimeRef.current)
    if (dy > DISMISS_PX || (dy > 8 && velocity > FLICK_VELOCITY)) dismiss()
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
      {modal && <div className="bs-scrim" data-open={shown} data-layer={layer === 'base' ? undefined : layer} onClick={dismiss} aria-hidden="true" />}
      <div
        ref={panelRef}
        className={className ? `bs-drawer ${className}` : 'bs-drawer'}
        role={modal ? 'dialog' : 'complementary'}
        aria-modal={modal ? 'true' : undefined}
        data-modal={modal}
        data-layer={layer === 'base' ? undefined : layer}
        aria-labelledby={labelId}
        tabIndex={-1}
        data-open={shown}
        data-dragging={dragging || undefined}
        onKeyDown={onKeyDown}
      >
        <button type="button" className="bs-drawer-grip" aria-label="Drag down to close" tabIndex={-1} disabled={!dismissible} {...dragHandlers} />
        <div className="bs-drawer-head" {...dragHandlers}>
          <span className="bs-lbl" id={labelId}>{label}</span>
          <Key size="sm" onClick={dismiss} disabled={!dismissible} kbd={hideEscHint || isPhone || !dismissible ? undefined : 'Esc'}>Close</Key>
        </div>
        <div className="bs-drawer-body">{children}</div>
        {footer && <div className="bs-drawer-foot">{footer}</div>}
      </div>
    </>,
    document.body
  )
}
