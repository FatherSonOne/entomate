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

export interface RuledGroup<Row> {
  key: string
  /** Mono caps label over a 2px ink rule (This week, October). */
  label: React.ReactNode
  /** Count or note on the right. */
  count?: React.ReactNode
  rows: ReadonlyArray<Row>
}

export interface RuledTableProps<Row> {
  columns: ReadonlyArray<RuledColumn<Row>>
  /** Flat rows. Ignored when `groups` is given. */
  rows?: ReadonlyArray<Row>
  /** Rows under group heads, in one table with one header. */
  groups?: ReadonlyArray<RuledGroup<Row>>
  rowKey: (row: Row) => string
  /** Accessible caption (visually hidden). */
  caption: string
  selectedKey?: string | null
  onRowClick?: (row: Row) => void
  empty?: React.ReactNode
}

/** Clicks and keys on a link, key or field inside a row belong to that control, not the row. */
function fromControl(e: React.SyntheticEvent): boolean {
  const target = e.target as HTMLElement
  return Boolean(target.closest('a, button, input, select, textarea, label')) && target !== e.currentTarget
}

/** Ruled table: mono caps headers, no row numbers, hairline rows. */
export function RuledTable<Row>({ columns, rows = [], groups, rowKey, caption, selectedKey, onRowClick, empty }: RuledTableProps<Row>): React.ReactElement {
  const clickable = Boolean(onRowClick)
  const total = groups ? groups.reduce((n, g) => n + g.rows.length, 0) : rows.length

  const onKey = (e: React.KeyboardEvent<HTMLTableRowElement>, row: Row): void => {
    if (!onRowClick || fromControl(e)) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRowClick(row)
    }
  }

  const renderRow = (row: Row): React.ReactElement => {
    const key = rowKey(row)
    return (
      <tr
        key={key}
        data-clickable={clickable || undefined}
        aria-selected={selectedKey != null ? selectedKey === key : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={onRowClick ? (e) => { if (!fromControl(e)) onRowClick(row) } : undefined}
        onKeyDown={clickable ? (e) => onKey(e, row) : undefined}
      >
        {columns.map((c) => (
          <td key={c.key} className={cx(c.align === 'right' && 'r', c.secondary && 'bs-dt', c.className)}>{c.render(row)}</td>
        ))}
      </tr>
    )
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
      {total === 0 && empty ? (
        <tbody>
          <tr><td colSpan={columns.length} className="bs-mut">{empty}</td></tr>
        </tbody>
      ) : groups ? (
        groups.map((g) => (
          <tbody key={g.key}>
            <tr className="bs-tbl-group">
              <th colSpan={columns.length} scope="colgroup">
                <div className="bs-tbl-group-in">
                  <span className="bs-lbl">{g.label}</span>
                  {g.count !== undefined && <span className="bs-lbl">{g.count}</span>}
                </div>
              </th>
            </tr>
            {g.rows.map(renderRow)}
          </tbody>
        ))
      ) : (
        <tbody>{rows.map(renderRow)}</tbody>
      )}
    </table>
  )
}
