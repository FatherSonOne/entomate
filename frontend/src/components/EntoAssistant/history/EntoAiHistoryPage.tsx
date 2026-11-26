import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { Loader2, Search } from 'lucide-react'
import { Key, RuledTable, Signal, TextInput, TitleRule } from '../../bench'
import type { RuledColumn } from '../../bench'
import { requestThread } from '../threadSignal'
import { useThreadHistory, HISTORY_PAGE_SIZE, type ThreadHistoryRow } from './useThreadHistory'
import { formatThreadDate, groupThreads } from './groupThreads'
import './history.css'

/**
 * Ask Entomate · every saved conversation (EAI-02c slice 4), the "View all" page under the
 * panel's History rail. Ported from Logos AI's Transcripts page, built from Entomate's bench
 * parts (title rule, keys, ruled table) so it reads like every other Entomate screen.
 *
 * The rail lists the newest 20; this page lists all of them, searches titles and message
 * text, opens one in the panel, and deletes one or many. Not ported: pin, archive and rename
 * (ento_ai_threads has no pinned_at / archived_at, and its updated_at trigger would move a
 * renamed conversation to the top). The search lives in the URL (?q=) so Back and a link work.
 */

interface OutletCtx { openAssistant?: () => void }

export default function EntoAiHistoryPage(): React.ReactElement {
  const outlet = useOutletContext<OutletCtx | undefined>()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const searchRef = useRef<HTMLInputElement>(null)
  const history = useThreadHistory(query)
  const { rows, total, loading, loadingMore, error, searching } = history
  const term = query.trim()

  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmingBulk, setConfirmingBulk] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Keep ?q= in step with the box without adding a history entry per keystroke.
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (term) next.set('q', term); else next.delete('q')
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- params is read, not watched
  }, [query])

  // Back/Forward changes ?q= without typing; follow it so the box and the list agree.
  const urlQuery = params.get('q') ?? ''
  useEffect(() => {
    setQuery((current) => (current.trim() === urlQuery ? current : urlQuery))
  }, [urlQuery])

  // A selection or an armed confirm belongs to the list it was made in.
  useEffect(() => {
    setSelected(new Set())
    setConfirmingBulk(false)
    setConfirmingId(null)
  }, [query])

  const now = useMemo(() => new Date(), [rows]) // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => groupThreads(rows, now, term.length > 0), [rows, now, term])

  const open = (id: string | null) => {
    requestThread(id)
    outlet?.openAssistant?.()
  }

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const stopSelecting = () => { setSelecting(false); setSelected(new Set()); setConfirmingBulk(false) }

  const remove = async (ids: string[]) => {
    setBusy(true)
    const ok = await history.remove(ids)
    setBusy(false)
    return ok
  }
  const bulkDelete = async () => {
    if (await remove([...selected])) stopSelecting()
    else { setSelected(new Set()); setConfirmingBulk(false) }
  }

  const titleOf = (row: ThreadHistoryRow) => row.title || 'Untitled conversation'

  const columns: RuledColumn<ThreadHistoryRow>[] = [
    ...(selecting ? [{
      key: 'sel',
      header: <span className="bs-sr">Selected</span>,
      className: 'bs-th-sel',
      render: (row: ThreadHistoryRow) => (
        <input type="checkbox" className="bs-check" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={`Select ${titleOf(row)}`} />
      ),
    }] : []),
    {
      key: 'conversation',
      header: 'Conversation',
      render: (row) => (
        <div className="bs-th-name">
          {selecting
            ? <span className="bs-h3 bs-th-title">{titleOf(row)}</span>
            : <button type="button" className="bs-h3 bs-th-title bs-th-open" onClick={() => open(row.id)} title="Open in Ask Entomate">{titleOf(row)}</button>}
          {row.snippet && <p className="bs-th-snippet">{row.snippet}</p>}
          <span className="bs-th-sub">{row.message_count} {row.message_count === 1 ? 'message' : 'messages'}</span>
        </div>
      ),
    },
    {
      key: 'when',
      header: 'Last message',
      align: 'right',
      className: 'bs-th-when bs-mono',
      render: (row) => formatThreadDate(row.updated_at, now),
    },
    ...(!selecting ? [{
      key: 'del',
      header: <span className="bs-sr">Delete</span>,
      className: 'bs-th-del',
      render: (row: ThreadHistoryRow) => confirmingId === row.id ? (
        <span className="bs-th-confirm">
          <Key size="sm" variant="danger" disabled={busy} aria-label={`Confirm delete ${titleOf(row)}`}
            onClick={async () => { await remove([row.id]); setConfirmingId(null) }}>
            Delete?
          </Key>
          <Key size="sm" onClick={() => setConfirmingId(null)}>Cancel</Key>
        </span>
      ) : (
        <Key size="sm" disabled={busy} aria-label={`Delete ${titleOf(row)}`} onClick={() => setConfirmingId(row.id)}>Delete</Key>
      ),
    }] : []),
  ]

  const bulkActions = (
    <div className="bs-bulk-actions" role="toolbar" aria-label="Bulk actions">
      {confirmingBulk ? <>
        <span className="bs-th-warn">Delete {selected.size} for good?</span>
        <Key variant="danger" disabled={busy} onClick={() => void bulkDelete()}>Delete</Key>
        <Key disabled={busy} onClick={() => setConfirmingBulk(false)}>Cancel</Key>
      </> : <>
        <Key onClick={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}>{allSelected ? 'Clear all' : 'Select all'}</Key>
        <Key variant="danger" disabled={selected.size === 0} onClick={() => setConfirmingBulk(true)}>Delete {selected.size}</Key>
        <Key onClick={stopSelecting}>Done</Key>
      </>}
    </div>
  )

  const meta = loading && !rows.length
    ? 'Ask Entomate'
    : term
      ? <><b>{total} {total === 1 ? 'match' : 'matches'}</b> · titles and messages</>
      : <><b>{total} {total === 1 ? 'conversation' : 'conversations'}</b> · Ask Entomate · newest first</>

  return (
    <div className="bs-th">
      <TitleRule title="AI conversations" meta={meta} actions={
        <>
          <Key disabled={(!rows.length && !selecting) || busy} aria-pressed={selecting} onClick={() => {
            if (selecting) stopSelecting()
            else { setConfirmingId(null); setSelecting(true) }
          }}>Select</Key>
          <Key variant="primary" onClick={() => open(null)}>New conversation</Key>
        </>
      } />

      <div className="bs-th-search">
        <TextInput
          ref={searchRef}
          type="search"
          icon={<Search />}
          placeholder="Search titles and messages"
          aria-label="Search conversations"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Key disabled={!query} onClick={() => {
          setQuery('')
          searchRef.current?.focus()
        }}>Clear</Key>
        <span className="sr-only" role="status">{(searching || (loading && rows.length > 0)) && 'Searching'}</span>
      </div>

      {selecting && bulkActions}
      {error && (
        <div className="bs-th-error" role="alert">
          <span>{error}</span>
          <Key size="sm" onClick={() => { history.dismissError(); void history.retry() }}>Try again</Key>
        </div>
      )}

      <div className="bs-th-list" aria-busy={loading || undefined}>
        {loading && rows.length === 0 ? (
          <div className="bs-th-empty"><Signal tone="brand">Loading conversations</Signal></div>
        ) : rows.length === 0 ? (
          error ? null : (
            <div className="bs-th-empty">
              <Signal tone="off">{term ? 'No matches' : 'No conversations yet'}</Signal>
              <p className="bs-h3">
                {term
                  ? `No conversation mentions “${term}”.`
                  : 'Ask Entomate a question and the conversation is saved here.'}
              </p>
              {!term && <Key variant="primary" onClick={() => open(null)}>Ask Entomate</Key>}
            </div>
          )
        ) : (
          <>
            <RuledTable
              caption="AI conversations"
              columns={columns}
              groups={groups.map((g) => ({ key: g.key, label: g.label, count: g.rows.length, rows: g.rows }))}
              rowKey={(row) => row.id}
              onRowClick={selecting ? (row) => toggle(row.id) : undefined}
            />
            <div className="bs-th-more">
              <span className="bs-lbl">{rows.length} of {total} shown</span>
              {rows.length < total && (
                <Key onClick={() => void history.loadMore()} disabled={loadingMore}>
                  {loadingMore && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {loadingMore ? 'Loading' : `Show ${Math.min(HISTORY_PAGE_SIZE, total - rows.length)} more`}
                </Key>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
