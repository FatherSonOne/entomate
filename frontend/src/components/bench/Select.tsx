import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Drawer } from './Drawer'
import { MOTION, usePresence } from './motion'
import { PHONE_QUERY, useMediaQuery } from './useMediaQuery'
import { cx } from './cx'

export interface SelectOption {
  value: string
  label: React.ReactNode
  /** Mono hint on the right of the row ("primary", "private"). */
  hint?: React.ReactNode
  disabled?: boolean
  /** Text for typeahead when `label` isn't a plain string. */
  textValue?: string
}

export interface SelectGroup {
  label: string
  options: ReadonlyArray<SelectOption>
}

export interface SelectProps {
  value: string | number | null | undefined
  onChange: (value: string) => void
  options: ReadonlyArray<SelectOption | SelectGroup>
  /** Shown when no option matches `value`. */
  placeholder?: React.ReactNode
  /** Accessible name, and the phone sheet's title. Omit when a <label htmlFor={id}> or aria-labelledby names it. */
  label?: string
  /** Title of the phone sheet when `label` is omitted. */
  sheetLabel?: string
  id?: string
  'aria-labelledby'?: string
  disabled?: boolean
  size?: 'md' | 'sm'
  /** Form field name: renders a hidden input carrying the value. */
  name?: string
  /** Class on the trigger (width, layout). */
  className?: string
  title?: string
}

type Row = SelectOption & { key: string; group?: string; groupStart?: boolean }

const TYPEAHEAD_MS = 500
const POP_GAP = 6
const POP_MAX = 320
const EDGE = 8
/** Short lists size the field to their widest label. */
const SIZE_ROWS = 16

function isGroup(o: SelectOption | SelectGroup): o is SelectGroup {
  return (o as SelectGroup).options !== undefined
}

function textOf(o: SelectOption): string {
  if (o.textValue) return o.textValue
  if (typeof o.label === 'string' || typeof o.label === 'number') return String(o.label)
  return o.value
}

interface PopPos { top: number; left: number; width: number; maxHeight: number; up: boolean }

