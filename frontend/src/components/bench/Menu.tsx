import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Key } from './Key'
import { cx } from './cx'

export type MenuEntry =
  | { kind?: 'item'; key: string; label: React.ReactNode; hint?: React.ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean }
  | { kind: 'label'; key: string; label: React.ReactNode }

export interface MenuProps {
  /** Accessible name of the trigger ("More actions"). */
  label: string
  /** What the trigger key shows. Defaults to ⋯. */
  trigger?: React.ReactNode
  entries: ReadonlyArray<MenuEntry>
  /** Which edge of the trigger the list lines up with. */
  align?: 'start' | 'end'
  className?: string
}

/**
 * A key that opens a short list of secondary actions (the ⋯ on a title rule).
 * Arrow keys move, Enter picks, Esc or a click outside closes and returns focus.
 */
export function Menu({ label, trigger = '⋯', entries, align = 'end', className }: MenuProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const id = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const items = (): HTMLButtonElement[] =>
    Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)') ?? [])

  const close = useCallback((refocus: boolean) => {
    setOpen(false)
    if (refocus) wrapRef.current?.querySelector<HTMLButtonElement>('button[aria-haspopup]')?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    items()[0]?.focus()
    const onDown = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, close])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return }
    if (e.key === 'Tab') { close(false); return }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const list = items()
    if (!list.length) return
    const at = list.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'Home' ? 0
      : e.key === 'End' ? list.length - 1
        : e.key === 'ArrowDown' ? (at + 1) % list.length
          : (at - 1 + list.length) % list.length
    list[next]?.focus()
  }

  return (
    <div ref={wrapRef} className={cx('bs-menu', className)} onKeyDown={open ? onKeyDown : undefined}>
      <Key
        className="bs-menu-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </Key>
      {open && (
        <ul id={id} ref={listRef} role="menu" aria-label={label} className="bs-menu-list" data-align={align}>
          {entries.map((e) =>
            e.kind === 'label' ? (
              <li key={e.key} role="presentation" className="bs-menu-label bs-lbl">{e.label}</li>
            ) : (
              <li key={e.key} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="bs-menu-item"
                  data-danger={e.danger || undefined}
                  disabled={e.disabled}
                  onClick={() => { close(true); e.onSelect() }}
                >
                  <span>{e.label}</span>
                  {e.hint && <span className="bs-menu-hint">{e.hint}</span>}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}
