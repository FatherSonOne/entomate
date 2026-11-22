import React from 'react'
import { cx } from './cx'

export interface RuledColumn<Row> {
  key: string
  header: React.ReactNode
  render: (row: Row) => React.ReactNode
  /** Right-align (numbers). */
  align?: 'left' | 'right'
  /** Secondary column: dropped on phone so nothing scrolls sideways. */
  secondary?: boolean
  /** Extra class on the cells (e.g. 'bs-mono'). */
  className?: string
}

export interface RuledTableProps<Row> {
  columns: ReadonlyArray<RuledColumn<Row>>
  rows: ReadonlyArray<Row>
  rowKey: (row: Row) => string
  /** Accessible caption (visually hidden). */
  caption: string
  selectedKey?: string | null
  onRowClick?: (row: Row) => void
  empty?: React.ReactNode
}

/** Ruled table: mono caps headers, no row numbers, hairline rows. */
export function RuledTable<Row>({ columns, rows, rowKey, caption, selectedKey, onRowClick, empty }: RuledTableProps<Row>): React.ReactElement {
  const clickable = Boolean(onRowClick)

  const onKey = (e: React.KeyboardEvent<HTMLTableRowElement>, row: Row): void => {
    if (!onRowClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRowClick(row)
    }
  }

  return (
    <table className="bs-tbl">
      <caption className="bs-sr">{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col" className={cx(c.align === 'right' && 'r', c.secondary && 'bs-dt')}>{c.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && empty ? (
          <tr><td colSpan={columns.length} className="bs-mut">{empty}</td></tr>
        ) : (
          rows.map((row) => {
            const key = rowKey(row)
            return (
              <tr
                key={key}
                data-clickable={clickable || undefined}
                aria-selected={selectedKey != null ? selectedKey === key : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={clickable ? (e) => onKey(e, row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cx(c.align === 'right' && 'r', c.secondary && 'bs-dt', c.className)}>{c.render(row)}</td>
                ))}
              </tr>
            )
          })
        )}
      </tbody>
    </table>
  )
}