/**
 * The bench's dropdown, in place of the browser's <select>.
 * A sunk field that opens a short list under it (or above it near the
 * bottom of the screen). Desktop: a popover; phone: a bottom sheet.
 *
 * Keyboard (WAI-ARIA select-only combobox): focus stays on the field.
 * ↓ ↑ Enter or Space open it, ↓ ↑ Home End PageUp PageDown move, Enter or
 * Space pick, Esc closes, Tab picks and moves on. Typing a few letters jumps
 * to the first match, open or closed. Reduce motion drops the scale.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  label,
  sheetLabel,
  id,
  'aria-labelledby': labelledBy,
  disabled = false,
  size = 'md',
  name,
  className,
  title,
}: SelectProps): React.ReactElement {
  const isPhone = useMediaQuery(PHONE_QUERY)
  const autoId = useId()
  const triggerId = id ?? `${autoId}-trigger`
  const listId = `${autoId}-list`
  const current = value == null ? '' : String(value)

  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    for (const o of options) {
      if (isGroup(o)) {
        o.options.forEach((opt, i) => out.push({ ...opt, key: `${o.label}:${opt.value}`, group: o.label, groupStart: i === 0 }))
      } else {
        out.push({ ...o, key: o.value })
      }
    }
    return out
  }, [options])

  const selectedIndex = rows.findIndex((r) => r.value === current)
  const selected = selectedIndex >= 0 ? rows[selectedIndex] : undefined

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<number>(-1)
  const [pos, setPos] = useState<PopPos | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const typed = useRef<{ text: string; at: number }>({ text: '', at: 0 })
  const presence = usePresence(open && !isPhone, MOTION.exit)

  const enabled = useCallback((i: number) => i >= 0 && i < rows.length && !rows[i]?.disabled, [rows])

  const step = useCallback((from: number, dir: 1 | -1, by = 1): number => {
    let i = from
    let moved = 0
    let last = from
    while (moved < by) {
      i += dir
      if (i < 0 || i >= rows.length) break
      if (enabled(i)) { last = i; moved++ }
    }
    return last
  }, [rows.length, enabled])

  const firstEnabled = useCallback(() => step(-1, 1), [step])
  const lastEnabled = useCallback(() => step(rows.length, -1), [step, rows.length])

  const openAt = useCallback((i: number) => {
    if (disabled || rows.length === 0) return
    setActive(i >= 0 ? i : firstEnabled())
    setOpen(true)
  }, [disabled, rows.length, firstEnabled])

  const close = useCallback((refocus = true) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus({ preventScroll: true })
  }, [])

  const choose = useCallback((i: number, refocus = true) => {
    const row = rows[i]
    if (!row || row.disabled) return
    if (row.value !== current) onChange(row.value)
    close(refocus)
  }, [rows, current, onChange, close])

  /** Typeahead: repeated single letters cycle through matches. */
  const match = useCallback((ch: string, from: number): number => {
    const now = Date.now()
    const t = typed.current
    t.text = now - t.at > TYPEAHEAD_MS ? ch : t.text + ch
    t.at = now
    const q = t.text.toLowerCase()
    const cycling = q.length > 1 && q.split('').every((c) => c === q[0])
    const needle = cycling ? q[0] ?? '' : q
    const start = cycling || q.length === 1 ? from + 1 : Math.max(from, 0)
    for (let n = 0; n < rows.length; n++) {
      const i = (start + n) % rows.length
      const row = rows[i]
      if (row && !row.disabled && textOf(row).toLowerCase().startsWith(needle)) return i
    }
    return -1
  }, [rows])

  // Desktop popover: place it under the field, or above when there's more room there.
  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight
    const vw = window.innerWidth
    const below = vh - r.bottom - POP_GAP - EDGE
    const above = r.top - POP_GAP - EDGE
    const want = Math.min(POP_MAX, rows.length * 38 + 12)
    const up = below < want && above > below
    const maxHeight = Math.max(120, Math.min(POP_MAX, up ? above : below))
    const width = Math.min(Math.max(r.width, 180), vw - EDGE * 2)
    const left = Math.min(Math.max(EDGE, r.left), vw - width - EDGE)
    setPos({ top: up ? r.top - POP_GAP : r.bottom + POP_GAP, left, width, maxHeight, up })
  }, [rows.length])

  useLayoutEffect(() => {
    if (!open || isPhone) return
    place()
    const onMove = (): void => place()
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open, isPhone, place])

  // Click or tap outside closes without picking.
  useEffect(() => {
    if (!open || isPhone) return
    const onDown = (e: PointerEvent): void => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return
      close(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open, isPhone, close])

  // Keep the active row in view.
  useEffect(() => {
    if (!open || active < 0) return
    const node = document.getElementById(`${listId}-${active}`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [open, active, listId, pos])

  // Phone sheet: put focus on the chosen row once the sheet is in.
  useEffect(() => {
    if (!open || !isPhone) return
    const raf = requestAnimationFrame(() => {
      const node = document.getElementById(`${listId}-${active >= 0 ? active : 0}`)
      node?.focus({ preventScroll: false })
    })
    return () => cancelAnimationFrame(raf)
  }, [open, isPhone]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (disabled) setOpen(false) }, [disabled])

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) return
    const k = e.key
    const printable = k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
    const typing = printable && (k !== ' ' || Date.now() - typed.current.at < TYPEAHEAD_MS)

    if (!open) {
      if (typing) {
        e.preventDefault()
        const i = match(k, selectedIndex)
        openAt(i >= 0 ? i : selectedIndex)
        return
      }
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') {
        e.preventDefault()
        openAt(selectedIndex >= 0 ? selectedIndex : (k === 'ArrowUp' ? lastEnabled() : firstEnabled()))
      } else if (k === 'Home' || k === 'End') {
        e.preventDefault()
        openAt(k === 'Home' ? firstEnabled() : lastEnabled())
      }
      return
    }

    if (isPhone) return // the sheet handles its own keys

    if (typing) {
      e.preventDefault()
      const i = match(k, active)
      if (i >= 0) setActive(i)
      return
    }
    switch (k) {
      case 'ArrowDown': e.preventDefault(); if (e.altKey) { choose(active) } else setActive((a) => step(a, 1)); break
      case 'ArrowUp': e.preventDefault(); if (e.altKey) { choose(active) } else setActive((a) => step(a, -1)); break
      case 'Home': e.preventDefault(); setActive(firstEnabled()); break
      case 'End': e.preventDefault(); setActive(lastEnabled()); break
      case 'PageDown': e.preventDefault(); setActive((a) => step(a, 1, 10)); break
      case 'PageUp': e.preventDefault(); setActive((a) => step(a, -1, 10)); break
      case 'Enter':
      case ' ':
        e.preventDefault(); choose(active); break
      case 'Escape':
        e.preventDefault(); e.stopPropagation(); close(); break
      case 'Tab':
        if (enabled(active)) { const row = rows[active]; if (row && row.value !== current) onChange(row.value) }
        setOpen(false)
        break
      default:
    }
  }

  // Phone sheet rows: arrow keys move focus between rows.
  const onSheetKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const at = Number((document.activeElement as HTMLElement | null)?.dataset.index ?? active)
    const next = e.key === 'Home' ? firstEnabled() : e.key === 'End' ? lastEnabled() : step(at, e.key === 'ArrowDown' ? 1 : -1)
    setActive(next)
    document.getElementById(`${listId}-${next}`)?.focus()
  }

  const shown = selected ? selected.label : placeholder
  const activeId = open && !isPhone && active >= 0 ? `${listId}-${active}` : undefined

  const renderRows = (phone: boolean): React.ReactNode =>
    rows.map((row, i) => (
      <React.Fragment key={row.key}>
        {row.groupStart && <div className="bs-select-group bs-lbl" role="presentation">{row.group}</div>}
        {phone ? (
          <button
            type="button"
            id={`${listId}-${i}`}
            data-index={i}
            role="option"
            aria-selected={row.value === current}
            aria-disabled={row.disabled || undefined}
            disabled={row.disabled}
            tabIndex={i === (active >= 0 ? active : 0) ? 0 : -1}
            className="bs-select-opt"
            onClick={() => choose(i, false)}
          >
            <span className="bs-select-opt-l">{row.label}</span>
            {row.hint && <span className="bs-select-hint">{row.hint}</span>}
            <span className="bs-select-tick" aria-hidden="true" />
          </button>
        ) : (
          <div
            id={`${listId}-${i}`}
            role="option"
            aria-selected={row.value === current}
            aria-disabled={row.disabled || undefined}
            data-active={i === active || undefined}
            className="bs-select-opt"
            onPointerDown={(e) => e.preventDefault()}
            onPointerMove={() => { if (!row.disabled && i !== active) setActive(i) }}
            onClick={() => choose(i)}
          >
            <span className="bs-select-opt-l">{row.label}</span>
            {row.hint && <span className="bs-select-hint">{row.hint}</span>}
            <span className="bs-select-tick" aria-hidden="true" />
          </div>
        )}
      </React.Fragment>
    ))

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeId}
        aria-label={label}
        aria-labelledby={label ? undefined : labelledBy}
        disabled={disabled}
        title={title}
        className={cx('bs-input', 'bs-select', 'bs-tokens', size === 'sm' && 'bs-select--sm', className)}
        data-open={open || undefined}
        data-empty={!selected || undefined}
        onClick={() => (open ? close() : openAt(selectedIndex))}
        onKeyDown={onKeyDown}
      >
        <span className="bs-select-val">
          <span>{shown}</span>
          {rows.length <= SIZE_ROWS && rows.map((r) => <span key={r.key} className="bs-select-sizer" aria-hidden="true">{r.label}</span>)}
        </span>
        <svg className="bs-select-chev" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {name && <input type="hidden" name={name} value={current} />}

      {!isPhone && presence.mounted && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={popRef}
          className="bs-select-pop bs-tokens"
          data-state={presence.state}
          data-up={pos.up || undefined}
          style={{
            left: pos.left,
            width: pos.width,
            maxHeight: pos.maxHeight,
            ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
          }}
        >
          <div id={listId} role="listbox" aria-labelledby={label ? undefined : (labelledBy ?? triggerId)} aria-label={label} className="bs-select-list">
            {renderRows(false)}
          </div>
        </div>,
        document.body,
      )}

      {isPhone && (
        <Drawer open={open} onClose={() => close()} label={label ?? sheetLabel ?? 'Choose'} hideEscHint layer="top" className="bs-select-sheet">
          <div id={listId} role="listbox" aria-label={label ?? sheetLabel ?? 'Choose'} className="bs-select-list" onKeyDown={onSheetKeyDown}>
            {renderRows(true)}
          </div>
        </Drawer>
      )}
    </>
  )
}
