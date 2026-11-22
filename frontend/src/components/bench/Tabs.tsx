import React, { useId, useRef } from 'react'
import { cx } from './cx'

export interface TabItem<V extends string> {
  value: V
  label: React.ReactNode
  /** Mono count after the label ("Actions 4"). */
  count?: number
  /** Hide this tab on phone (secondary views). */
  desktopOnly?: boolean
}

export interface TabsProps<V extends string> {
  items: ReadonlyArray<TabItem<V>>
  value: V
  onChange: (value: V) => void
  /** Accessible name for the tab list. */
  label: string
  /** Prefix for tab and panel ids; pair with tabPanelProps(). */
  idBase?: string
  className?: string
}

/** Ids that tie a tab to its panel. */
export function tabIds(idBase: string, value: string): { tab: string; panel: string } {
  return { tab: `${idBase}-tab-${value}`, panel: `${idBase}-panel-${value}` }
}

/**
 * Plain tabs over the content column: sans labels on a hairline, the
 * active one underlined in ink. On phone they become equal segments so
 * nothing scrolls sideways. Arrow keys, Home and End move between tabs.
 */
export function Tabs<V extends string>({ items, value, onChange, label, idBase, className }: TabsProps<V>): React.ReactElement {
  const fallbackId = useId()
  const base = idBase ?? fallbackId
  const listRef = useRef<HTMLDivElement | null>(null)

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(e.key)) return
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])
      .filter((b) => b.offsetParent !== null)
    const at = buttons.findIndex((b) => b === document.activeElement)
    if (buttons.length === 0) return
    e.preventDefault()
    let next = at
    if (e.key === 'ArrowLeft') next = (at - 1 + buttons.length) % buttons.length
    if (e.key === 'ArrowRight') next = (at + 1) % buttons.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = buttons.length - 1
    const target = buttons[next]
    if (!target) return
    target.focus()
    target.click()
  }

  return (
    <div ref={listRef} className={cx('bs-tabs', className)} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((item) => {
        const ids = tabIds(base, item.value)
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={ids.tab}
            aria-selected={selected}
            aria-controls={ids.panel}
            tabIndex={selected ? 0 : -1}
            className={cx(item.desktopOnly && 'bs-dt')}
            onClick={() => onChange(item.value)}
          >
            {item.label}
            {item.count !== undefined && <span className="bs-tabs-n">{item.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  idBase: string
  value: string
  children: React.ReactNode
}

/** The region a tab controls. Render only the selected one. */
export function TabPanel({ idBase, value, children, className, ...rest }: TabPanelProps): React.ReactElement {
  const ids = tabIds(idBase, value)
  return (
    <div role="tabpanel" id={ids.panel} aria-labelledby={ids.tab} tabIndex={0} className={cx('bs-tabpanel', className)} {...rest}>
      {children}
    </div>
  )
}
